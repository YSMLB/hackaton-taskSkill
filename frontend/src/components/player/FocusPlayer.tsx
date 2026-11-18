'use client';

import { useState } from 'react';
import {
  Clock,
  AlertCircle,
  Copy,
  Check,
  CheckCircle2,
  ChevronRight,
  Flame,
  HelpCircle,
  BookOpen
} from 'lucide-react';

interface FocusPlayerProps {
  onShowToast: (message: string) => void;
  onCompleteGuide?: () => void;
}

export function FocusPlayer({ onShowToast, onCompleteGuide }: FocusPlayerProps) {
  const [copied, setCopied] = useState(false);
  const [stuckReported, setStuckReported] = useState(false);
  const [checklist, setChecklist] = useState([
    { id: 'c1', text: 'Проверена утилита pg_isready внутри контейнера', done: false },
    { id: 'c2', text: 'Добавлен блок healthcheck с интервалом 5 секунд', done: false },
    { id: 'c3', text: 'Настроен depends_on с флагом service_healthy', done: false },
    { id: 'c4', text: 'Проверен перезапуск контейнера при сбое миграции', done: false }
  ]);

  const completedCount = checklist.filter((item) => item.done).length;
  const isGateUnlocked = completedCount === checklist.length;

  const toggleCheck = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    onShowToast('Команда скопирована в буфер обмена');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReportStuck = () => {
    setStuckReported(true);
    onShowToast('Сигнал о задержке отправлен автору регламента');
  };

  const handleAdvanceStep = () => {
    onShowToast('Все шаги выполнены. Отчет о сдаче сформирован');
    if (onCompleteGuide) {
      onCompleteGuide();
    }
  };

  const codeSnippet = `services:
  app:
    image: node-app:latest
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5`;

  const stepsList = [
    { order: 1, title: 'Multi-stage сборка Dockerfile', status: 'completed' },
    { order: 2, title: 'Конфигурация сетей и секретов', status: 'completed' },
    { order: 3, title: 'Синхронизация БД и Healthcheck', status: 'current' },
    { order: 4, title: 'Ротация логов контейнеров', status: 'upcoming' },
    { order: 5, title: 'Смоук-тест и валидация', status: 'upcoming' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Step Sidebar */}
        <div className="w-full lg:w-72 shrink-0 glass-card rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Оглавление регламента
            </span>
            <span className="text-xs font-mono font-bold text-brand-400">Шаг 3 из 5</span>
          </div>

          <div className="space-y-2">
            {stepsList.map((step) => {
              const isCurrent = step.status === 'current';
              const isDone = step.status === 'completed';

              return (
                <div
                  key={step.order}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                    isCurrent
                      ? 'bg-brand-500/10 border-brand-500/40 text-white font-bold'
                      : isDone
                      ? 'bg-white/[0.02] border-white/5 text-slate-400'
                      : 'bg-transparent border-transparent text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                        isDone
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : isCurrent
                          ? 'bg-brand-600 text-white'
                          : 'bg-white/5 text-slate-500'
                      }`}
                    >
                      {isDone ? '✓' : step.order}
                    </span>
                    <span className="truncate">{step.title}</span>
                  </div>
                  {isCurrent && (
                    <span className="w-2 h-2 rounded-full bg-accent-cyan animate-ping shrink-0 ml-2" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-white/10 text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>Прогресс: 60%</span>
            <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="w-3/5 h-full bg-gradient-to-r from-brand-500 to-accent-cyan" />
            </div>
          </div>
        </div>

        {/* Step Viewer & Interactive Checklist Gate */}
        <div className="flex-1 glass-card rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-md bg-brand-500/20 border border-brand-500/30 text-brand-300 font-mono text-xs font-bold">
                Шаг 3
              </span>
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-accent-cyan" />
                ~6 минут
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Высокий отсев: 41.8% пользователей</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl sm:text-2xl font-bold text-white font-heading">
              Миграции базы данных и healthcheck-пробы
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              Контейнер приложения часто падает с ошибкой подключения, если запустить его до того, как сокет PostgreSQL перейдет в состояние готовности.
              Настройте пробу готовности через утилиту <code className="text-accent-cyan font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded">pg_isready</code> и привяжите условие запуска API.
            </p>
          </div>

          {/* Code Snippet */}
          <div className="rounded-xl overflow-hidden border border-white/10 bg-dark-950/80">
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
              <span className="font-mono text-xs text-slate-400">docker-compose.prod.yml</span>
              <button
                type="button"
                onClick={() => handleCopyCode(codeSnippet)}
                className="flex items-center gap-1.5 text-xs font-mono text-slate-300 hover:text-white"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Копировать</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
              <code>{codeSnippet}</code>
            </pre>
          </div>

          {/* Interactive Checklist Gate */}
          <div className="rounded-xl p-5 border border-white/10 bg-white/[0.02] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-accent-indigo" />
                <h4 className="text-sm font-bold text-white font-heading">
                  Обязательный чек-лист для перехода
                </h4>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {completedCount} из {checklist.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer select-none transition"
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleCheck(item.id)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-600 text-brand-600 focus:ring-brand-500 bg-dark-900 cursor-pointer"
                  />
                  <span className={`text-xs ${item.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                    {item.text}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Action Bar */}
          <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-t border-white/10">
            <button
              type="button"
              onClick={handleReportStuck}
              className={`px-4 py-2.5 rounded-xl border text-xs font-bold font-mono flex items-center gap-2 transition ${
                stuckReported
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>{stuckReported ? 'Сигнал отправлен автору' : 'Застрял на этом шаге'}</span>
            </button>

            <button
              type="button"
              disabled={!isGateUnlocked}
              onClick={handleAdvanceStep}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition ${
                isGateUnlocked
                  ? 'bg-brand-600 hover:bg-brand-500 shadow-glow-indigo cursor-pointer'
                  : 'bg-white/10 text-slate-500 cursor-not-allowed opacity-40'
              }`}
            >
              <span>{isGateUnlocked ? 'Завершить шаг и перейти далее' : 'Отметьте все пункты чек-листа'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
