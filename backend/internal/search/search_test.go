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
		{"JSON object", false, `{"safety":"allow","terms":["chart","figure"]}`},
		{"plain chat provider", true, `{"safety":"allow","terms":["chart","figure"]}`},
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
			ids, err := PerformAISearch(context.Background(), "query", []SearchCandidate{{ID: "guide", Title: "A chart"}})
			if err != nil || !slices.Equal(ids, []string{"guide"}) {
				t.Fatalf("result %v, error %v", ids, err)
			}
		})
	}
}

func TestRankingAcrossCategory(t *testing.T) {
	candidates := []SearchCandidate{{ID: "slides", Title: "Добавить диаграмму"}, {ID: "charts", Steps: []string{"Построить график"}}}
	for _, tc := range []struct {
		name, query string
		terms       []string
		ids         []string
	}{
		{"two semantic matches", "визуализация данных", []string{"диаграмма", "график"}, []string{"slides", "charts"}},
		{"catalog irrelevant", "контейнеры Docker", []string{"docker compose", "контейнеризация"}, []string{}},
		{"no invented matches", "написать отчёт", nil, []string{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ids := rankCandidates(tc.query, tc.terms, candidates)
			if !slices.Equal(ids, tc.ids) {
				t.Fatalf("got ids=%v", ids)
			}
		})
	}
}
