package ai_test

import (
	"testing"

	"stepflow/backend/internal/ai"
	"stepflow/backend/internal/models"
)

func TestCleanCodeFence(t *testing.T) {
	cases := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "plain json",
			input:    `{"title":"test"}`,
			expected: `{"title":"test"}`,
		},
		{
			name: "markdown json code block",
			input: "```json\n{\"title\":\"test\"}\n```",
			expected: `{"title":"test"}`,
		},
		{
			name: "markdown generic code block",
			input: "```\n{\"title\":\"test\"}\n```",
			expected: `{"title":"test"}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ai.CleanCodeFence(tc.input)
			if got != tc.expected {
				t.Fatalf("expected %q, got %q", tc.expected, got)
			}
		})
	}
}

func TestSanitizeGuideOutput(t *testing.T) {
	codeSnippet := "docker compose up -d"
	filename := "terminal"

	raw := ai.RawGuideOutput{
		Title:       "  Инструкция по Docker  ",
		Description: "Описание",
		Category:    "DevOps",
		Minutes:     25,
		Steps: []ai.RawStep{
			{
				ID:       "s1",
				Title:    "Шаг первый",
				Text:     "Текст шага",
				Code:     &codeSnippet,
				Filename: &filename,
				Checks:   []string{"Пункт 1", "  Пункт 2  "},
			},
			{
				ID:       "", // should auto-generate step-2
				Title:    "", // should auto-generate Шаг 2
				Text:     "Текст второго шага",
				Checks:   []string{}, // should provide default check
			},
		},
	}

	author := &models.Profile{
		ID:    "author-123",
		Name:  "Алиса Автор",
		Email: "alice@test.ru",
		Role:  "Автор",
	}

	guide, err := ai.SanitizeGuideOutput(raw, "Учёба", 20, author)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if guide.Title != "Инструкция по Docker" {
		t.Fatalf("unexpected title: %q", guide.Title)
	}
	if guide.Status != models.StatusDraft {
		t.Fatalf("expected draft status, got %q", guide.Status)
	}
	if guide.Author != "Алиса Автор" || guide.OwnerID != "author-123" {
		t.Fatalf("unexpected author: %q, ownerId: %q", guide.Author, guide.OwnerID)
	}
	if len(guide.Steps) != 2 {
		t.Fatalf("expected 2 steps, got %d", len(guide.Steps))
	}
	if guide.Steps[0].Checks[1] != "Пункт 2" {
		t.Fatalf("expected trimmed check 'Пункт 2', got %q", guide.Steps[0].Checks[1])
	}
	if guide.Steps[1].ID != "step-2" {
		t.Fatalf("expected generated ID 'step-2', got %q", guide.Steps[1].ID)
	}
	if guide.Steps[1].Title != "Шаг 2" {
		t.Fatalf("expected generated title 'Шаг 2', got %q", guide.Steps[1].Title)
	}
	if len(guide.Steps[1].Checks) == 0 || guide.Steps[1].Checks[0] != "Шаг выполнен успешно" {
		t.Fatalf("expected default check, got %+v", guide.Steps[1].Checks)
	}
}
