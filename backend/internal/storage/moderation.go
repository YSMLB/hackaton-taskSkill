package storage

import (
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"stepflow/backend/internal/models"
)

func applyModeration(state *models.State, guide *models.Instruction, decision, note, reviewer, actor string) {
	guide.Status = models.StatusRejected
	message := "Инструкцию вернули на доработку"
	if decision == "approve" {
		guide.Status = models.StatusPublished
		message = "Инструкция опубликована"
	}
	guide.ModerationNote = note
	guide.ReviewedAt = time.Now().UTC().Format(time.RFC3339)
	guide.ReviewedBy = reviewer
	state.ModerationDecisions = append(state.ModerationDecisions, moderationDecision(RandomUUID(), *guide))
	delete(state.AutoReviews, guide.ID)
	notify(state, guide.OwnerID, actor, message, "/editor?id="+guide.ID)
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
		if guide.Status == models.StatusPending && guide.TeamID == "" && eligible {
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
		if guide.Status != models.StatusPending || guide.TeamID != "" || guide.Revision != job.Guide.Revision || attempt != job.attempt {
			return nil
		}
		if previousPolicyReferral(attempt) {
			attempt = models.AutoReviewAttempt{}
		}
		switch decision {
		case "approve", "reject":
			applyModeration(state, guide, decision, note, "ИИ-модератор", "system:moderation")
		case "manual", "retry":
			if decision == "manual" {
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
