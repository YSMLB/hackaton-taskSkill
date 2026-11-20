package search

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"
	"unicode"

	"stepflow/backend/internal/provider"
)

type SearchCandidate struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Steps       []string `json:"steps"`
}

type SearchRequest struct {
	Query      string            `json:"query"`
	Candidates []SearchCandidate `json:"candidates"`
}

type SearchResponse struct {
	IDs  []string `json:"ids"`
	Mode string   `json:"mode"`
}

func IsConfigured() bool { return provider.Configured() }

func PerformAISearch(ctx context.Context, query string, candidates []SearchCandidate) ([]string, error) {
	if len(candidates) == 0 {
		return []string{}, nil
	}

	baseURLStr := os.Getenv("AI_BASE_URL")
	base, err := url.Parse(baseURLStr)
	if err != nil {
		return nil, errors.New("invalid AI_BASE_URL")
	}

	isLocal := base.Hostname() == "localhost" || base.Hostname() == "127.0.0.1" || base.Hostname() == "::1"
	if base.Scheme != "https" && !(base.Scheme == "http" && isLocal) {
		return nil, errors.New("insecure AI_BASE_URL not permitted")
	}

	apiURL := fmt.Sprintf("%s/chat/completions", strings.TrimRight(baseURLStr, "/"))

	type chatMessage struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	type chatRequest struct {
		Model          string            `json:"model"`
		Messages       []chatMessage     `json:"messages"`
		ResponseFormat map[string]string `json:"response_format,omitempty"`
		Temperature    float64           `json:"temperature"`
	}

	payload := chatRequest{
		ResponseFormat: map[string]string{"type": "json_object"},
		Model:          os.Getenv("AI_MODEL"),
		Messages: []chatMessage{
			{
				Role: "system",
				Content: `Ты расширяешь запрос для поиска в русскоязычном каталоге. В поле terms укажи до восьми конкретных ключевых слов или коротких фраз, обозначающих тот же предмет или действие. Предпочитай русские существительные в именительном падеже. Названия программ и инструментов оставляй в оригинале. Не включай общие слова, названия универсальных действий, категории или отдалённые ассоциации. Если близких терминов нет, верни пустой массив terms.` + provider.ContentRules + `
Формат разрешённого ответа: {"safety":"allow","terms":["синоним","название инструмента"]}.`,
			},
			{
				Role:    "user",
				Content: query,
			},
		},
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	release, err := provider.Acquire(ctx, isLocal)
	if err != nil {
		return nil, err
	}
	defer release()
	send := func() (*http.Response, error) {
		body, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+os.Getenv("AI_API_KEY"))
		req.Header.Set("Content-Type", "application/json")
		return http.DefaultClient.Do(req)
	}
	resp, err := send()
	if err != nil {
		return nil, err
	}
	// Older providers may reject the JSON output option.
	if resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnprocessableEntity {
		resp.Body.Close()
		payload.ResponseFormat = nil
		resp, err = send()
		if err != nil {
			return nil, err
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("AI service returned status %d", resp.StatusCode)
	}

	var chatResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&chatResp); err != nil {
		return nil, err
	}

	if len(chatResp.Choices) == 0 {
		return nil, errors.New("no choices returned from AI")
	}

	var expansion struct {
		Terms []string `json:"terms"`
	}
	if err := provider.DecodeGuardedJSON(chatResp.Choices[0].Message.Content, &expansion); err != nil {
		return nil, err
	}
	if expansion.Terms == nil {
		return nil, errors.New("AI search response must contain a terms array")
	}
	return rankCandidates(query, expansion.Terms, candidates), nil
}

// Fold common Russian noun/adjective endings so alternative forms supplied by the model
// also match an inflected title. Keep technical names and short words intact.
func searchWords(s string) []string {
	words := strings.FieldsFunc(strings.ReplaceAll(strings.ToLower(s), "ё", "е"), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})
	filtered := make([]string, 0, len(words))
	for _, word := range words {
		if len([]rune(word)) < 2 || genericWords[word] {
			continue
		}
		for _, suffix := range []string{"иями", "ами", "ями", "ого", "ему", "ому", "ыми", "ими", "ия", "ию", "ии", "ам", "ям", "ом", "ем", "ах", "ях", "ов", "ев", "ей", "ый", "ий", "ой", "ая", "ое", "ые", "их", "ых", "а", "я", "ы", "и", "у", "ю", "е", "о"} {
			if root, found := strings.CutSuffix(word, suffix); found && len([]rune(root)) >= 4 {
				word = root
				break
			}
		}
		filtered = append(filtered, word)
	}
	return filtered
}

var genericWords = map[string]bool{
	"как": true, "для": true, "или": true, "на": true, "из": true, "во": true, "по": true, "за": true, "со": true,
	"мне": true, "мой": true, "что": true, "где": true, "чтобы": true, "нужно": true, "хочу": true,
	"помоги": true, "пожалуйста": true, "сделать": true, "составить": true, "создать": true, "найти": true,
	"инструкция": true, "инструкцию": true, "инструкции": true, "шаг": true, "шаги": true, "способ": true, "учеба": true,
}

func rankCandidates(query string, expansion []string, candidates []SearchCandidate) []string {
	// Each phrase is matched as a whole, without matching fragments inside other words.
	weights := map[string]int{}
	for _, term := range expansion[:min(len(expansion), 8)] {
		words := searchWords(term)
		if len(words) > 0 && len(words) <= 4 {
			weights[" "+strings.Join(words, " ")+" "] = 1
		}
	}
	for _, word := range searchWords(query) {
		weights[" "+word+" "] = 3
	}
	type match struct {
		id    string
		score int
	}
	var matches []match
	seen := map[string]bool{}
	for _, c := range candidates {
		if seen[c.ID] {
			continue
		}
		seen[c.ID] = true
		title := " " + strings.Join(searchWords(c.Title), " ") + " "
		fields := append([]string{c.Description, c.Category}, c.Steps...)
		var body strings.Builder
		for _, field := range fields {
			body.WriteString(" " + strings.Join(searchWords(field), " ") + " |")
		}
		text := body.String()
		score := 0
		for phrase, weight := range weights {
			if strings.Contains(title, phrase) {
				score += 3 * weight
			} else if strings.Contains(text, phrase) {
				score += weight
			}
		}
		if score > 0 {
			matches = append(matches, match{c.ID, score})
		}
	}
	sort.SliceStable(matches, func(i, j int) bool { return matches[i].score > matches[j].score })
	ids := make([]string, 0, min(10, len(matches)))
	for _, m := range matches[:min(10, len(matches))] {
		ids = append(ids, m.id)
	}
	return ids
}
