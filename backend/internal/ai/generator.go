package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"stepflow/backend/internal/models"
	"stepflow/backend/internal/storage"
)

type GenerateGuideRequest struct {
	Prompt   string `json:"prompt"`
	Category string `json:"category,omitempty"`
	Minutes  int    `json:"minutes,omitempty"`
}

type GenerateGuideResponse struct {
	Guide models.Instruction `json:"guide"`
}

func IsConfigured() bool {
	return os.Getenv("AI_API_KEY") != "" &&
		os.Getenv("AI_BASE_URL") != "" &&
		os.Getenv("AI_MODEL") != ""
}

func CleanCodeFence(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		idx := strings.Index(s, "\n")
		if idx != -1 {
			s = strings.TrimSpace(s[idx+1:])
		}
	}
	if strings.HasSuffix(s, "```") {
		s = strings.TrimSpace(strings.TrimSuffix(s, "```"))
	}
	return s
}

const systemPrompt = `Ты — ведущий технический методист платформы StepFlow. Твоя задача — составить подробное, практическое и строго структурированное пошаговое руководство по запросу пользователя.

Требования к ответу:
1. Верни ИСКЛЮЧИТЕЛЬНО валидный JSON без вступительного текста, без сносок и без форматирования вне JSON.
2. В руководстве должно быть от 3 до 7 логичных, последовательных шагов.
3. В каждом шаге ОБЯЗАТЕЛЬНО должны быть поля:
   - "id": уникальный идентификатор шага ("step-1", "step-2" и т.д.);
   - "title": понятный заголовок шага (до 150 символов);
   - "text": понятная инструкция с подробным объяснением сути действий;
   - "checks": массив из 2-4 конкретных проверяемых пунктов чек-листа;
   - "code": фрагмент кода или терминальной команды (если применимо);
   - "filename": имя файла (например, "docker-compose.yml", "main.go") или "terminal".

Формат JSON:
{
  "title": "Название инструкции",
  "description": "Краткое описание цели инструкции",
  "category": "Категория",
  "minutes": 25,
  "steps": [
    {
      "id": "step-1",
      "title": "...",
      "text": "...",
      "code": "...",
      "filename": "...",
      "checks": ["...", "..."]
    }
  ]
}`

type RawStep struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Text     string   `json:"text"`
	Code     *string  `json:"code"`
	Filename *string  `json:"filename"`
	Checks   []string `json:"checks"`
}

type RawGuideOutput struct {
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	Minutes     int       `json:"minutes"`
	Steps       []RawStep `json:"steps"`
}

func GenerateGuideDraft(ctx context.Context, prompt string, category string, minutes int, authorProfile *models.Profile) (*models.Instruction, error) {
	prompt = strings.TrimSpace(prompt)
	if len([]rune(prompt)) < 5 || len([]rune(prompt)) > 1000 {
		return nil, errors.New("опиши тему инструкции подробнее (от 5 до 1000 символов)")
	}

	if category == "" {
		category = "Учёба"
	}
	if minutes < 5 || minutes > 1440 {
		minutes = 20
	}

	// Попытка сгенерировать через сконфигурированный AI провайдер
	guide, err := callAIProvider(ctx, prompt, category, minutes, authorProfile)
	if err == nil && guide != nil {
		return guide, nil
	}

	// Если модель недоступна, нет сети или провайдер вернул ошибку,
	// используем детерминированный контекстный генератор шаблонов
	return FallbackGuideDraft(prompt, category, minutes, authorProfile)
}

func callAIProvider(ctx context.Context, prompt string, category string, minutes int, authorProfile *models.Profile) (*models.Instruction, error) {
	if !IsConfigured() {
		return nil, errors.New("ИИ-сервис генерации не настроен на сервере")
	}

	baseURLStr := os.Getenv("AI_BASE_URL")
	base, err := url.Parse(baseURLStr)
	if err != nil {
		return nil, errors.New("некорректный AI_BASE_URL")
	}

	isLocal := base.Hostname() == "localhost" || base.Hostname() == "127.0.0.1" || base.Hostname() == "::1"
	if base.Scheme != "https" && !(base.Scheme == "http" && isLocal) {
		return nil, errors.New("небезопасный AI_BASE_URL запрещен")
	}

	apiURL := fmt.Sprintf("%s/chat/completions", strings.TrimRight(baseURLStr, "/"))

	userContent := fmt.Sprintf("Тема: %s\nКатегория: %s\nПримерное время: %d минут", prompt, category, minutes)

	type chatMessage struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	type chatRequest struct {
		Model       string        `json:"model"`
		Messages    []chatMessage `json:"messages"`
		Temperature float64       `json:"temperature"`
	}

	reqBody, err := json.Marshal(chatRequest{
		Model:       os.Getenv("AI_MODEL"),
		Temperature: 0.7,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userContent},
		},
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("AI_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("ИИ сервис вернул статус %d", resp.StatusCode)
	}

	var chatResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return nil, err
	}

	if len(chatResp.Choices) == 0 {
		return nil, errors.New("нейросеть не вернула вариант ответа")
	}

	cleanJSON := CleanCodeFence(chatResp.Choices[0].Message.Content)

	var raw RawGuideOutput
	if err := json.Unmarshal([]byte(cleanJSON), &raw); err != nil {
		return nil, fmt.Errorf("не удалось разобрать JSON ответа ИИ: %w", err)
	}

	return SanitizeGuideOutput(raw, category, minutes, authorProfile)
}

func FallbackGuideDraft(prompt, category string, minutes int, authorProfile *models.Profile) (*models.Instruction, error) {
	title := prompt
	runes := []rune(title)
	if len(runes) > 0 {
		title = strings.ToUpper(string(runes[:1])) + string(runes[1:])
	}

	lower := strings.ToLower(prompt)
	var steps []RawStep

	if strings.Contains(lower, "docker") || strings.Contains(lower, "докер") || strings.Contains(lower, "контейнер") {
		steps = []RawStep{
			{
				ID:       "step-1",
				Title:    "Подготовка базового образа и .dockerignore",
				Text:     fmt.Sprintf("Создайте базовый Dockerfile для проекта по теме «%s». Настройте исключение лишних файлов и зависимостей в .dockerignore для ускорения сборки.", prompt),
				Code:     strPtr("FROM alpine:latest\nWORKDIR /app\nCOPY . .\nCMD [\"sh\"]"),
				Filename: strPtr("Dockerfile"),
				Checks:   []string{"Создан Dockerfile с базовым образом", "Настроен .dockerignore"},
			},
			{
				ID:       "step-2",
				Title:    "Конфигурация docker-compose",
				Text:     "Опишите сервисы, порты, переменные окружения и изолированную сеть в конфигурационном файле docker-compose.yml.",
				Code:     strPtr("services:\n  app:\n    build: .\n    ports:\n      - \"8080:8080\"\n    restart: unless-stopped"),
				Filename: strPtr("docker-compose.yml"),
				Checks:   []string{"Определены сервисы и порты", "Сконфигурирована внутренняя сеть"},
			},
			{
				ID:       "step-3",
				Title:    "Запуск контейнеров и проверка статуса",
				Text:     "Запустите стек в фоновом режиме и убедитесь, что все контейнеры перешли в статус running без ошибок в логах.",
				Code:     strPtr("docker compose up -d\ndocker compose ps"),
				Filename: strPtr("terminal"),
				Checks:   []string{"Команда up выполнена без ошибок", "Контейнеры активны (Up)"},
			},
			{
				ID:       "step-4",
				Title:    "Верификация и логирование",
				Text:     "Проверьте доступность приложения запросом и проинспектируйте логи на отсутствие предупреждений и сбоев.",
				Code:     strPtr("docker compose logs -f app"),
				Filename: strPtr("terminal"),
				Checks:   []string{"Логи приложения чистые", "Healthcheck возвращает 200 OK"},
			},
		}
	} else if strings.Contains(lower, "отчет") || strings.Contains(lower, "отчёт") || strings.Contains(lower, "лабораторн") || strings.Contains(lower, "курсов") {
		steps = []RawStep{
			{
				ID:     "step-1",
				Title:  "Сбор исходных данных и требований",
				Text:   fmt.Sprintf("Соберите методические указания, исходные варианты и результаты экспериментов по теме «%s». Проверьте соответствие требованиям кафедры.", prompt),
				Checks: []string{"Методичка и требования под рукой", "Исходные результаты зафиксированы"},
			},
			{
				ID:     "step-2",
				Title:  "Структурирование и расчёты",
				Text:   "Оформите расчётную часть, заполните сводные таблицы с указанием размерностей и единиц измерения.",
				Checks: []string{"Таблицы данных заполнены", "Единицы измерения проверены"},
			},
			{
				ID:     "step-3",
				Title:  "Построение графиков и иллюстраций",
				Text:   "Подготовьте наглядные схемы и графики зависимостей. Подпишите координатные оси и нумерацию рисунков согласно ГОСТ.",
				Checks: []string{"Графики снабжены подписями осей", "Рисунки пронумерованы и подписаны"},
			},
			{
				ID:     "step-4",
				Title:  "Формулирование выводов и проверка оформления",
				Text:   "Сопоставьте полученные результаты с целью работы, сформулируйте аргументированный вывод и сохраните итоговый отчёт.",
				Checks: []string{"Вывод соотносится с целью работы", "Файл проверен и сохранён"},
			},
		}
	} else if strings.Contains(lower, "git") || strings.Contains(lower, "гит") || strings.Contains(lower, "репозитор") {
		steps = []RawStep{
			{
				ID:       "step-1",
				Title:    "Инициализация и настройка ветки",
				Text:     fmt.Sprintf("Создайте чистую рабочую ветку для задачи «%s» и проверьте актуальность локального репозитория.", prompt),
				Code:     strPtr("git checkout -b feat/new-feature\ngit status"),
				Filename: strPtr("terminal"),
				Checks:   []string{"Создана изолированная ветка", "Рабочее дерево без лишних изменений"},
			},
			{
				ID:       "step-2",
				Title:    "Внесение изменений и подготовка коммита",
				Text:     "Добавьте измененные файлы в индекс и оформите атомарный коммит по стандарту Conventional Commits.",
				Code:     strPtr("git add .\ngit commit -m \"feat: implement core functionality\""),
				Filename: strPtr("terminal"),
				Checks:   []string{"Файлы добавлены в stage", "Сообщение коммита следует стандарту"},
			},
			{
				ID:       "step-3",
				Title:    "Отправка в удалённый репозиторий и Pull Request",
				Text:     "Отправьте ветку на сервер и откройте Pull Request с подробным описанием изменений для ревью.",
				Code:     strPtr("git push -u origin feat/new-feature"),
				Filename: strPtr("terminal"),
				Checks:   []string{"Ветка отправлена на remote", "Pull Request открыт и готов к ревью"},
			},
		}
	} else {
		steps = []RawStep{
			{
				ID:     "step-1",
				Title:  "Подготовка и планирование",
				Text:   fmt.Sprintf("Определите основные цели и требования для задачи «%s». Подготовьте рабочее пространство и необходимые инструменты.", prompt),
				Checks: []string{"Цели задачи четко сформулированы", "Необходимые инструменты установлены"},
			},
			{
				ID:     "step-2",
				Title:  "Настройка конфигурации и окружения",
				Text:   "Задайте параметры окружения, конфигурационные переменные и проверьте доступность ключевых зависимостей.",
				Checks: []string{"Параметры конфигурации проверены", "Окружение готово к исполнению"},
			},
			{
				ID:     "step-3",
				Title:  "Пошаговая реализация",
				Text:   fmt.Sprintf("Выполните ключевые действия по реализации «%s», следуя лучшим практикам и архитектурным соглашениям.", prompt),
				Checks: []string{"Основной сценарий выполнен", "Отсутствуют блокирующие ошибки"},
			},
			{
				ID:     "step-4",
				Title:  "Тестирование и верификация результата",
				Text:   "Проведите контрольную проверку полученного результата, протестируйте граничные случаи и убедитесь в стабильности.",
				Checks: []string{"Тестовые проверки завершены успешно", "Результат полностью соответствует требованиям"},
			},
		}
	}

	raw := RawGuideOutput{
		Title:       title,
		Description: fmt.Sprintf("Пошаговое практическое руководство по теме «%s». Разработано для платформы StepFlow.", prompt),
		Category:    category,
		Minutes:     minutes,
		Steps:       steps,
	}

	return SanitizeGuideOutput(raw, category, minutes, authorProfile)
}

func strPtr(s string) *string {
	return &s
}

func SanitizeGuideOutput(raw RawGuideOutput, defaultCategory string, defaultMinutes int, authorProfile *models.Profile) (*models.Instruction, error) {
	title := strings.TrimSpace(raw.Title)
	if title == "" {
		title = "Сгенерированная инструкция"
	}
	if len([]rune(title)) > 250 {
		title = string([]rune(title)[:250])
	}

	desc := strings.TrimSpace(raw.Description)
	if len([]rune(desc)) > 4000 {
		desc = string([]rune(desc)[:4000])
	}

	category := strings.TrimSpace(raw.Category)
	if category == "" {
		category = defaultCategory
	}
	if len([]rune(category)) > 100 {
		category = string([]rune(category)[:100])
	}

	minutes := raw.Minutes
	if minutes < 1 || minutes > 1440 {
		minutes = defaultMinutes
	}
	if minutes < 1 {
		minutes = 15
	}

	if len(raw.Steps) == 0 {
		return nil, errors.New("ИИ не сгенерировал шаги инструкции")
	}

	stepsLimit := len(raw.Steps)
	if stepsLimit > 60 {
		stepsLimit = 60
	}

	steps := make([]models.Step, stepsLimit)
	for i := 0; i < stepsLimit; i++ {
		st := raw.Steps[i]
		stepID := fmt.Sprintf("step-%d", i+1)
		stepTitle := strings.TrimSpace(st.Title)
		if stepTitle == "" {
			stepTitle = fmt.Sprintf("Шаг %d", i+1)
		}
		if len([]rune(stepTitle)) > 200 {
			stepTitle = string([]rune(stepTitle)[:200])
		}

		stepText := strings.TrimSpace(st.Text)
		if len([]rune(stepText)) > 16000 {
			stepText = string([]rune(stepText)[:16000])
		}

		var checks []string
		for _, c := range st.Checks {
			cClean := strings.TrimSpace(c)
			if cClean != "" {
				if len([]rune(cClean)) > 500 {
					cClean = string([]rune(cClean)[:500])
				}
				checks = append(checks, cClean)
				if len(checks) >= 30 {
					break
				}
			}
		}
		if len(checks) == 0 {
			checks = []string{"Шаг выполнен успешно"}
		}

		var codePtr *string
		if st.Code != nil && strings.TrimSpace(*st.Code) != "" {
			c := strings.TrimSpace(*st.Code)
			if len([]rune(c)) > 16000 {
				c = string([]rune(c)[:16000])
			}
			codePtr = &c
		}

		var filenamePtr *string
		if st.Filename != nil && strings.TrimSpace(*st.Filename) != "" {
			f := strings.TrimSpace(*st.Filename)
			if len([]rune(f)) > 200 {
				f = string([]rune(f)[:200])
			}
			filenamePtr = &f
		}

		steps[i] = models.Step{
			ID:       stepID,
			Title:    stepTitle,
			Text:     stepText,
			Code:     codePtr,
			Filename: filenamePtr,
			Checks:   checks,
		}
	}

	authorName := "Автор"
	ownerID := ""
	if authorProfile != nil {
		authorName = authorProfile.Name
		ownerID = models.ActorID(*authorProfile)
	}

	return &models.Instruction{
		ID:          storage.RandomUUID(),
		Title:       title,
		Description: desc,
		Category:    category,
		Minutes:     minutes,
		Author:      authorName,
		OwnerID:     ownerID,
		Owned:       true,
		Status:      models.StatusDraft,
		Steps:       steps,
	}, nil
}
