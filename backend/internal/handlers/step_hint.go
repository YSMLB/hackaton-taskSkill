package handlers

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"stepflow/backend/internal/ai"
	"stepflow/backend/internal/storage"
)

func (s *Server) HandleStepHint(w http.ResponseWriter, r *http.Request) {
	s.handleHint(w, r, false)
}

func (s *Server) HandleChat(w http.ResponseWriter, r *http.Request) {
	s.handleHint(w, r, true)
}

func (s *Server) handleHint(w http.ResponseWriter, r *http.Request, general bool) {
	site := r.Header.Get("Sec-Fetch-Site")
	if site != "" && site != "same-origin" && site != "none" {
		s.writeError(w, storage.NewWorkspaceError("Запрос должен быть отправлен из StepFlow.", http.StatusForbidden))
		return
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		s.writeError(w, storage.NewWorkspaceError("Ожидается JSON.", http.StatusUnsupportedMediaType))
		return
	}
	var input struct {
		GuideID    string        `json:"guideId"`
		StepID     string        `json:"stepId"`
		Question   string        `json:"question"`
		History    []ai.HintTurn `json:"history"`
		Screenshot string        `json:"screenshot"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 3*1024*1024)).Decode(&input); err != nil {
		var limit *http.MaxBytesError
		if errors.As(err, &limit) {
			s.writeError(w, storage.NewWorkspaceError("Слишком большой запрос.", http.StatusRequestEntityTooLarge))
		} else {
			s.writeError(w, storage.NewWorkspaceError("Некорректный запрос.", http.StatusBadRequest))
		}
		return
	}
	input.Question = strings.TrimSpace(input.Question)
	if (!general && (input.GuideID == "" || input.StepID == "")) ||
		(general && input.Question == "" && input.Screenshot == "") ||
		len([]rune(input.Question)) > 1500 || len(input.History) > 6 {
		s.writeError(w, storage.NewWorkspaceError("Не удалось обработать сообщение. Вопрос может содержать до 1500 символов.", http.StatusBadRequest))
		return
	}
	for _, turn := range input.History {
		if len([]rune(turn.Question)) > 1500 || len([]rune(turn.Answer)) > 3000 {
			s.writeError(w, storage.NewWorkspaceError("Слишком длинное сообщение в истории.", http.StatusBadRequest))
			return
		}
	}
	if input.Screenshot != "" && !validHintScreenshot(input.Screenshot) {
		s.writeError(w, storage.NewWorkspaceError("Прикрепи скриншот в PNG, JPEG или WebP размером до 2 МБ.", http.StatusBadRequest))
		return
	}

	var token string
	if cookie, err := r.Cookie(storage.SessionCookie); err == nil {
		token = cookie.Value
	}
	if general {
		profile, err := s.Store.GetProfile(token)
		if err != nil {
			s.writeError(w, err)
			return
		}
		if profile == nil {
			s.writeError(w, storage.NewWorkspaceError("Войди, чтобы пользоваться чатом.", http.StatusUnauthorized))
			return
		}
		if !ai.IsConfigured() {
			s.writeError(w, storage.NewWorkspaceError("Модель ИИ пока не подключена.", http.StatusServiceUnavailable))
			return
		}
		hint, err := ai.ReplyToChat(r.Context(), input.Question, input.History, input.Screenshot)
		if err != nil {
			message := "Не удалось получить ответ. Попробуй ещё раз."
			if input.Screenshot != "" {
				message = "Не удалось получить ответ со скриншотом. Попробуй отправить вопрос текстом."
			}
			s.writeError(w, storage.NewWorkspaceError(message, http.StatusBadGateway))
			return
		}
		s.writeJSON(w, http.StatusOK, map[string]string{"hint": hint}, map[string]string{"Cache-Control": "private, no-store"})
		return
	}
	guide, completed, err := s.Store.GuideForStepHint(token, input.GuideID)
	if err != nil {
		s.writeError(w, err)
		return
	}
	for _, step := range guide.Steps {
		if step.ID != input.StepID {
			continue
		}
		if !ai.IsConfigured() {
			s.writeError(w, storage.NewWorkspaceError("Подсказки ИИ пока не подключены. Можно задать вопрос автору.", http.StatusServiceUnavailable))
			return
		}
		hint, err := ai.ExplainStep(r.Context(), guide, step, completed, input.Question, input.History, input.Screenshot)
		if err != nil {
			message := "Не удалось получить ответ. Попробуй ещё раз или задай вопрос автору."
			if input.Screenshot != "" {
				message = "Не удалось получить ответ со скриншотом. Попробуй отправить текст ошибки или проверь, поддерживает ли модель изображения."
			}
			s.writeError(w, storage.NewWorkspaceError(message, http.StatusBadGateway))
			return
		}
		s.writeJSON(w, http.StatusOK, map[string]string{"hint": hint}, map[string]string{"Cache-Control": "private, no-store"})
		return
	}
	s.writeError(w, storage.NewWorkspaceError("Шаг не найден.", http.StatusNotFound))
}

func validHintScreenshot(value string) bool {
	header, encoded, found := strings.Cut(value, ",")
	if !found {
		return false
	}
	switch header {
	case "data:image/png;base64", "data:image/jpeg;base64", "data:image/webp;base64":
	default:
		return false
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	return err == nil && len(data) <= 2*1024*1024 && header == "data:"+http.DetectContentType(data)+";base64"
}
