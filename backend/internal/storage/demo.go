package storage

import (
	"encoding/json"
	"stepflow/backend/internal/models"
	"strconv"
	"strings"
	"time"
)

func seedDemoUsernames(state *models.State) bool {
	changed := false
	for _, role := range []string{"admin", "member", "expert", "learner"} {
		id := "demo-v1-" + role
		profile, ok := state.Accounts[id]
		if !ok || profile.Username != "" {
			continue
		}
		base := "demo_" + role
		username := base
		for suffix := 2; findUsername(state, username) != nil; suffix++ {
			username = base + "_" + strconv.Itoa(suffix)
		}
		profile.Username = username
		state.Accounts[id] = profile
		changed = true
	}
	return changed
}

// Demo data is opt-in and installed once. Existing accounts are never replaced.
func (s *Storage) seedDemo() error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	state, err := s.loadState(tx)
	if err != nil {
		return err
	}
	if _, seeded := state.Accounts["demo-v1-admin"]; seeded {
		// Only migrate the original fixture and its generated labels, preserving user edits.
		const oldTitle = "Демо · Собрать презентацию с Artem.AI"
		const newTitle = "Демо · Собрать презентацию с Alina.AI"
		changed := seedDemoUsernames(state)
		for i, g := range state.Guides {
			if g.ID == "demo-v1-pending" && g.Title == oldTitle {
				state.Guides[i].Title = newTitle
				changed = true
			}
		}
		for i, d := range state.ModerationDecisions {
			if d.GuideID == "demo-v1-pending" && d.Title == oldTitle {
				state.ModerationDecisions[i].Title = newTitle
				changed = true
			}
		}
		for _, notices := range state.Notices {
			for i, n := range notices {
				if strings.Contains(n.Text, "«"+oldTitle+"»") {
					notices[i].Text = strings.ReplaceAll(n.Text, "«"+oldTitle+"»", "«"+newTitle+"»")
					changed = true
				}
			}
		}
		if changed {
			if err := saveState(tx, state); err != nil {
				return err
			}
			return tx.Commit()
		}
		return nil
	}
	profiles := []models.Profile{
		{ID: "demo-v1-admin", Name: "Демо Администратор", Email: "admin@stepflow.test", Role: "Администратор", Plan: "business"},
		{ID: "demo-v1-member", Name: "Демо Участник", Email: "member@stepflow.test", Role: "Ученик", Plan: "business"},
		{ID: "demo-v1-expert", Name: "Демо Эксперт", Email: "expert@stepflow.test", Role: "Эксперт", Plan: "standard"},
		{ID: "demo-v1-learner", Name: "Демо Ученик", Email: "learner@stepflow.test", Role: "Ученик", Plan: "free"},
	}
	for _, p := range profiles {
		if findAccount(state, p.Email) != nil {
			return NewWorkspaceError("Демо-email уже занят: " + p.Email)
		}
	}
	for _, p := range profiles {
		state.Accounts[p.ID] = p
	}
	seedDemoUsernames(state)
	now := time.Now().UTC()
	stamp := now.Add(-2 * time.Hour).Format(time.RFC3339)
	steps := []models.Step{
		{ID: "demo-v1-step-1", Title: "Собери материалы", Text: "Запиши тему презентации и три основных тезиса. Найди пример к каждому тезису.", Checks: []string{"Тема записана", "Три тезиса готовы"}},
		{ID: "demo-v1-step-2", Title: "Разложи по слайдам", Text: "Создай титульный слайд, три слайда с тезисами и заключение. На каждом слайде оставь одну мысль.", Checks: []string{"Пять слайдов созданы"}},
		{ID: "demo-v1-step-3", Title: "Проверь выступление", Text: "Расскажи презентацию вслух и замерь время. Сократи фрагменты, которые не помогают объяснить тему.", Checks: []string{"Репетиция завершена"}},
	}
	examples := []struct {
		id, title string
		status    models.PublicationStatus
		ai        bool
	}{
		{"published", "Демо · Подготовить учебную презентацию", models.StatusPublished, false},
		{"pending", "Демо · Собрать презентацию с Alina.AI", models.StatusPending, true},
		{"pending-2", "Демо · Провести командную репетицию", models.StatusPending, false},
		{"rejected", "Демо · Оформить список источников", models.StatusRejected, false},
		{"draft", "Демо · Подготовить ответы жюри", models.StatusDraft, false},
	}
	for _, e := range examples {
		g := models.Instruction{ID: "demo-v1-" + e.id, Title: e.title, Description: "Учебный пример для проверки интерфейса и ролей.", Category: "Учёба", Minutes: 15, Author: profiles[1].Name, OwnerID: profiles[1].ID, Owned: true, Status: e.status, Steps: steps, Revision: 1, AIGenerated: e.ai}
		if e.status != models.StatusDraft {
			g.SubmittedAt = stamp
		}
		if e.status == models.StatusPublished || e.status == models.StatusRejected {
			g.ReviewedAt = stamp
			g.ReviewedBy = profiles[0].Name
			if e.status == models.StatusRejected {
				g.ModerationNote = "Добавь пример оформления источника и способ проверки результата."
			}
			state.ModerationDecisions = append(state.ModerationDecisions, moderationDecision("demo-v1-decision-"+e.id, g))
		}
		state.Guides = append(state.Guides, g)
	}
	state.Teams = append(state.Teams, models.Team{ID: "demo-v1-team", Name: "Демо · Vought", OwnerID: profiles[1].ID, MemberIDs: []string{profiles[1].ID, profiles[2].ID, profiles[3].ID}, Active: true})
	teamGuide := state.Guides[len(state.Guides)-5]
	teamGuide.ID = "demo-v1-team-guide"
	teamGuide.TeamID = "demo-v1-team"
	teamGuide.Title = "Демо · Подготовка команды к защите"
	state.Guides = append(state.Guides, teamGuide)
	guideID := "demo-v1-published"
	state.Reviews = append(state.Reviews, models.ExpertReview{GuideID: guideID, ExpertID: profiles[2].ID, ExpertName: profiles[2].Name, Verified: true, Text: "Демо-рецензия: шаги воспроизводятся, результат каждого действия описан.", CreatedAt: stamp})
	state.Comments = append(state.Comments, models.StepComment{ID: "demo-v1-comment", GuideID: guideID, StepID: steps[1].ID, AuthorID: profiles[3].ID, AuthorName: profiles[3].Name, Text: "Можно добавить отдельный слайд с источниками?", CreatedAt: stamp})
	state.Reports = append(state.Reports, models.Report{ID: "demo-v1-question", GuideID: guideID, StepID: steps[1].ID, AuthorID: profiles[3].ID, Text: "Куда добавить список источников?", Reply: "Добавь его после заключения. Этот слайд не учитывается в пяти основных."})
	run := models.DefaultRun()
	run.Current = 1
	run.Completed = []string{steps[0].ID}
	run.Visited = []string{steps[0].ID, steps[1].ID}
	run.LastStepID = steps[1].ID
	run.UpdatedAt = now.UnixMilli()
	state.Runs[guideID] = map[string]models.Run{profiles[3].ID: run}
	state.Votes[guideID] = map[string]models.Vote{profiles[3].ID: models.VoteHelpful}
	if state.Notices == nil {
		state.Notices = make(map[string][]models.Notice)
	}
	for _, p := range profiles {
		recent := models.Notice{ID: "demo-v1-notice-" + p.ID, Text: teamGuide.Title, Href: "/guide?id=" + teamGuide.ID + "&from=team", CreatedAt: stamp}
		if models.IsAdmin(&p) {
			recent.Text = "На проверку: «Демо · Собрать презентацию с Alina.AI»"
			recent.Href = "/moderation?guide=demo-v1-pending&revision=1"
		}
		state.Notices[p.ID] = []models.Notice{
			recent,
			{ID: "demo-v1-read-" + p.ID, Text: "Демо · Учебные данные готовы к проверке", Href: "/catalog", CreatedAt: stamp, Read: true},
		}
	}
	payload, err := json.Marshal(state)
	if err != nil {
		return err
	}
	if _, err = tx.Exec("UPDATE workspace SET payload = ? WHERE id = 1", string(payload)); err != nil {
		return err
	}
	return tx.Commit()
}
