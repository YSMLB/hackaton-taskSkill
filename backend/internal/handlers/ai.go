package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"stepflow/backend/internal/ai"
	"stepflow/backend/internal/storage"
)

func (s *Server) HandleGenerateGuide(w http.ResponseWriter, r *http.Request) {
	site := r.Header.Get("sec-fetch-site")
	if site != "" && site != "same-origin" && site != "none" {
		s.writeError(w, storage.NewWorkspaceError("Запрос должен быть отправлен из StepFlow.", http.StatusForbidden))
		return
	}

	contentType := r.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "application/json") {
		s.writeError(w, storage.NewWorkspaceError("Ожидается JSON.", http.StatusUnsupportedMediaType))
		return
	}

	var token string
	if cookie, err := r.Cookie(storage.SessionCookie); err == nil {
		token = cookie.Value
	}

	profile, err := s.Store.GetProfile(token)
	if err != nil {
		s.writeError(w, err)
		return
	}
	if profile == nil {
		s.writeError(w, storage.NewWorkspaceError("Войди в аккаунт, чтобы продолжить.", http.StatusUnauthorized))
		return
	}
	if profile.Role != "Автор" && profile.Role != "Администратор" {
		s.writeError(w, storage.NewWorkspaceError("Генерация черновиков доступна только авторам и администраторам.", http.StatusForbidden))
		return
	}

	if !ai.IsConfigured() {
		s.writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"code":    "NOT_CONFIGURED",
			"message": "ИИ-сервис генерации не настроен на сервере.",
		}, map[string]string{"Cache-Control": "no-store"})
		return
	}

	bodyReader := http.MaxBytesReader(w, r.Body, 100*1024)
	body, err := io.ReadAll(bodyReader)
	if err != nil {
		s.writeError(w, storage.NewWorkspaceError("Слишком большой запрос.", http.StatusRequestEntityTooLarge))
		return
	}

	var req ai.GenerateGuideRequest
	if err := json.Unmarshal(body, &req); err != nil {
		s.writeError(w, storage.NewWorkspaceError("Некорректный JSON.", http.StatusBadRequest))
		return
	}

	prompt := strings.TrimSpace(req.Prompt)
	if len([]rune(prompt)) < 5 || len([]rune(prompt)) > 1000 {
		s.writeError(w, storage.NewWorkspaceError("Опиши тему инструкции подробнее (от 5 до 1000 символов).", http.StatusBadRequest))
		return
	}

	variants, err := ai.GenerateGuideVariants(r.Context(), prompt, req.Category, req.Minutes, profile)
	fallback := err != nil && r.Context().Err() == nil
	if fallback {
		category, minutes := req.Category, req.Minutes
		if category == "" {
			category = "Учёба"
		}
		if minutes < 5 || minutes > 1440 {
			minutes = 20
		}
		guide, fallbackErr := ai.FallbackGuideDraft(prompt, category, minutes, profile)
		if fallbackErr == nil {
			variants = append(variants, *guide)
			err = nil
		}
	}
	if err != nil {
		s.writeJSON(w, http.StatusBadGateway, map[string]string{
			"message": "Не удалось получить варианты. Попробуй ещё раз или продолжи вручную.",
		}, nil)
		return
	}

	s.writeJSON(w, http.StatusOK, ai.GenerateGuideResponse{
		Variants: variants,
		Fallback: fallback,
	}, map[string]string{
		"Cache-Control": "private, no-store",
	})
}
