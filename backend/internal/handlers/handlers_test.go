package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
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
	t.Setenv("AI_API_KEY", "")
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
			"username": "student", "email": "student@test.ru",
			"name": "Ученик Вася",
			"role": "Ученик",
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

	// 7. Test AI Generate without session (should return 401)
	genReq := httptest.NewRequest(http.MethodPost, "/api/ai/generate-guide", bytes.NewReader([]byte(`{"prompt":"Deploy Docker"}`)))
	genReq.Header.Set("Content-Type", "application/json")
	genReq.Header.Set("Sec-Fetch-Site", "same-origin")
	w = httptest.NewRecorder()
	srv.HandleGenerateGuide(w, genReq)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 unauthorized without cookie, got %d", w.Code)
	}

	// 8. A learner can generate drafts when the provider is configured
	genReq = httptest.NewRequest(http.MethodPost, "/api/ai/generate-guide", bytes.NewReader([]byte(`{"prompt":"Deploy Docker"}`)))
	genReq.Header.Set("Content-Type", "application/json")
	genReq.Header.Set("Sec-Fetch-Site", "same-origin")
	genReq.AddCookie(sessionCookie)
	w = httptest.NewRecorder()
	srv.HandleGenerateGuide(w, genReq)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 for learner with unconfigured provider, got %d", w.Code)
	}

	// 9. Register Author & test AI Generate when unconfigured (should return 503)
	authorReg, _ := json.Marshal(map[string]any{
		"type": "register",
		"profile": map[string]any{
			"username": "author_gen", "email": "author_gen@test.ru",
			"name": "Автор Гена",
			"role": "Автор",
		},
	})
	req = httptest.NewRequest(http.MethodPost, "/api/workspace", bytes.NewReader(authorReg))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	w = httptest.NewRecorder()
	srv.HandleWorkspacePost(w, req)
	authorCookie := w.Result().Cookies()[0]

	genReq = httptest.NewRequest(http.MethodPost, "/api/ai/generate-guide", bytes.NewReader([]byte(`{"prompt":"Deploy Docker"}`)))
	genReq.Header.Set("Content-Type", "application/json")
	genReq.Header.Set("Sec-Fetch-Site", "same-origin")
	genReq.AddCookie(authorCookie)
	w = httptest.NewRecorder()
	srv.HandleGenerateGuide(w, genReq)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when AI unconfigured, got %d: %s", w.Code, w.Body.String())
	}

	t.Run("learner step hint", func(t *testing.T) {
		hintRequest := func(step string, cookie *http.Cookie) *httptest.ResponseRecorder {
			input, err := json.Marshal(map[string]string{
				"guideId": "lab-report", "stepId": step, "question": "Где взять шаблон?",
			})
			if err != nil {
				t.Fatal(err)
			}
			req := httptest.NewRequest(http.MethodPost, "/api/ai/step-hint", bytes.NewReader(input))
			req.Header.Set("Content-Type", "application/json")
			if cookie != nil {
				req.AddCookie(cookie)
			}
			response := httptest.NewRecorder()
			srv.HandleStepHint(response, req)
			return response
		}
		for _, tt := range []struct {
			step   string
			cookie *http.Cookie
			want   int
		}{
			{"lab-1", nil, http.StatusUnauthorized},
			{"missing-step", sessionCookie, http.StatusNotFound},
			{"lab-1", sessionCookie, http.StatusServiceUnavailable},
		} {
			if got := hintRequest(tt.step, tt.cookie); got.Code != tt.want {
				t.Fatalf("hint status %d, want %d: %s", got.Code, tt.want, got.Body.String())
			}
		}
		provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var input struct{ Messages []struct{ Content string } }
			if err := json.NewDecoder(r.Body).Decode(&input); err != nil || len(input.Messages) != 2 {
				t.Errorf("invalid model request: %v", err)
				return
			}
			context := input.Messages[1].Content
			for _, content := range []string{"Собери материалы", "Где взять шаблон?", "checks"} {
				if !strings.Contains(context, content) {
					t.Errorf("missing %q in model request", content)
				}
			}
			w.Write([]byte(`{"choices":[{"message":{"content":"{\"safety\":\"allow\",\"hint\":\"Начни с задания и журнала опыта.\"}"}}]}`))
		}))
		defer provider.Close()
		t.Setenv("AI_BASE_URL", provider.URL+"/v1")
		t.Setenv("AI_MODEL", "test")
		t.Setenv("AI_API_KEY", "test")
		got := hintRequest("lab-1", sessionCookie)
		if got.Code != http.StatusOK || !strings.Contains(got.Body.String(), "Начни с задания") {
			t.Fatalf("unexpected hint: %d %s", got.Code, got.Body.String())
		}
	})
}
