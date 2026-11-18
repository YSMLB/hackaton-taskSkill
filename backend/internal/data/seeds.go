package data

import "stepflow/backend/internal/models"

func strPtr(s string) *string {
	return &s
}

var InitialGuides = []models.Instruction{
	{
		ID:          "g-docker-prod",
		Title:       "Запустить проект в Docker Compose",
		Description: "Подготовь контейнеры приложения и базы данных, настрой запуск и проверь результат.",
		Category:    "Технологии",
		Minutes:     24,
		Author:      "Михаил Решетников",
		Status:      models.StatusPublished,
		Steps: []models.Step{
			{
				ID:       "step-1",
				Title:    "Подготовка базового образа и multi-stage сборка",
				Text:     "Создайте файл `Dockerfile` в корне проекта. Используйте раздельные фазы `dependencies`, `builder` и `runner`.",
				Code:     strPtr("FROM node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:20-alpine AS runner\nWORKDIR /app\nCOPY --from=builder /app/dist ./dist\nCMD [\"node\", \"dist/main.js\"]"),
				Filename: strPtr("Dockerfile"),
				Checks:   []string{"Указан базовый образ node:20-alpine", "Настроен .dockerignore с исключением node_modules"},
			},
			{
				ID:       "step-2",
				Title:    "Конфигурация docker-compose.prod.yml и сети",
				Text:     "Объявите сервис базы данных и внутреннюю изолированную сеть `internal-net`. Проброс порта 5432 на хост запрещен.",
				Code:     strPtr("services:\n  db:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_DB: stepflow_prod\n      POSTGRES_PASSWORD_FILE: /run/secrets/db_password\n    networks:\n      - internal-net"),
				Filename: strPtr("docker-compose.prod.yml"),
				Checks:   []string{"Создана сеть internal-net с драйвером bridge", "Пароли переведены в Docker Secrets"},
			},
			{
				ID:       "step-3",
				Title:    "Миграции базы данных и healthcheck-пробы",
				Text:     "API падает с ошибкой, если контейнер стартует до инициализации сокетов PostgreSQL. Настройте healthcheck и condition: service_healthy.",
				Code:     strPtr("  app:\n    depends_on:\n      db:\n        condition: service_healthy\n  db:\n    healthcheck:\n      test: [\"CMD-SHELL\", \"pg_isready -U postgres\"]\n      interval: 5s\n      timeout: 5s\n      retries: 5"),
				Filename: strPtr("docker-compose.prod.yml"),
				Checks:   []string{"Проверена утилита pg_isready внутри контейнера", "Добавлен блок healthcheck с интервалом 5 секунд", "Настроен depends_on с флагом service_healthy", "Проверен перезапуск контейнера при сбое миграции"},
			},
			{
				ID:       "step-4",
				Title:    "Настройка ротации логов и мониторинга",
				Text:     "Включите драйвер логирования с ограничением максимального размера файла до 20 МБ и ротацией до 3 файлов.",
				Code:     strPtr("logging:\n  driver: \"json-file\"\n  options:\n    max-size: \"20m\"\n    max-file: \"3\""),
				Filename: strPtr("docker-compose.prod.yml"),
				Checks:   []string{"Прописаны лимиты max-size и max-file"},
			},
			{
				ID:       "step-5",
				Title:    "Финальный смоук-тест и валидация готовности",
				Text:     "Запустите стек командой `docker compose -f docker-compose.prod.yml up -d` и отправьте проверочный запрос curl.",
				Code:     strPtr("curl -fsSL http://localhost:8080/api/health | jq ."),
				Filename: strPtr("terminal"),
				Checks:   []string{"Эндпоинт health возвращает HTTP 200 OK"},
			},
		},
	},
	{
		ID:          "lab-report",
		Title:       "Оформить отчёт по лабораторной",
		Description: "Собери результаты работы, оформи расчёты и подготовь файл к сдаче.",
		Category:    "Учёба",
		Minutes:     15,
		Author:      "Команда StepFlow",
		Status:      models.StatusPublished,
		Steps: []models.Step{
			{
				ID:     "lab-1",
				Title:  "Собери материалы",
				Text:   "Открой задание и методичку. Собери результаты измерений, изображения и расчёты в одной папке.",
				Checks: []string{"Задание и методичка под рукой", "Результаты измерений сохранены"},
			},
			{
				ID:     "lab-2",
				Title:  "Оформи результаты",
				Text:   "Перенеси результаты в таблицы. Подпиши столбцы и укажи единицы измерения. Сверь оформление с методичкой.",
				Checks: []string{"Указаны единицы измерения", "Таблицы и изображения подписаны"},
			},
			{
				ID:     "lab-3",
				Title:  "Проверь и сохрани отчёт",
				Text:   "Сопоставь вывод с целью работы. Открой готовый файл и проверь, что формулы и изображения читаются.",
				Checks: []string{"Вывод отвечает на цель работы", "Файл сохранён и проверен"},
			},
		},
	},
	{
		ID:          "presentation",
		Title:       "Подготовиться к защите проекта",
		Description: "Выбери главное, собери слайды и отрепетируй выступление с командой.",
		Category:    "Учёба",
		Minutes:     30,
		Author:      "Команда StepFlow",
		Status:      models.StatusPublished,
		Steps: []models.Step{
			{
				ID:     "pres-1",
				Title:  "Определи главную мысль",
				Text:   "Запиши, какую задачу решает проект и для кого он создан. Выбери результат, который сможешь показать на защите.",
				Checks: []string{"Сформулирована задача", "Выбран результат для демонстрации"},
			},
			{
				ID:     "pres-2",
				Title:  "Собери слайды",
				Text:   "Покажи проблему, решение, свою работу и итог. Замени длинные абзацы схемами или снимками проекта там, где это помогает объяснению.",
				Checks: []string{"Слайды читаются", "Демонстрация подготовлена"},
			},
			{
				ID:     "pres-3",
				Title:  "Проведи репетицию",
				Text:   "Проговори выступление вслух с таймером. Проверь переходы между спикерами и подготовь ответы на возможные вопросы.",
				Checks: []string{"Выступление укладывается в регламент", "Команда распределила роли"},
			},
		},
	},
}
