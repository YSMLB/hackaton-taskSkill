import { Guide, DropOffMetric } from '@/types/stepflow';

export const INITIAL_GUIDES: Guide[] = [
  {
    id: 'g-docker-prod',
    title: 'Развертывание Node.js и PostgreSQL в Docker Compose для Production',
    slug: 'docker-production-deployment',
    description: 'Пошаговый регламент безопасной сборки multi-stage контейнеров, изоляции сетевых мостов и настройки volume-хранилищ.',
    category: 'DevOps',
    difficulty: 'Средний',
    totalSteps: 5,
    estimatedTotalMinutes: 24,
    completionRatePercent: 68.4,
    authorName: 'Михаил Решетников',
    authorAvatarUrl: '',
    viewsCount: 1420,
    forksCount: 84,
    steps: [
      {
        id: 'step-1',
        order: 1,
        title: 'Подготовка базового образа и multi-stage сборка',
        description: 'Минимизация финального контейнера с Node.js Alpine до 85 МБ без уязвимостей среды сборки.',
        contentMarkdown: 'Создайте файл `Dockerfile` в корне проекта. Используйте раздельные фазы `dependencies`, `builder` и `runner`.',
        codeSnippet: {
          language: 'dockerfile',
          code: 'FROM node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:20-alpine AS runner\nWORKDIR /app\nCOPY --from=builder /app/dist ./dist\nCMD ["node", "dist/main.js"]',
          filename: 'Dockerfile'
        },
        checklist: [
          { id: 'c1-1', title: 'Указан базовый образ node:20-alpine', isRequired: true, completed: true },
          { id: 'c1-2', title: 'Настроен .dockerignore с исключением node_modules', isRequired: true, completed: true }
        ],
        estimatedMinutes: 4,
        averageTimeSeconds: 195,
        dropRatePercent: 4.2,
        stuckSignalsCount: 2
      },
      {
        id: 'step-2',
        order: 2,
        title: 'Конфигурация docker-compose.prod.yml и сети',
        description: 'Изоляция PostgreSQL во внутреннем bridge-контуре без публичной публикации порта 5432 наружу.',
        contentMarkdown: 'Объявите сервис базы данных и внутреннюю изолированную сеть `internal-net`. Проброс порта 5432 на хост запрещен.',
        codeSnippet: {
          language: 'yaml',
          code: 'services:\n  db:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_DB: stepflow_prod\n      POSTGRES_PASSWORD_FILE: /run/secrets/db_password\n    networks:\n      - internal-net',
          filename: 'docker-compose.prod.yml'
        },
        checklist: [
          { id: 'c2-1', title: 'Создана сеть internal-net с драйвером bridge', isRequired: true, completed: true },
          { id: 'c2-2', title: 'Пароли переведены в Docker Secrets', isRequired: true, completed: true }
        ],
        estimatedMinutes: 5,
        averageTimeSeconds: 260,
        dropRatePercent: 8.1,
        stuckSignalsCount: 5
      },
      {
        id: 'step-3',
        order: 3,
        title: 'Миграции базы данных и healthcheck-пробы',
        description: 'Синхронизация запуска: приложение ожидает готовности pg_isready перед выполнением миграций схемы.',
        contentMarkdown: 'API падает с ошибкой, если контейнер стартует до инициализации сокетов PostgreSQL. Настройте healthcheck и condition: service_healthy.',
        codeSnippet: {
          language: 'yaml',
          code: '  app:\n    depends_on:\n      db:\n        condition: service_healthy\n  db:\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U postgres"]\n      interval: 5s\n      timeout: 5s\n      retries: 5',
          filename: 'docker-compose.prod.yml'
        },
        checklist: [
          { id: 'c3-1', title: 'Проверена утилита pg_isready внутри контейнера', isRequired: true, completed: false },
          { id: 'c3-2', title: 'Добавлен блок healthcheck с интервалом 5 секунд', isRequired: true, completed: false },
          { id: 'c3-3', title: 'Настроен depends_on с флагом service_healthy', isRequired: true, completed: false },
          { id: 'c3-4', title: 'Проверен перезапуск контейнера при сбое миграции', isRequired: true, completed: false }
        ],
        estimatedMinutes: 6,
        averageTimeSeconds: 520,
        dropRatePercent: 41.8,
        stuckSignalsCount: 38
      },
      {
        id: 'step-4',
        order: 4,
        title: 'Настройка ротации логов и мониторинга',
        description: 'Ограничение размера json-файлов логов Docker во избежание переполнения дискового пространства сервера.',
        contentMarkdown: 'Включите драйвер логирования с ограничением максимального размера файла до 20 МБ и ротацией до 3 файлов.',
        codeSnippet: {
          language: 'yaml',
          code: 'logging:\n  driver: "json-file"\n  options:\n    max-size: "20m"\n    max-file: "3"',
          filename: 'docker-compose.prod.yml'
        },
        checklist: [
          { id: 'c4-1', title: 'Прописаны лимиты max-size и max-file', isRequired: true, completed: false }
        ],
        estimatedMinutes: 4,
        averageTimeSeconds: 180,
        dropRatePercent: 7.3,
        stuckSignalsCount: 3
      },
      {
        id: 'step-5',
        order: 5,
        title: 'Финальный смоук-тест и валидация готовности',
        description: 'Проверка эндпоинта /api/health и целостности сессий.',
        contentMarkdown: 'Запустите стек командой `docker compose -f docker-compose.prod.yml up -d` и отправьте проверочный запрос curl.',
        codeSnippet: {
          language: 'bash',
          code: 'curl -fsSL http://localhost:8080/api/health | jq .',
          filename: 'terminal'
        },
        checklist: [
          { id: 'c5-1', title: 'Эндпоинт health возвращает HTTP 200 OK', isRequired: true, completed: false }
        ],
        estimatedMinutes: 5,
        averageTimeSeconds: 140,
        dropRatePercent: 2.1,
        stuckSignalsCount: 1
      }
    ]
  },
  {
    id: 'g-k8s-ingress',
    title: 'Настройка Ingress-контроллера NGINX и Let’s Encrypt в Kubernetes',
    slug: 'k8s-ingress-letsencrypt',
    description: 'Автоматическая выдача и ротация SSL-сертификатов через cert-manager и ClusterIssuer.',
    category: 'Security',
    difficulty: 'Продвинутый',
    totalSteps: 6,
    estimatedTotalMinutes: 32,
    completionRatePercent: 54.2,
    authorName: 'Артем Васильев',
    authorAvatarUrl: '',
    viewsCount: 980,
    forksCount: 42,
    steps: []
  },
  {
    id: 'g-next-shadcn',
    title: 'Архитектура дизайн-токенов в Next.js 14 с Tailwind CSS',
    slug: 'nextjs-shadcn-tokens',
    description: 'Интеграция дизайн-системы, изоляция темной темы и создание доступных UI-примитивов.',
    category: 'Frontend',
    difficulty: 'Легкий',
    totalSteps: 4,
    estimatedTotalMinutes: 18,
    completionRatePercent: 88.6,
    authorName: 'Елена Морозова',
    authorAvatarUrl: '',
    viewsCount: 2150,
    forksCount: 165,
    steps: []
  }
];

export const DEMO_DROP_OFF_METRICS: DropOffMetric[] = [
  {
    stepId: 'step-1',
    stepOrder: 1,
    stepTitle: '1. Multi-stage сборка',
    startedCount: 1420,
    completedCount: 1360,
    dropRatePercent: 4.2,
    averageTimeSeconds: 195,
    stuckReportsCount: 2
  },
  {
    stepId: 'step-2',
    stepOrder: 2,
    stepTitle: '2. Конфигурация сетей',
    startedCount: 1360,
    completedCount: 1250,
    dropRatePercent: 8.1,
    averageTimeSeconds: 260,
    stuckReportsCount: 5
  },
  {
    stepId: 'step-3',
    stepOrder: 3,
    stepTitle: '3. Синхронизация БД и Healthcheck',
    startedCount: 1250,
    completedCount: 728,
    dropRatePercent: 41.8,
    averageTimeSeconds: 520,
    stuckReportsCount: 38
  },
  {
    stepId: 'step-4',
    stepOrder: 4,
    stepTitle: '4. Ротация логов',
    startedCount: 728,
    completedCount: 675,
    dropRatePercent: 7.3,
    averageTimeSeconds: 180,
    stuckReportsCount: 3
  },
  {
    stepId: 'step-5',
    stepOrder: 5,
    stepTitle: '5. Финальный смоук-тест',
    startedCount: 675,
    completedCount: 661,
    dropRatePercent: 2.1,
    averageTimeSeconds: 140,
    stuckReportsCount: 1
  }
];
