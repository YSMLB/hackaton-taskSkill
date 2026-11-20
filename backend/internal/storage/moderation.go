package storage

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"stepflow/backend/internal/models"
)

func notifyModerators(state *models.State, guide *models.Instruction, actor, message string) {
	href := fmt.Sprintf("/moderation?guide=%s&revision=%d", guide.ID, guide.Revision)
	for id, account := range state.Accounts {
		if models.IsAdmin(&account) {
			notify(state, id, actor, message+" «"+guide.Title+"»", href)
		}
	}
}

func applyModeration(state *models.State, guide *models.Instruction, decision, note, reviewer, actor string) {
	guide.Status = models.StatusRejected
	message := "На доработку: «" + guide.Title + "»"
	if decision == "approve" {
		guide.Status = models.StatusPublished
		message = "Опубликована инструкция «" + guide.Title + "»"
	}
	guide.ModerationNote = note
	guide.ReviewedAt = time.Now().UTC().Format(time.RFC3339)
	guide.ReviewedBy = reviewer
	state.ModerationDecisions = append(state.ModerationDecisions, moderationDecision(RandomUUID(), *guide))
	delete(state.AutoReviews, guide.ID)
	if guide.TeamID != "" && decision == "approve" {
		for _, team := range state.Teams {
			if team.ID == guide.TeamID {
				notifyTeam(state, &team, actor, message, "/guide?id="+guide.ID+"&from=team")
				break
			}
		}
	} else if canReceiveGuideNotice(state, guide, guide.OwnerID) {
		notify(state, guide.OwnerID, actor, message, "/editor?id="+guide.ID)
	}
}

func saveState(tx *sql.Tx, state *models.State) error {
	payload, err := json.Marshal(state)
	if err != nil {
		return err
	}
	_, err = tx.Exec("UPDATE workspace SET payload = ? WHERE id = 1", string(payload))
	return err
}

type ModerationJob struct {
	Guide   models.Instruction
	epoch   int
	attempt models.AutoReviewAttempt
}

// Earlier releases published team submissions directly, without a review record.
func (s *Storage) queueUnreviewedTeamPublications() error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	state, err := s.loadState(tx)
	if err != nil {
		return err
	}
	changed := false
	for i := range state.Guides {
		g := &state.Guides[i]
		if g.TeamID == "" || g.Status != models.StatusPublished || g.ReviewedAt != "" || g.ReviewedBy != "" {
			continue
		}
		g.Status = models.StatusPending
		delete(state.AutoReviews, g.ID)
		notifyModerators(state, g, "system:moderation", "На проверку поступила командная инструкция")
		changed = true
	}
	if !changed {
		return nil
	}
	if err := saveState(tx, state); err != nil {
		return err
	}
	return tx.Commit()
}

// Recheck earlier model referrals once when the editorial rules change.
const moderationPolicy = 1

func previousPolicyReferral(attempt models.AutoReviewAttempt) bool {
	return attempt.ManualNote != "" && attempt.Failures < 3 && attempt.Policy < moderationPolicy
}

func (s *Storage) ModerationWake() <-chan struct{} { return s.moderationWake }

func (s *Storage) NextModerationJob() (*ModerationJob, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadState(nil)
	if err != nil || !state.AutoModeration {
		return nil, err
	}
	now := time.Now().Unix()
	// New guides are inserted at the front. Serve the oldest eligible guide first.
	for i := len(state.Guides) - 1; i >= 0; i-- {
		guide := state.Guides[i]
		attempt := state.AutoReviews[guide.ID]
		eligible := previousPolicyReferral(attempt) || (attempt.ManualNote == "" && attempt.RetryAt <= now)
		if guide.Status == models.StatusPending && eligible {
			return &ModerationJob{Guide: guide, epoch: state.ModerationEpoch, attempt: attempt}, nil
		}
	}
	return nil, nil
}

// RecordModeration applies the result only while the submitted version and admin setting still match.
func (s *Storage) RecordModeration(job ModerationJob, decision, note string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	state, err := s.loadState(tx)
	if err != nil {
		return err
	}
	if !state.AutoModeration || state.ModerationEpoch != job.epoch {
		return nil
	}
	for i := range state.Guides {
		guide := &state.Guides[i]
		if guide.ID != job.Guide.ID {
			continue
		}
		attempt := state.AutoReviews[guide.ID]
		if guide.Status != models.StatusPending || guide.Revision != job.Guide.Revision || attempt != job.attempt {
			return nil
		}
		if previousPolicyReferral(attempt) {
			attempt = models.AutoReviewAttempt{}
		}
		switch decision {
		case "approve", "reject":
			applyModeration(state, guide, decision, note, "ИИ-модератор", "system:moderation")
		case "manual", "retry", "busy":
			if decision == "busy" {
				attempt.RetryAt = time.Now().Add(10 * time.Second).Unix()
			} else if decision == "manual" {
				attempt.ManualNote = note
				attempt.Policy = moderationPolicy
			} else {
				attempt.Failures++
				switch attempt.Failures {
				case 1:
					attempt.RetryAt = time.Now().Add(30 * time.Second).Unix()
				case 2:
					attempt.RetryAt = time.Now().Add(2 * time.Minute).Unix()
				default:
					attempt.ManualNote = "ИИ не смог проверить инструкцию после трёх попыток. Проверьте её вручную."
				}
			}
			if state.AutoReviews == nil {
				state.AutoReviews = make(map[string]models.AutoReviewAttempt)
			}
			state.AutoReviews[guide.ID] = attempt
			if attempt.ManualNote != "" && job.attempt.ManualNote == "" {
				notifyModerators(state, guide, "system:moderation", "Нужна ручная проверка инструкции")
			}
		default:
			return errors.New("unknown automatic moderation decision")
		}
		if err := saveState(tx, state); err != nil {
			return err
		}
		return tx.Commit()
	}
	return nil
}
