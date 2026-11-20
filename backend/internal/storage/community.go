package storage

import (
	"net/url"
	"slices"
	"time"

	"stepflow/backend/internal/models"
	"stepflow/backend/internal/provider"
)

func moderationDecision(id string, guide models.Instruction) models.ModerationDecision {
	return models.ModerationDecision{
		ID: id, Title: guide.Title, Author: guide.Author, Reviewer: guide.ReviewedBy,
		Approved: guide.Status == models.StatusPublished, Note: guide.ModerationNote, CreatedAt: guide.ReviewedAt,
	}
}

func memberTeam(state *models.State, id, actor string) *models.Team {
	for i := range state.Teams {
		team := &state.Teams[i]
		if team.ID == id && slices.Contains(team.MemberIDs, actor) {
			return team
		}
	}
	return nil
}

func visible(state *models.State, guide models.Instruction, profile *models.Profile) bool {
	if guide.TeamID == "" {
		return models.CanView(guide, profile)
	}
	return profile != nil && memberTeam(state, guide.TeamID, models.ActorID(*profile)) != nil
}

func notify(state *models.State, recipient, actor, text, href string) {
	if recipient == "" || recipient == actor {
		return
	}
	if state.Notices == nil {
		state.Notices = make(map[string][]models.Notice)
	}
	notice := models.Notice{ID: RandomUUID(), Text: text, Href: href, CreatedAt: time.Now().UTC().Format(time.RFC3339)}
	previous := state.Notices[recipient]
	state.Notices[recipient] = append([]models.Notice{notice}, previous[:min(len(previous), 199)]...)
}

func mediaURL(raw any) string {
	if raw == nil || raw == "" {
		return ""
	}
	value := textValidation(raw, 2000, true)
	u, err := url.Parse(value)
	requireCondition(err == nil && u.Scheme == "https" && u.Hostname() != "" && u.User == nil, "Укажи ссылку на медиа с HTTPS.")
	return u.String()
}

// Account and team changes share the workspace transaction with notices.
func changeAccount(state *models.State, profile *models.Profile, kind string, command map[string]any) bool {
	actor := models.ActorID(*profile)
	switch kind {
	case "admin":
		requireCondition(models.IsAdmin(profile), "Назначать администраторов может администратор.", 403)
		target := findAccount(state, textValidation(command["email"], 254, true))
		requireCondition(target != nil, "Пользователь не найден. Сначала ему нужно зарегистрироваться.", 404)
		target.Role = "Администратор"
		target.RoleBeforeExpert = ""
		state.Accounts[models.ActorID(*target)] = *target
		notify(state, models.ActorID(*target), actor, "Тебя назначили администратором", "/moderation")
	case "auto-moderation":
		requireCondition(models.IsAdmin(profile), "Автопроверку настраивает администратор.", 403)
		enabled, ok := command["enabled"].(bool)
		requireCondition(ok, "Укажи состояние автопроверки.")
		requireCondition(!enabled || provider.Configured(), "Настройте ИИ-сервис для автопроверки.", 503)
		if state.AutoModeration != enabled {
			state.AutoModeration = enabled
			state.ModerationEpoch++
		}
	case "plan":
		plan := textValidation(command["plan"], 20, true)
		requireCondition(plan == "standard" || plan == "business" || plan == "free", "Выбери тариф.")
		profile.Plan = plan
		state.Accounts[actor] = *profile
		for i := range state.Teams {
			if state.Teams[i].OwnerID == actor {
				state.Teams[i].Active = plan == "business"
			}
		}
	case "expert":
		requireCondition(models.IsAdmin(profile), "Назначать экспертов может администратор.", 403)
		target := findAccount(state, textValidation(command["email"], 254, true))
		requireCondition(target != nil && !models.IsAdmin(target), "Профиль не найден или принадлежит администратору.", 404)
		enabled, ok := command["enabled"].(bool)
		requireCondition(ok, "Выбери действие.")
		msg := "Роль эксперта отозвана"
		if enabled {
			requireCondition(target.Plan == "standard" || target.Plan == "business", "Для назначения нужна подписка.", 409)
			requireCondition(target.Role != "Эксперт", "Пользователь уже назначен экспертом.", 409)
			target.RoleBeforeExpert = target.Role
			target.Role = "Эксперт"
			msg = "Тебя назначили экспертом"
		} else {
			requireCondition(target.Role == "Эксперт", "У пользователя нет роли эксперта.", 409)
			target.Role = target.RoleBeforeExpert
			if target.Role != "Автор" && target.Role != "Ученик" {
				target.Role = "Автор"
			}
			target.RoleBeforeExpert = ""
		}
		id := models.ActorID(*target)
		state.Accounts[id] = *target
		notify(state, id, actor, msg, "/profile")
	case "team-create":
		requireCondition(profile.Plan == "business", "Создание команды доступно на тарифе «Бизнес».", 403)
		name := textValidation(command["name"], 100, true)
		state.Teams = append(state.Teams, models.Team{ID: RandomUUID(), Name: name, Active: true, OwnerID: actor, MemberIDs: []string{actor}})
	case "team-member":
		team := memberTeam(state, validateGuideID(command["teamId"]), actor)
		requireCondition(team != nil && team.Active && team.OwnerID == actor, "Изменять состав может владелец активной команды.", 403)
		member := findAccount(state, textValidation(command["email"], 254, true))
		requireCondition(member != nil && models.ActorID(*member) != actor, "Укажи email другого участника.")
		id := models.ActorID(*member)
		index := slices.Index(team.MemberIDs, id)
		if command["remove"] == true {
			if index >= 0 {
				team.MemberIDs = slices.Delete(team.MemberIDs, index, index+1)
			}
		} else if index < 0 {
			team.MemberIDs = append(team.MemberIDs, id)
			notify(state, id, actor, "Тебя добавили в команду «"+team.Name+"»", "/team")
		}
	case "notices-read":
		for i, n := range state.Notices[actor] {
			if command["id"] == nil || command["id"] == n.ID {
				state.Notices[actor][i].Read = true
			}
		}
	default:
		return false
	}
	return true
}
