package ai

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
	"strings"
	"time"
)

func IsConfigured() bool {
	return os.Getenv("AI_API_KEY") != "" &&
		os.Getenv("AI_BASE_URL") != "" &&
		os.Getenv("AI_MODEL") != ""
}

type chatMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

func chatCompletion(ctx context.Context, system string, user any, temperature float64, timeout time.Duration) (string, error) {
	return chatCompletionWithFormat(ctx, system, user, temperature, timeout, "")
}

func chatCompletionJSON(ctx context.Context, system string, user any, temperature float64, timeout time.Duration) (string, error) {
	return chatCompletionWithFormat(ctx, system, user, temperature, timeout, "json_object")
}

func chatCompletionWithFormat(ctx context.Context, system string, user any, temperature float64, timeout time.Duration, format string) (string, error) {
	if !IsConfigured() {
		return "", errors.New("ИИ-сервис не настроен")
	}
	baseURL := os.Getenv("AI_BASE_URL")
	base, err := url.Parse(baseURL)
	if err != nil {
		return "", err
	}
	isLocal := base.Hostname() == "localhost" || base.Hostname() == "127.0.0.1" || base.Hostname() == "::1"
	if base.Scheme != "https" && !(base.Scheme == "http" && isLocal) {
		return "", errors.New("небезопасный AI_BASE_URL запрещен")
	}

	type reqPayload struct {
		Model          string            `json:"model"`
		Messages       []chatMessage     `json:"messages"`
		Temperature    float64           `json:"temperature"`
		ResponseFormat map[string]string `json:"response_format,omitempty"`
	}

	payload := reqPayload{
		Model:       os.Getenv("AI_MODEL"),
		Temperature: temperature,
		Messages:    []chatMessage{{Role: "system", Content: system}, {Role: "user", Content: user}},
	}
	if format != "" {
		payload.ResponseFormat = map[string]string{"type": format}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(baseURL, "/")+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("AI_API_KEY"))
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("ИИ-сервис вернул статус %d", resp.StatusCode)
	}
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 512*1024)).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Choices) == 0 || strings.TrimSpace(result.Choices[0].Message.Content) == "" {
		return "", errors.New("ИИ вернул пустой ответ")
	}
	return strings.TrimSpace(result.Choices[0].Message.Content), nil
}
