package ai_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"stepflow/backend/internal/ai"
	"stepflow/backend/internal/models"
)

func TestMentorReceivesProgressHistoryAndScreenshot(t *testing.T) {
	image := "data:image/png;base64,example"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			Messages []struct{ Content json.RawMessage }
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || len(payload.Messages) != 2 {
			t.Errorf("invalid request: %v", err)
			return
		}
		var parts []struct {
			Type     string
			Text     string
			ImageURL struct{ URL string } `json:"image_url"`
		}
		if err := json.Unmarshal(payload.Messages[1].Content, &parts); err != nil || len(parts) != 2 {
			t.Errorf("invalid message parts: %v", err)
			return
		}
		var lesson struct {
			Step            models.Step
			CompletedBefore []string
			History         []ai.HintTurn
			Question        string
		}
		if err := json.Unmarshal([]byte(parts[0].Text), &lesson); err != nil {
			t.Error(err)
			return
		}
		if lesson.Step.ID != "" || lesson.Step.Text != "Укажи единицы измерения." ||
			len(lesson.CompletedBefore) != 1 || lesson.CompletedBefore[0] != "Собери материалы" ||
			len(lesson.History) != 1 || lesson.History[0].Answer != "Открой методичку." ||
			lesson.Question != "Что значит ошибка?" || parts[1].ImageURL.URL != image {
			t.Errorf("unexpected context: %+v, attachment %+v", lesson, parts[1])
		}
		w.Write([]byte(`{"choices":[{"message":{"content":"Сверь обозначения с методичкой."}}]}`))
	}))
	defer server.Close()
	t.Setenv("AI_BASE_URL", server.URL)
	t.Setenv("AI_API_KEY", "test")
	t.Setenv("AI_MODEL", "test")
	guide := models.Instruction{Title: "Лабораторная", Steps: []models.Step{
		{ID: "first", Title: "Собери материалы"},
		{ID: "second", Title: "Заполни таблицу", Text: "Укажи единицы измерения."},
		{ID: "third", Title: "Сохрани отчёт"},
	}}
	hint, err := ai.ExplainStep(context.Background(), &guide, guide.Steps[1], []string{"first", "third"},
		"Что значит ошибка?", []ai.HintTurn{{Question: "Как начать?", Answer: "Открой методичку."}}, image)
	if err != nil || hint != "Сверь обозначения с методичкой." {
		t.Fatalf("unexpected hint %q: %v", hint, err)
	}
}
