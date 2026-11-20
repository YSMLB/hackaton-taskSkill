package storage

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"slices"
	"stepflow/backend/internal/models"
	"testing"
)

func TestDeleteGuideLifecycle(t *testing.T) {
	t.Setenv("STEPFLOW_DEMO_DATA", "1")
	db, err := New(filepath.Join(t.TempDir(), "delete.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	login := func(email string) string {
		t.Helper()
		body, _ := json.Marshal(map[string]string{"type": "login", "email": email})
		_, token, err := db.ChangeWorkspace("", body)
		if err != nil {
			t.Fatal(err)
		}
		return *token
	}
	owner := login("member@stepflow.test")
	reader := login("learner@stepflow.test")
	cmd := func(token string, payload map[string]any, want int) *models.CommandResult {
		t.Helper()
		body, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		result, _, err := db.ChangeWorkspace(token, body)
		if want == 200 && err == nil {
			return result
		}
		var fault *WorkspaceError
		if !errors.As(err, &fault) || fault.Status != want {
			t.Fatalf("%v: got %v, want %d", payload, err, want)
		}
		return nil
	}
	const published = "demo-v1-published"
	fork := cmd(reader, map[string]any{"type": "fork", "guideId": published}, 200).ID
	for _, status := range []string{"draft", "pending", "rejected", "published", "team-guide"} {
		id := "demo-v1-" + status
		if status == "team-guide" {
			status = "published"
		}
		action := map[string]any{"type": "delete-guide", "guideId": id, "status": status, "revision": 1}
		if status == "published" {
			cmd(reader, action, 403)
		}
		cmd(owner, map[string]any{"type": "delete-guide", "guideId": id, "status": status, "revision": 9}, 409)
		result := cmd(owner, action, 200)
		if slices.ContainsFunc(result.Data.Guides, func(g models.Instruction) bool { return g.ID == id }) {
			t.Fatal("still visible", id)
		}
		cmd(owner, action, 404)
		cmd(owner, map[string]any{"type": "save", "updateOnly": true, "guide": map[string]any{"id": id, "revision": 1}}, 404)
	}
	state, err := db.loadState(nil)
	if err != nil {
		t.Fatal(err)
	}
	if state.Runs[published] != nil || state.Votes[published] != nil || len(state.Reports) != 0 {
		t.Fatal("orphan reader data")
	}
	if !slices.ContainsFunc(state.Guides, func(g models.Instruction) bool { return g.ID == fork && g.Source.ID == published }) {
		t.Fatal("fork lost")
	}
	if err := db.seedDemo(); err != nil {
		t.Fatal(err)
	}
}

func TestDemoSeedIsIdempotent(t *testing.T) {
	t.Setenv("STEPFLOW_DEMO_DATA", "1")
	s, err := New(filepath.Join(t.TempDir(), "demo.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	before, err := s.loadState(nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(before.Accounts) != 4 || len(before.Teams) != 1 || len(before.Reports) != 1 {
		t.Fatal("demo data missing")
	}
	if err = s.seedDemo(); err != nil {
		t.Fatal(err)
	}
	after, err := s.loadState(nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(before.Guides) != len(after.Guides) || len(after.Accounts) != 4 {
		t.Fatal("demo data duplicated")
	}
}

func TestLegacyDemoOwnerCanEditAndSeeAnalytics(t *testing.T) {
	t.Setenv("STEPFLOW_DEMO_DATA", "1")
	store, err := New(filepath.Join(t.TempDir(), "legacy.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	tx, err := store.db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	state, err := store.loadState(tx)
	if err != nil {
		t.Fatal(err)
	}
	for i := range state.Guides {
		state.Guides[i].Owned = false
	}
	if err = saveState(tx, state); err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(); err != nil {
		t.Fatal(err)
	}

	result, _, err := store.ChangeWorkspace("", []byte(`{"type":"login","email":"member@stepflow.test"}`))
	if err != nil {
		t.Fatal(err)
	}
	for _, g := range result.Data.Guides {
		if g.ID == "demo-v1-published" && models.IsOwner(g, result.Profile) {
			if _, ok := result.Data.Analytics[g.ID]; !ok {
				t.Fatal("missing owner analytics")
			}
			return
		}
	}
	t.Fatal("legacy demo guide is unavailable to its author")
}
