package storage

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"stepflow/backend/internal/models"
)

func TestRegistrationAndLegacyUsername(t *testing.T) {
	t.Setenv("STEPFLOW_DEMO_DATA", "0")
	db, err := New(filepath.Join(t.TempDir(), "usernames.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	type command = map[string]any
	send := func(token string, cmd command, wantStatus int) (*models.CommandResult, *string) {
		t.Helper()
		body, err := json.Marshal(cmd)
		if err != nil {
			t.Fatal(err)
		}
		res, next, err := db.ChangeWorkspace(token, body)
		if wantStatus == 200 && err == nil {
			return res, next
		}
		var fault *WorkspaceError
		if !errors.As(err, &fault) || fault.Status != wantStatus {
			t.Fatalf("%v: got %v, want %d", cmd, err, wantStatus)
		}
		return nil, nil
	}
	register := func(email string, username any, status int) *models.Profile {
		t.Helper()
		profile := command{"name": "Студент", "email": email}
		if username != nil {
			profile["username"] = username
		}
		res, _ := send("", command{"type": "register", "profile": profile}, status)
		if res == nil {
			return nil
		}
		return res.Profile
	}
	for _, invalid := range []any{nil, "", "@ab", "кот", "Kelvin", "@@abc", "has space", "a-b", strings.Repeat("a", 31), 123} {
		register("new@example.test", invalid, 400)
	}
	send("", command{"type": "login", "email": "new@example.test"}, 404)
	if p := register("new@example.test", " @Alice_02 ", 200); p.Username != "alice_02" {
		t.Fatal("incorrect canonical username", p.Username)
	}
	register("other@example.test", "ALICE_02", 409)
	// Pre-username accounts may also predate immutable IDs. Their session and notices use the original actor key.
	const email = "legacy@example.test"
	const actor = "local:" + email
	tx, err := db.db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	state, err := db.loadState(tx)
	if err != nil {
		t.Fatal(err)
	}
	state.Accounts[actor] = models.Profile{Name: "Старый профиль", Email: email, Role: "Ученик"}
	state.Notices = map[string][]models.Notice{actor: {{ID: "before", Text: "Ранее получено"}}}
	if err := saveState(tx, state); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	legacy, token := send("", command{"type": "login", "email": "Legacy@example.test"}, 200)
	if legacy.Profile.Username != "" || len(legacy.Data.Notices) != 1 || legacy.Data.Notices[0].ID != "before" {
		t.Fatal("legacy account lost")
	}
	edit := func(username string, status int) {
		send(*token, command{"type": "profile", "edits": command{"name": "Прежний пользователь", "email": "changed@example.test", "username": username}}, status)
	}
	edit("@Alice_02", 409)
	edit("", 400)
	edit("@Legacy_Account", 200)
	got, _ := send("", command{"type": "login", "email": "changed@example.test"}, 200)
	if got.Profile.Username != "legacy_account" || models.ActorID(*got.Profile) != actor || len(got.Data.Notices) != 1 || got.Data.Notices[0].ID != "before" {
		t.Fatalf("legacy account no longer references the original data: %+v", got.Profile)
	}
	_, owner := send("", command{"type": "login", "email": "new@example.test"}, 200)
	send(*owner, command{"type": "plan", "plan": "business"}, 200)
	created, _ := send(*owner, command{"type": "team-create", "name": "Тест"}, 200)
	team := created.Data.Teams[0]
	added, _ := send(*owner, command{"type": "team-member", "teamId": team.ID, "username": "legacy_account"}, 200)
	roster, err := json.Marshal(added.Data.Teams)
	if err != nil || strings.Contains(string(roster), email) || strings.Contains(string(roster), "changed@example.test") {
		t.Fatalf("legacy email in roster: %s", roster)
	}
	member := added.Data.Teams[0].Members[1]
	if member.Username != "legacy_account" {
		t.Fatal("missing legacy member")
	}
	own, err := db.ReadWorkspace(*token)
	if err != nil || own.Data.Teams[0].Members[1].ID != actor {
		t.Fatal("legacy member cannot identify own membership")
	}
	removed, _ := send(*owner, command{"type": "team-member", "teamId": team.ID, "remove": true, "memberId": member.ID}, 200)
	if len(removed.Data.Teams[0].Members) != 1 {
		t.Fatal("opaque roster id unusable for removal")
	}
}

func TestDemoUsernameMigration(t *testing.T) {
	state := &models.State{Accounts: map[string]models.Profile{
		"demo-v1-admin":  {ID: "demo-v1-admin", Username: "my_admin"},
		"demo-v1-member": {ID: "demo-v1-member"},
		"existing-user":  {ID: "existing-user", Username: "demo_member"},
	}}
	if !seedDemoUsernames(state) || seedDemoUsernames(state) {
		t.Fatal("migration should change state exactly once")
	}
	if state.Accounts["demo-v1-member"].Username != "demo_member_2" || state.Accounts["demo-v1-admin"].Username != "my_admin" || state.Accounts["existing-user"].Username != "demo_member" {
		t.Fatal("migration overwrote a reserved or personalized username")
	}
}
