package storage

import (
	"regexp"
	"strings"

	"stepflow/backend/internal/models"
)

var usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_]{3,30}$`)

func normalizeUsername(value any) string {
	raw, ok := value.(string)
	username := strings.TrimPrefix(strings.TrimSpace(raw), "@")
	requireCondition(ok && usernamePattern.MatchString(username), "Введи юзернейм из 3–30 латинских букв, цифр или подчёркиваний.")
	return strings.ToLower(username)
}

func findUsername(state *models.State, username string) *models.Profile {
	for _, account := range state.Accounts {
		if strings.EqualFold(account.Username, username) {
			return &account
		}
	}
	return nil
}

func availableUsername(state *models.State, raw any, actor string) string {
	username := normalizeUsername(raw)
	existing := findUsername(state, username)
	requireCondition(existing == nil || models.ActorID(*existing) == actor, "Этот юзернейм уже занят.", 409)
	return username
}

// Some legacy actor keys contain the login email. Expose opaque roster IDs to other members.
func rosterID(id, viewer string) string {
	if id != viewer && strings.HasPrefix(id, "local:") {
		return "member-" + Digest(id)
	}
	return id
}

func teamForOwner(state *models.State, command map[string]any, actor string) *models.Team {
	team := memberTeam(state, validateGuideID(command["teamId"]), actor)
	requireCondition(team != nil && team.Active && team.OwnerID == actor, "Изменять состав может владелец активной команды.", 403)
	return team
}

func teamCandidate(state *models.State, raw any) *models.Profile {
	member := findUsername(state, normalizeUsername(raw))
	requireCondition(member != nil, "Участник с таким юзернеймом не найден.", 404)
	return member
}
