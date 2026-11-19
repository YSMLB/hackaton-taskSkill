package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"stepflow/backend/internal/models"
)

func TestReviewGuideProviderContract(t *testing.T) {
	const reason = "Каждый шаг можно проверить."
	result := `{"decision":"approve","reason":"` + reason + `"}`
	calls := 0
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path != "/v1/chat/completions" || r.Header.Get("Authorization") != "Bearer test" {
			t.Error("unexpected provider request")
		}
		json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]string{"content": result}}}})
	}))
	defer provider.Close()
	t.Setenv("AI_API_KEY", "test")
	t.Setenv("AI_BASE_URL", provider.URL+"/v1")
	t.Setenv("AI_MODEL", "fake")
	guide := models.Instruction{Title: "Заметка", Steps: []models.Step{{Title: "Сохраните файл", Checks: []string{"Файл есть"}}}}
	got, err := reviewGuide(context.Background(), guide)
	if err != nil || got.Decision != "approve" || got.Reason != reason {
		t.Fatalf("verdict: %#v, %v", got, err)
	}
	for _, invalid := range []string{`{"decision":"maybe","reason":"неясно"}`, `{"decision":"reject","reason":""}`, `Модель не уверена. {"decision":"approve","reason":"да"}`} {
		result = invalid
		if _, err = reviewGuide(context.Background(), guide); err == nil {
			t.Fatalf("accepted invalid response: %q", invalid)
		}
	}
	guide.Steps[0].VideoURL = "https://example.test/video"
	got, err = reviewGuide(context.Background(), guide)
	if err != nil || got.Decision != "manual" || calls != 4 {
		t.Fatal("media must be reserved for human review")
	}
}
