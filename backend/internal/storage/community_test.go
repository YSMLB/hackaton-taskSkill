package storage_test

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"stepflow/backend/internal/models"
	"stepflow/backend/internal/storage"
)

func TestTeamEditing(t *testing.T) {
	db, cleanup := setupTestStorage(t)
	defer cleanup()
	type command = map[string]any
	send := func(token string, payload command, wantStatus int) (*models.CommandResult, string) {
		t.Helper()
		body, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		result, cookie, err := db.ChangeWorkspace(token, body)
		if wantStatus != 200 {
			var fault *storage.WorkspaceError
			if !errors.As(err, &fault) || fault.Status != wantStatus {
				t.Fatalf("command %v: got %v, want %d", payload["type"], err, wantStatus)
			}
			return nil, ""
		}
		if err != nil {
			t.Fatal(err)
		}
		if cookie != nil {
			return result, *cookie
		}
		return result, ""
	}
	register := func(email string) string {
		_, cookie := send("", command{"type": "register", "profile": command{"email": email, "name": "Имя", "username": strings.Split(email, "@")[0], "role": "Автор"}}, 200)
		return cookie
	}
	owner := register("owner@example.test")
	editor := register("editor@example.test")
	send(owner, command{"type": "plan", "plan": "business"}, 200)
	created, _ := send(owner, command{"type": "team-create", "name": "Редакция"}, 200)
	team := created.Data.Teams[0]
	lookup := command{"type": "team-member-search", "teamId": team.ID, "username": "@EDITOR"}
	send("", lookup, 401)
	send(editor, lookup, 403)
	send(owner, command{"type": "team-member-search", "teamId": team.ID, "username": "edit"}, 404)
	found, _ := send(owner, lookup, 200)
	match := found.MemberMatch
	if match == nil || match.Username != "editor" || match.Name != "Имя" || match.Selection == "" {
		t.Fatalf("unexpected match: %+v", match)
	}
	payload, _ := json.Marshal(found)
	if strings.Contains(string(payload), "editor@example.test") {
		t.Fatal("Team search disclosed candidate's email")
	}
	send(editor, command{"type": "profile", "edits": command{"name": "Имя", "email": "editor@example.test", "username": "new_editor"}}, 200)
	replacement := register("other@example.test")
	send(replacement, command{"type": "profile", "edits": command{"name": "Имя", "email": "other@example.test", "username": "editor"}}, 200)
	send(owner, command{"type": "team-member", "teamId": team.ID, "username": "editor", "selection": match.Selection}, 409)
	send(owner, command{"type": "team-member", "teamId": team.ID, "username": "@NEW_EDITOR", "selection": match.Selection}, 200)
	send(owner, command{"type": "team-member-search", "teamId": team.ID, "username": "new_editor"}, 409)
	send(editor, lookup, 403)
	draft := command{"id": "new", "teamId": team.ID, "title": "Инструкция", "description": "Описание", "category": "Учёба", "minutes": 10, "steps": []command{{"id": "step", "title": "Шаг", "text": "Действие", "checks": []string{"Готово"}, "imageUrl": "https://example.test/image.jpg"}}}
	result, _ := send(owner, command{"type": "save", "guide": draft, "submit": true}, 200)
	draft["id"], draft["revision"] = result.ID, 1
	edit, _ := send(editor, command{"type": "save", "guide": draft, "submit": true}, 200)
	if edit.Data.Guides[0].OwnerID != team.OwnerID || edit.Data.Guides[0].Revision != 2 {
		t.Fatal("Collaborative edit lost owner or revision")
	}
	send(owner, command{"type": "save", "guide": draft}, 409)
	if guide, err := db.GetPublishedGuide(result.ID); err != nil || guide != nil {
		t.Fatalf("Private embed: %v, %v", guide, err)
	}
	memberID := models.ActorID(*edit.Profile)
	send(editor, command{"type": "team-member", "teamId": team.ID, "memberId": team.OwnerID, "remove": true}, 403)
	send(owner, command{"type": "team-member", "teamId": team.ID, "memberId": memberID, "remove": true}, 200)
	snapshot, err := db.ReadWorkspace(editor)
	if err != nil {
		t.Fatal(err)
	}
	for _, guide := range snapshot.Data.Guides {
		if guide.ID == result.ID {
			t.Fatal("Removed member still sees the guide")
		}
	}
	draft["revision"] = 2
	send(editor, command{"type": "save", "guide": draft}, 403)
	send(owner, command{"type": "plan", "plan": "free"}, 200)
	send(owner, lookup, 403)
	send(owner, command{"type": "save", "guide": draft}, 403)
}
