package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"stepflow/backend/internal/provider"
	"stepflow/backend/internal/storage"
)

func TestAllAIEndpointsWithholdBlockedAndUnclassifiedContent(t *testing.T) {
	srv, cleanup := setupTestServer(t)
	defer cleanup()
	_, token, err := srv.Store.ChangeWorkspace("", []byte(`{"type":"register","profile":{"email":"guard@example.test","username":"guard_test","name":"Ученик","role":"Ученик"}}`))
	if err != nil || token == nil {
		t.Fatalf("register learner: %v", err)
	}
	const privateText = "PRIVATE_TEST_MARKER"
	var response atomic.Value
	var calls atomic.Int32
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		var request struct {
			Messages []struct{ Content json.RawMessage }
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil || len(request.Messages) == 0 {
			t.Error("missing model messages")
			return
		}
		var system string
		if err := json.Unmarshal(request.Messages[0].Content, &system); err != nil || !strings.Contains(system, provider.ContentRules) {
			t.Error("missing content policy")
		}
		json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]string{"content": response.Load().(string)}}}})
	}))
	defer mock.Close()
	t.Setenv("AI_BASE_URL", mock.URL)
	t.Setenv("AI_MODEL", "vision")
	t.Setenv("AI_API_KEY", "test")
	for _, verdict := range []struct {
		name   string
		result string
		status int
	}{
		{"blocked", `{"safety":"block","hint":"PRIVATE_TEST_MARKER","terms":[],"variants":[]}`, 422},
		{"unclassified", `{"hint":"PRIVATE_TEST_MARKER","terms":[],"variants":[]}`, 502},
	} {
		response.Store(verdict.result)
		for _, endpoint := range []struct {
			name   string
			handle http.HandlerFunc
			input  string
		}{
			{"search", srv.HandleSearchPost, `{"query":"График","candidates":[{"id":"guide","title":"График"}]}`},
			{"generate", srv.HandleGenerateGuide, `{"prompt":"Как оформить отчёт?"}`},
			{"chat", srv.HandleChat, `{"question":"А потом?","history":[{"question":"Начать?","answer":"Открой учебник."}]}`},
			{"step", srv.HandleStepHint, `{"guideId":"lab-report","stepId":"lab-1","screenshot":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSWAAAAAASUVORK5CYII="}`},
		} {
			t.Run(verdict.name+"/"+endpoint.name, func(t *testing.T) {
				before := calls.Load()
				req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(endpoint.input))
				req.Header.Set("Content-Type", "application/json")
				req.AddCookie(&http.Cookie{Name: storage.SessionCookie, Value: *token})
				rec := httptest.NewRecorder()
				endpoint.handle(rec, req)
				if rec.Code != verdict.status || strings.Contains(rec.Body.String(), privateText) || calls.Load() != before+1 {
					t.Fatalf("status %d, provider calls %d, body %s", rec.Code, calls.Load()-before, rec.Body)
				}
				if verdict.status == http.StatusUnprocessableEntity && !strings.Contains(rec.Body.String(), "AI_CONTENT_BLOCKED") {
					t.Error("missing refusal code")
				}
			})
		}
	}
}
