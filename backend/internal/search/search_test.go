package search

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
)

func TestSearchResponseFormat(t *testing.T) {
	for _, tc := range []struct {
		name      string
		plainOnly bool
		response  string
	}{
		{"JSON object", false, `{"ids":["guide","invented","guide"]}`},
		{"plain chat provider", true, `["guide","invented","guide"]`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				var request struct {
					Format map[string]string `json:"response_format"`
				}
				if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
					t.Error(err)
					return
				}
				if calls == 1 && request.Format["type"] != "json_object" {
					t.Error("expected structured JSON request")
				}
				if calls == 2 && request.Format != nil {
					t.Error("expected plain retry")
				}
				if tc.plainOnly && calls == 1 {
					w.WriteHeader(http.StatusBadRequest)
					return
				}
				json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]string{"content": tc.response}}}})
			}))
			defer provider.Close()
			t.Setenv("AI_BASE_URL", provider.URL)
			t.Setenv("AI_MODEL", "local")
			t.Setenv("AI_API_KEY", "local")
			ids, err := PerformAISearch(context.Background(), "query", []SearchCandidate{{ID: "guide"}})
			if err != nil || !slices.Equal(ids, []string{"guide"}) {
				t.Fatalf("result %v, error %v", ids, err)
			}
		})
	}
}
