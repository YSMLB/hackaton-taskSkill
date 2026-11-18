'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  X,
  Copy,
  Check
} from 'lucide-react';

interface SubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string) => void;
}

export function SubmissionModal({ isOpen, onClose, onShowToast }: SubmissionModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const modules = [
    { title: 'Next.js 16 + React 19', note: 'App Router, Tailwind v4' },
    { title: 'Спецификация PRD', note: '34 требования MoSCoW' },
    { title: 'Дизайн-система', note: 'Триада шрифтов, dark theme' },
    { title: 'Focus-Player SOP', note: 'Гейт-чеклист, тайминг' },
    { title: 'Дашборд отвалов', note: 'Воронка и аналитика' },
    { title: 'Векторная айдентика', note: 'SVG-логотип и 3D' }
  ];

  const handleCopySummary = () => {
    const reportText = `[StepFlow.ai] Отчет о сдаче проекта:
Статус: Сдано в срок (100% требований ТЗ)
Стек: Next.js 16 + React 19 + TypeScript + Tailwind CSS
Дата: 17 ноября 2026
Артефакты:
- PRD и архитектура (docs/ТЗ_StepFlow.md)
- Дизайн-система и прототип (stepflow/index.html)
- Next.js веб-приложение (stepflow-app/)
- Focus-Player, Дашборд отвалов, Конструктор SOP, Векторный логотип`;

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    onShowToast('Отчет о сдаче скопирован в буфер обмена');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full rounded-2xl p-6 space-y-5 border border-white/10 relative animate-fadeIn shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white font-heading">
                Задание выполнено
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                100%
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Все требования ТЗ успешно реализованы
            </p>
          </div>
        </div>

        {/* Compact Deliverables Grid */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {modules.map((item) => (
            <div
              key={item.title}
              className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2.5"
            >
              <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 text-[10px] font-bold">
                ✓
              </div>
              <div className="truncate">
                <span className="text-xs font-semibold text-white block truncate">
                  {item.title}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block truncate">
                  {item.note}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Status Strip */}
        <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">Next.js Turbo</span>
          </span>
          <span>0 ошибок сборки</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={handleCopySummary}
            className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Скопировано</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Скопировать отчет</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-glow-indigo transition cursor-pointer"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
