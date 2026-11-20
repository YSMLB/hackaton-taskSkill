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
			Model    string
			Messages []struct {
				Role    string
				Content json.RawMessage
			}
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || len(payload.Messages) != 4 {
			t.Errorf("invalid request: %v", err)
			return
		}
		if payload.Model != "vision" {
			t.Error("screenshot routed to text model")
		}
		if payload.Messages[1].Role != "user" || string(payload.Messages[1].Content) != `"Как начать?"` || payload.Messages[2].Role != "assistant" || string(payload.Messages[2].Content) != `"Открой методичку."` || payload.Messages[3].Role != "user" {
			t.Error("invalid conversation order")
		}
		var parts []struct {
			Type     string
			Text     string
			ImageURL struct{ URL string } `json:"image_url"`
		}
		if err := json.Unmarshal(payload.Messages[3].Content, &parts); err != nil || len(parts) != 2 {
			t.Errorf("invalid message parts: %v", err)
			return
		}
		var lesson struct {
			Step            models.Step
			CompletedBefore []string

			Question string
		}
		if err := json.Unmarshal([]byte(parts[0].Text), &lesson); err != nil {
			t.Error(err)
			return
		}
		if lesson.Step.ID != "" || lesson.Step.Text != "Укажи единицы измерения." ||
			len(lesson.CompletedBefore) != 1 || lesson.CompletedBefore[0] != "Собери материалы" ||

			lesson.Question != "Что значит ошибка?" || parts[1].ImageURL.URL != image {
			t.Errorf("unexpected context: %+v, attachment %+v", lesson, parts[1])
		}
		w.Write([]byte(`{"choices":[{"message":{"content":"{\"safety\":\"allow\",\"hint\":\"Сверь обозначения с методичкой.\"}"}}]}`))
	}))
	defer server.Close()
	t.Setenv("AI_BASE_URL", server.URL)
	t.Setenv("AI_API_KEY", "test")
	t.Setenv("AI_MODEL", "vision")
	t.Setenv("AI_CHAT_MODEL", "text")
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

func TestGeneralChatKeepsLastQuestionAndSelectsTextModel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			Model    string
			Messages []struct{ Role, Content string }
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Error(err)
			return
		}
		if payload.Model != "text" || len(payload.Messages) != 4 {
			t.Errorf("unexpected model or messages: %s %d", payload.Model, len(payload.Messages))
			return
		}
		if payload.Messages[1].Content != "С чего начать?" || payload.Messages[2].Role != "assistant" || payload.Messages[3].Role != "user" || payload.Messages[3].Content != "А дальше?" {
			t.Error("lost conversational context")
		}
		w.Write([]byte(`{"choices":[{"message":{"content":"{\"safety\":\"allow\",\"hint\":\"Следующий шаг.\"}"}}]}`))
	}))
	defer server.Close()
	t.Setenv("AI_BASE_URL", server.URL)
	t.Setenv("AI_API_KEY", "test")
	t.Setenv("AI_MODEL", "vision")
	t.Setenv("AI_CHAT_MODEL", "text")
	_, err := ai.ReplyToChat(context.Background(), "А дальше?", []ai.HintTurn{{Question: "С чего начать?", Answer: "Включи монитор."}}, "")
	if err != nil {
		t.Fatal(err)
	}
}
