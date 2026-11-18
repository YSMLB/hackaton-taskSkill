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

	// Register Admin
	regAdmin, _ := json.Marshal(map[string]any{
		"type": "register",
		"profile": map[string]any{
			"email": "admin@test.ru",
			"name":  "Админ Тест",
			"role":  "Администратор",
		},
	})
	_, adminToken, err := store.ChangeWorkspace("", regAdmin)
	if err != nil {
		t.Fatalf("admin register failed: %v", err)
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
}
