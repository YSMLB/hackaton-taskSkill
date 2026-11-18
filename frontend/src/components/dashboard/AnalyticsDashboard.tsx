'use client';

import { DEMO_DROP_OFF_METRICS } from '@shared/mock-data';
import { AlertTriangle, Sparkles, TrendingDown, Clock, Users, ArrowUpRight } from 'lucide-react';

interface AnalyticsDashboardProps {
  onShowToast: (message: string) => void;
}

export function AnalyticsDashboard({ onShowToast }: AnalyticsDashboardProps) {
  const handleAiOptimize = () => {
    onShowToast('ИИ подготовил правки шага 3 на основе частых ошибок');
  };

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Всего запусков</span>
            <Users className="w-4 h-4 text-accent-indigo" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">1 420</div>
          <div className="text-[11px] text-slate-400 font-mono">за последние 30 дней</div>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Завершили регламент</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">46.5%</div>
          <div className="text-[11px] text-slate-400 font-mono">661 сотрудник дошел до конца</div>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Среднее время</span>
            <Clock className="w-4 h-4 text-accent-cyan" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">21 мин 45 сек</div>
          <div className="text-[11px] text-slate-400 font-mono">расчетное время: 24 мин</div>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-2 border border-rose-500/30 bg-rose-500/[0.03]">
          <div className="flex items-center justify-between text-rose-300 text-xs font-mono">
            <span>Запросы помощи</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">49 запросов</div>
          <div className="text-[11px] text-rose-300 font-mono">38 обращений на шаге 3</div>
        </div>
      </div>

      {/* Critical Bottleneck Alert */}
      <div className="glass-card rounded-2xl p-6 border border-rose-500/40 bg-rose-500/[0.04] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-mono font-bold">
            <AlertTriangle className="w-4 h-4" />
            <span>Обнаружено узкое место</span>
          </div>
          <h4 className="text-base font-bold text-white font-heading">
            Шаг 3 «Синхронизация БД и Healthcheck» вызывает 41.8% отказов
          </h4>
          <p className="text-xs text-slate-400 max-w-2xl font-sans">
            Сотрудники тратят на шаг 8.6 минут вместо расчетных 3.5 минут и отправляют 78% всех запросов помощи.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAiOptimize}
          className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-glow-indigo flex items-center gap-2 shrink-0"
        >
          <Sparkles className="w-4 h-4 text-accent-cyan" />
          <span>Переписать шаг через ИИ</span>
        </button>
      </div>

      {/* Drop-off Funnel Visualizer */}
      <div className="glass-card rounded-2xl p-6 sm:p-7 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-lg font-bold text-white font-heading">
              Воронка конверсии и отвалов по шагам (Drop-off Funnel)
            </h4>
            <p className="text-xs text-slate-400">
              Показывает, сколько пользователей начали шаг и какой процент покинул регламент
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 hidden sm:block">
            Данные за 30 дней
          </span>
        </div>

        <div className="space-y-4">
          {DEMO_DROP_OFF_METRICS.map((metric) => {
            const isBottleneck = metric.dropRatePercent > 20;
            const completionRatio = Math.round((metric.completedCount / 1420) * 100);

            return (
              <div key={metric.stepId} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between text-xs font-mono gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{metric.stepTitle}</span>
                    {isBottleneck && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Узкое место
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-slate-400 text-[11px]">
                    <span>Дошли: {metric.completedCount} из 1420 ({completionRatio}%)</span>
                    <span className={isBottleneck ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                      Отвал: {metric.dropRatePercent}%
                    </span>
                    <span>~{Math.round(metric.averageTimeSeconds / 60)} мин</span>
                  </div>
                </div>

                {/* Progress bar visualizer */}
                <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden p-0.5 border border-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isBottleneck
                        ? 'bg-gradient-to-r from-brand-600 via-rose-500 to-rose-600'
                        : 'bg-gradient-to-r from-brand-600 to-accent-cyan'
                    }`}
                    style={{ width: `${completionRatio}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
