package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"stepflow/backend/internal/models"
	"stepflow/backend/internal/search"
	"stepflow/backend/internal/storage"
)

const maxBodyBytes = 1024 * 1024 // 1 MB

type Server struct {
	Store *storage.Storage
}

func NewServer(store *storage.Storage) *Server {
	return &Server{Store: store}
}

func (s *Server) writeJSON(w http.ResponseWriter, status int, data any, headers map[string]string) {
	w.Header().Set("Content-Type", "application/json")
	for k, v := range headers {
		w.Header().Set(k, v)
	}
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func (s *Server) writeError(w http.ResponseWriter, err error) {
	var wErr *storage.WorkspaceError
	if errors.As(err, &wErr) {
		s.writeJSON(w, wErr.Status, map[string]string{"message": wErr.Message}, map[string]string{
			"Cache-Control": "private, no-store",
		})
		return
	}
	log.Printf("StepFlow request failed: %v", err)
	s.writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Сервер не смог обработать запрос."}, map[string]string{
		"Cache-Control": "private, no-store",
	})
}

func (s *Server) HandleWorkspaceGet(w http.ResponseWriter, r *http.Request) {
	var token string
	if cookie, err := r.Cookie(storage.SessionCookie); err == nil {
		token = cookie.Value
	}

	snap, err := s.Store.ReadWorkspace(token)
	if err != nil {
		s.writeError(w, err)
		return
	}

	s.writeJSON(w, http.StatusOK, snap, map[string]string{
		"Cache-Control": "private, no-store",
	})
}

func (s *Server) HandleWorkspacePost(w http.ResponseWriter, r *http.Request) {
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

	if clStr := r.Header.Get("Content-Length"); clStr != "" {
		if cl, err := strconv.ParseInt(clStr, 10, 64); err == nil && cl > maxBodyBytes {
			s.writeError(w, storage.NewWorkspaceError("Слишком большой запрос.", http.StatusRequestEntityTooLarge))
			return
		}
	}

	bodyReader := http.MaxBytesReader(w, r.Body, maxBodyBytes)
	body, err := io.ReadAll(bodyReader)
	if err != nil {
		s.writeError(w, storage.NewWorkspaceError("Слишком большой запрос.", http.StatusRequestEntityTooLarge))
		return
	}

	var token string
	if cookie, err := r.Cookie(storage.SessionCookie); err == nil {
		token = cookie.Value
	}

	result, nextToken, err := s.Store.ChangeWorkspace(token, body)
	if err != nil {
		s.writeError(w, err)
		return
	}

	if nextToken != nil {
		if *nextToken != "" {
			isSecure := r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
			http.SetCookie(w, &http.Cookie{
				Name:     storage.SessionCookie,
				Value:    *nextToken,
				Path:     "/",
				MaxAge:   storage.SessionLifetime,
				HttpOnly: true,
				SameSite: http.SameSiteLaxMode,
				Secure:   isSecure,
			})
		} else {
			http.SetCookie(w, &http.Cookie{
				Name:     storage.SessionCookie,
				Value:    "",
				Path:     "/",
				MaxAge:   -1,
				HttpOnly: true,
				SameSite: http.SameSiteLaxMode,
			})
		}
	}

	s.writeJSON(w, http.StatusOK, result, map[string]string{
		"Cache-Control": "private, no-store",
	})
}

func (s *Server) HandleSearchGet(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, http.StatusOK, map[string]any{
		"configured": search.IsConfigured(),
	}, map[string]string{
		"Cache-Control": "no-store",
	})
}

func (s *Server) HandleSearchPost(w http.ResponseWriter, r *http.Request) {
	if !search.IsConfigured() {
		s.writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"code":    "NOT_CONFIGURED",
			"message": "ИИ-поиск пока не подключён. Используй поиск по словам.",
		}, map[string]string{"Cache-Control": "no-store"})
		return
	}

	bodyReader := http.MaxBytesReader(w, r.Body, 120_000)
	body, err := io.ReadAll(bodyReader)
	if err != nil {
		s.writeJSON(w, http.StatusBadRequest, map[string]string{
			"message": "Не удалось обработать запрос поиска.",
		}, nil)
		return
	}

	var req search.SearchRequest
	if err := json.Unmarshal(body, &req); err != nil {
		s.writeJSON(w, http.StatusBadRequest, map[string]string{
			"message": "Не удалось обработать запрос поиска.",
		}, nil)
		return
	}

	query := strings.TrimSpace(req.Query)
	if query == "" || len([]rune(query)) > 500 || len(req.Candidates) > 100 {
		s.writeJSON(w, http.StatusBadRequest, map[string]string{
			"message": "Не удалось обработать запрос поиска.",
		}, nil)
		return
	}

	sanitizedCandidates := make([]search.SearchCandidate, len(req.Candidates))
	for i, c := range req.Candidates {
		id := c.ID
		if len([]rune(id)) > 160 {
			id = string([]rune(id)[:160])
		}
		title := c.Title
		if len([]rune(title)) > 200 {
			title = string([]rune(title)[:200])
		}
		desc := c.Description
		if len([]rune(desc)) > 1000 {
			desc = string([]rune(desc)[:1000])
		}
		cat := c.Category
		if len([]rune(cat)) > 100 {
			cat = string([]rune(cat)[:100])
		}
		var steps []string
		for _, st := range c.Steps {
			if len(steps) >= 30 {
				break
			}
			if len([]rune(st)) > 200 {
				st = string([]rune(st)[:200])
			}
			steps = append(steps, st)
		}
		sanitizedCandidates[i] = search.SearchCandidate{
			ID:          id,
			Title:       title,
			Description: desc,
			Category:    cat,
			Steps:       steps,
		}
	}

	ids, err := search.PerformAISearch(r.Context(), query, sanitizedCandidates)
	if s.writeContentRefusal(w, err) {
		return
	}
	if err != nil {
		s.writeJSON(w, http.StatusBadGateway, map[string]string{
			"message": "ИИ-поиск не ответил или вернул непонятный результат. Поиск по словам остаётся доступен.",
		}, nil)
		return
	}

	s.writeJSON(w, http.StatusOK, search.SearchResponse{
		IDs:  ids,
		Mode: "ai",
	}, map[string]string{"Cache-Control": "no-store"})
}

func (s *Server) HandleGuideGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		id = r.URL.Query().Get("id")
	}

	if id == "" {
		s.writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Не указан id инструкции."}, nil)
		return
	}

	guide, err := s.Store.GetPublishedGuide(id)
	if err != nil {
		s.writeError(w, err)
		return
	}

	if guide == nil {
		s.writeJSON(w, http.StatusNotFound, map[string]string{"message": "Инструкция недоступна."}, nil)
		return
	}

	type embedResponse struct {
		ID          string        `json:"id"`
		Title       string        `json:"title"`
		Description string        `json:"description"`
		Steps       []models.Step `json:"steps"`
	}

	s.writeJSON(w, http.StatusOK, embedResponse{
		ID:          guide.ID,
		Title:       guide.Title,
		Description: guide.Description,
		Steps:       guide.Steps,
	}, map[string]string{
		"Cache-Control": "public, max-age=60",
	})
}

func (s *Server) HandleHealth(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, http.StatusOK, map[string]string{"status": "ok"}, nil)
}
