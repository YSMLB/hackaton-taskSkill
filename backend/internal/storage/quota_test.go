package storage

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"stepflow/backend/internal/models"
	"testing"
	"time"
)

func TestPersonalQuotaAndPlusTrial(t *testing.T) {
	db, err := New(filepath.Join(t.TempDir(), "quota.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	type payload = map[string]any
	login, token, err := db.ChangeWorkspace("", []byte(`{"type":"register","profile":{"email":"quota@example.test","name":"Quota","username":"quota"}}`))
	if err != nil {
		t.Fatal(err)
	}
	send := func(body payload, status int) *models.CommandResult {
		t.Helper()
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		result, _, err := db.ChangeWorkspace(*token, raw)
		if status == 200 && err == nil {
			return result
		}
		var problem *WorkspaceError
		if !errors.As(err, &problem) || problem.Status != status {
			t.Fatalf("%v: want %d, got %v", body["type"], status, err)
		}
		return nil
	}
	fork := payload{"type": "fork", "guideId": login.Data.Guides[0].ID}
	var first string
	for range 10 {
		id := send(fork, 200).ID
		if first == "" {
			first = id
		}
	}
	draft := payload{"id": "new", "title": "Новая", "description": "", "minutes": 5, "category": "Учёба", "steps": []payload{{"id": "one", "title": "", "text": "", "checks": []string{}}}}
	send(fork, 409)
	send(payload{"type": "save", "guide": draft}, 409)
	send(payload{"type": "import", "guides": []payload{draft}}, 409)
	send(payload{"type": "delete-guide", "guideId": first, "revision": 0, "status": "draft"}, 200)
	send(fork, 200)
	trial := send(payload{"type": "start-plus-trial"}, 200).Profile
	end := time.UnixMilli(trial.PlusTrialEndsAt)
	if !trial.PlusTrialUsed || trial.Plan != "standard" || time.Until(end) < 27*24*time.Hour || time.Until(end) > 32*24*time.Hour {
		t.Fatal("invalid trial")
	}
	send(payload{"type": "start-plus-trial"}, 409)
	extra := send(fork, 200).ID
	tx, err := db.db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	state, err := db.loadState(tx)
	if err != nil {
		t.Fatal(err)
	}
	trial.PlusTrialEndsAt = time.Now().Add(-time.Minute).UnixMilli()
	state.Accounts[trial.ID] = *trial
	if err = saveState(tx, state); err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(); err != nil {
		t.Fatal(err)
	}
	snap, err := db.ReadWorkspace(*token)
	if err != nil || snap.Profile.Plan != "free" || !snap.Profile.PlusTrialUsed {
		t.Fatal("trial did not expire", err)
	}
	send(fork, 409)
	send(payload{"type": "start-plus-trial"}, 409)
	draft["id"] = extra
	send(payload{"type": "save", "guide": draft, "updateOnly": true}, 200)
	send(payload{"type": "plan", "plan": "standard"}, 200)
	send(fork, 200)
}
