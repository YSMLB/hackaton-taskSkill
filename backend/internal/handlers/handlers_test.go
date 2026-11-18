package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"stepflow/backend/internal/handlers"
	"stepflow/backend/internal/storage"
)

func setupTestServer(t *testing.T) (*handlers.Server, func()) {
	tmpDir, err := os.MkdirTemp("", "stepflow-handlers-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	dbFile := filepath.Join(tmpDir, "test.sqlite")
	store, err := storage.New(dbFile)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}

	srv := handlers.NewServer(store)
	cleanup := func() {
		_ = store.Close()
		_ = os.RemoveAll(tmpDir)
	}
	return srv, cleanup
}

func TestHandlersFlow(t *testing.T) {
	srv, cleanup := setupTestServer(t)
	defer cleanup()

	// 1. Health check
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	srv.HandleHealth(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// 2. Search GET
	req = httptest.NewRequest(http.MethodGet, "/api/search", nil)
	w = httptest.NewRecorder()
	srv.HandleSearchGet(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// 3. Workspace GET (initial)
	req = httptest.NewRequest(http.MethodGet, "/api/workspace", nil)
	w = httptest.NewRecorder()
	srv.HandleWorkspaceGet(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// 4. Sec-Fetch-Site security check on POST
	req = httptest.NewRequest(http.MethodPost, "/api/workspace", bytes.NewReader([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Sec-Fetch-Site", "cross-site")
	w = httptest.NewRecorder()
	srv.HandleWorkspacePost(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 on cross-site sec-fetch-site, got %d", w.Code)
	}

	// 5. Register user via POST
	regBody, _ := json.Marshal(map[string]any{
		"type": "register",
		"profile": map[string]any{
			"email": "student@test.ru",
			"name":  "Ученик Вася",
			"role":  "Ученик",
		},
	})
	req = httptest.NewRequest(http.MethodPost, "/api/workspace", bytes.NewReader(regBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	w = httptest.NewRecorder()
	srv.HandleWorkspacePost(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 on register, got %d: %s", w.Code, w.Body.String())
	}

	// Check cookie
	cookies := w.Result().Cookies()
	var sessionCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == storage.SessionCookie {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil || sessionCookie.Value == "" {
		t.Fatalf("expected session cookie to be set")
	}

	// 6. Get guide by ID
	req = httptest.NewRequest(http.MethodGet, "/api/guides/g-docker-prod", nil)
	req.SetPathValue("id", "g-docker-prod")
	w = httptest.NewRecorder()
	srv.HandleGuideGet(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 on guide get, got %d", w.Code)
	}
}
