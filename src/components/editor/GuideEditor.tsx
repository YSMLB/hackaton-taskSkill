'use client';

import { useState } from 'react';
import { Plus, Trash2, Sparkles, MoveUp, MoveDown, Save, Eye, Code } from 'lucide-react';

interface GuideEditorProps {
  onShowToast: (message: string) => void;
}

interface EditableStep {
  id: string;
  order: number;
  title: string;
  content: string;
  checklistItems: string[];
}

export function GuideEditor({ onShowToast }: GuideEditorProps) {
  const [guideTitle, setGuideTitle] = useState('Регламент безопасного деплоя в Production');
  const [guideCategory, setGuideCategory] = useState('DevOps');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [steps, setSteps] = useState<EditableStep[]>([
    {
      id: 'es-1',
      order: 1,
      title: 'Сборка и валидация Docker-образа',
      content: 'Проверьте отсутствие уязвимостей через trivy и соберите образ без кэша.',
      checklistItems: ['Указан node:20-alpine', 'Проверены переменные окружения']
    },
    {
      id: 'es-2',
      order: 2,
      title: 'Применение миграций схемы базы данных',
      content: 'Выполните миграции в транзакции с возможностью быстрого отката.',
      checklistItems: ['Создан бэкап перед миграцией', 'Проверено время блокировки таблиц']
    }
  ]);

  const addStep = () => {
    const nextOrder = steps.length + 1;
    const newStep: EditableStep = {
      id: `es-${Date.now()}`,
      order: nextOrder,
      title: `Новый шаг ${nextOrder}`,
      content: 'Опишите действия, которые должен совершить исполнитель.',
      checklistItems: ['Критическая подзадача 1']
    };
    setSteps([...steps, newStep]);
    onShowToast(`Шаг ${nextOrder} добавлен в конструктор`);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
    onShowToast('Шаг удален');
  };

  const handleAiGenerate = () => {
    if (!aiPrompt.trim()) return;
    setShowAiModal(false);
    onShowToast(`ИИ сгенерировал 4 шага по запросу: «${aiPrompt.slice(0, 25)}...»`);
  };

  return (
    <div className="space-y-6">
      {/* Editor Header */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white font-heading">
              Редактор регламентов (SOP)
            </h3>
            <p className="text-xs text-slate-400">
              Порядок шагов, пункты чек-листов и команды терминала для исполнителей
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="px-3.5 py-2 rounded-xl bg-accent-violet/20 hover:bg-accent-violet/30 border border-accent-violet/30 text-accent-violet text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Сгенерировать черновик</span>
            </button>
            <button
              type="button"
              onClick={() => onShowToast('Регламент сохранен и опубликован')}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-glow-indigo flex items-center gap-1.5 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Опубликовать</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="md:col-span-2 space-y-1">
            <label className="text-[11px] font-mono text-slate-400">Название инструкции</label>
            <input
              type="text"
              value={guideTitle}
              onChange={(e) => setGuideTitle(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-dark-900 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-500 font-sans"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-slate-400">Категория</label>
            <select
              value={guideCategory}
              onChange={(e) => setGuideCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-dark-900 border border-white/10 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
            >
              <option value="DevOps">DevOps</option>
              <option value="Backend">Backend</option>
              <option value="Frontend">Frontend</option>
              <option value="Security">Security</option>
            </select>
          </div>
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-4">
        {steps.map((step, idx) => (
          <div key={step.id} className="glass-card rounded-2xl p-5 space-y-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-md bg-brand-600 text-white flex items-center justify-center font-mono text-xs font-bold">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    setSteps(steps.map((s) => (s.id === step.id ? { ...s, title: newTitle } : s)));
                  }}
                  className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-brand-500 text-sm font-bold text-white focus:outline-none px-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => removeStep(step.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400">Инструкция (Markdown)</label>
              <textarea
                value={step.content}
                onChange={(e) => {
                  const newContent = e.target.value;
                  setSteps(steps.map((s) => (s.id === step.id ? { ...s, content: newContent } : s)));
                }}
                rows={3}
                className="w-full p-3 rounded-lg bg-dark-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-slate-400">
                Обязательный чек-лист для перехода (Гейт)
              </label>
              <div className="space-y-1.5">
                {step.checklistItems.map((chk, chkIdx) => (
                  <div key={chkIdx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                    <span className="text-xs text-slate-300 font-sans">{chk}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addStep}
          className="w-full py-3 rounded-2xl border border-dashed border-white/20 hover:border-brand-500/50 hover:bg-white/[0.02] text-xs font-mono text-slate-400 hover:text-white flex items-center justify-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить следующий шаг регламента</span>
        </button>
      </div>

      {/* AI Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full rounded-2xl p-6 space-y-4 border border-brand-500/30 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-violet" />
                <span>Генерация регламента с помощью ИИ</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Опишите задачу или процесс, и ИИ создаст черновик с логической разбивкой на шаги, чек-листами и оценкой времени.
            </p>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Например: Настроить подключение реплики PostgreSQL с read-only трафиком..."
              rows={3}
              className="w-full p-3 rounded-xl bg-dark-900 border border-white/10 text-xs text-white focus:outline-none focus:border-brand-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAiGenerate}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-glow-indigo"
              >
                Сгенерировать шаги
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
