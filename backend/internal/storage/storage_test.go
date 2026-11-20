package storage_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"stepflow/backend/internal/models"
	"stepflow/backend/internal/storage"
)

func setupTestStorage(t *testing.T) (*storage.Storage, func()) {
	tmpDir, err := os.MkdirTemp("", "stepflow-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	dbFile := filepath.Join(tmpDir, "test.sqlite")
	store, err := storage.New(dbFile)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}

	cleanup := func() {
		_ = store.Close()
		_ = os.RemoveAll(tmpDir)
	}
	return store, cleanup
}

func TestReadWorkspaceInitial(t *testing.T) {
	store, cleanup := setupTestStorage(t)
	defer cleanup()

	snap, err := store.ReadWorkspace("")
	if err != nil {
		t.Fatalf("ReadWorkspace failed: %v", err)
	}

	if snap.Profile != nil {
		t.Fatalf("expected nil profile, got %+v", snap.Profile)
	}

	if len(snap.Data.Guides) != 3 {
		t.Fatalf("expected 3 initial guides, got %d", len(snap.Data.Guides))
	}

	if snap.Data.Guides[0].ID != "g-docker-prod" {
		t.Fatalf("expected first guide to be g-docker-prod, got %s", snap.Data.Guides[0].ID)
	}
}

func TestRegisterAndLogin(t *testing.T) {
	store, cleanup := setupTestStorage(t)
	defer cleanup()

	regCmd := map[string]any{
		"type": "register",
		"profile": map[string]any{
			"email": "author@stepflow.dev",
			"name":  "Алиса Автор",
			"role":  "Автор",
		},
	}
	regBytes, _ := json.Marshal(regCmd)
	res, token, err := store.ChangeWorkspace("", regBytes)
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}
	if token == nil || *token == "" {
		t.Fatalf("expected non-empty token")
	}
	if res.Profile == nil || res.Profile.Email != "author@stepflow.dev" {
		t.Fatalf("unexpected profile: %+v", res.Profile)
	}

	// Read workspace with token
	snap, err := store.ReadWorkspace(*token)
	if err != nil {
		t.Fatalf("ReadWorkspace failed: %v", err)
	}
	if snap.Profile == nil || snap.Profile.Email != "author@stepflow.dev" {
		t.Fatalf("expected logged in profile, got %+v", snap.Profile)
	}

	// Logout
	logoutCmd := map[string]any{"type": "logout"}
	logoutBytes, _ := json.Marshal(logoutCmd)
	outRes, outToken, err := store.ChangeWorkspace(*token, logoutBytes)
	if err != nil {
		t.Fatalf("Logout failed: %v", err)
	}
	if outRes.Profile != nil {
		t.Fatalf("expected profile to be nil after logout")
	}
	if outToken == nil || *outToken != "" {
		t.Fatalf("expected empty nextToken on logout")
	}

	// Verify logged out
	snapAfter, _ := store.ReadWorkspace(*token)
	if snapAfter.Profile != nil {
		t.Fatalf("expected profile to be nil after session deleted")
	}
}

func TestGuideSaveAndModerate(t *testing.T) {
	t.Setenv("STEPFLOW_DEMO_DATA", "1")
	store, cleanup := setupTestStorage(t)
	defer cleanup()

	// Register Author
	regAuthor, _ := json.Marshal(map[string]any{
		"type": "register",
		"profile": map[string]any{
			"email": "author@test.ru",
			"name":  "Автор Тест",
			"role":  "Автор",
		},
	})
	_, authorToken, err := store.ChangeWorkspace("", regAuthor)
	if err != nil {
		t.Fatalf("author register failed: %v", err)
	}

	_, adminToken, err := store.ChangeWorkspace("", []byte(`{"type":"login","email":"admin@stepflow.test"}`))
	if err != nil {
		t.Fatalf("demo admin login: %v", err)
	}

	// Save guide
	saveCmd, _ := json.Marshal(map[string]any{
		"type":   "save",
		"submit": true,
		"guide": map[string]any{
			"id":          "new-guide",
			"title":       "Новая инструкция",
			"description": "Описание новой инструкции",
			"category":    "ИТ",
			"minutes":     10,
			"steps": []map[string]any{
				{
					"id":     "step-1",
					"title":  "Шаг 1",
					"text":   "Делай раз",
					"checks": []string{"Пункт 1"},
				},
			},
		},
	})

	saveRes, _, err := store.ChangeWorkspace(*authorToken, saveCmd)
	if err != nil {
		t.Fatalf("save guide failed: %v", err)
	}
	if saveRes.ID == "" {
		t.Fatalf("expected returned guide ID")
	}
	guideID := saveRes.ID

	// Moderate (Approve)
	modCmd, _ := json.Marshal(map[string]any{
		"type":     "moderate",
		"guideId":  guideID,
		"decision": "approve",
		"note":     "Отличная работа",
	})

	_, _, err = store.ChangeWorkspace(*adminToken, modCmd)
	if err != nil {
		t.Fatalf("moderate approve failed: %v", err)
	}

	// Verify published guide
	pub, err := store.GetPublishedGuide(guideID)
	if err != nil || pub == nil {
		t.Fatalf("expected published guide, got %v, err: %v", pub, err)
	}
	if pub.Status != models.StatusPublished {
		t.Fatalf("expected status published, got %s", pub.Status)
	}

	t.Run("progress and questions", func(t *testing.T) {
		send := func(token string, command map[string]any) *string {
			t.Helper()
			input, err := json.Marshal(command)
			if err != nil {
				t.Fatal(err)
			}
			_, next, err := store.ChangeWorkspace(token, input)
			if err != nil {
				t.Fatalf("%v: %v", command, err)
			}
			return next
		}
		learner := send("", map[string]any{"type": "register", "profile": map[string]any{
			"email": "learner@example.test", "name": "Ученик", "role": "Ученик",
		}})
		if learner == nil {
			t.Fatal("learner session missing")
		}
		stepID := pub.Steps[0].ID
		visit := map[string]any{"type": "visit", "guideId": guideID, "stepId": stepID}
		send(*learner, visit)
		send(*learner, visit)
		send(*authorToken, visit)
		read := func() models.GuideMetrics {
			t.Helper()
			snapshot, err := store.ReadWorkspace(*authorToken)
			if err != nil {
				t.Fatal(err)
			}
			stats := snapshot.Data.Analytics[guideID]
			if len(stats.Steps) != 1 {
				t.Fatalf("expected one step, got %+v", stats)
			}
			return stats
		}
		if step := read().Steps[0]; step.Started != 1 || step.Stopped != 1 {
			t.Fatalf("expected one learner on the step, got %+v", step)
		}
		for _, question := range []string{"Где взять исходные данные?", "В каком формате сохранить?"} {
			send(*learner, map[string]any{"type": "help", "guideId": guideID, "stepId": stepID, "text": question})
		}
		send(*learner, map[string]any{"type": "check", "guideId": guideID, "stepId": stepID, "index": 0, "checked": true})
		send(*learner, map[string]any{"type": "complete", "guideId": guideID, "stepId": stepID})
		stats := read()
		if step := stats.Steps[0]; step.Started != 1 || step.Stopped != 0 || step.Completed != 1 ||
			step.Questions != 2 || step.QuestionAuthors != 1 {
			t.Fatalf("unexpected metrics after completion: %+v", step)
		}
		if len(stats.Reports) != 2 {
			t.Fatalf("expected both questions in history: %+v", stats.Reports)
		}
		answer := "Сохрани отчёт в PDF."
		send(*authorToken, map[string]any{"type": "reply", "guideId": guideID, "reportId": stats.Reports[1].ID, "text": answer})
		if got := read().Reports[1].Reply; got != answer {
			t.Fatalf("saved reply = %q, want %q", got, answer)
		}
	})
}
