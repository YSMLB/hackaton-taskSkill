'use client';

import { useState } from 'react';
import { Sparkles, ArrowRight, Zap, Bot, Terminal, Layers } from 'lucide-react';

interface HeroBannerProps {
  onShowToast: (message: string) => void;
  onExploreDemo: () => void;
}

export function HeroBanner({ onShowToast, onExploreDemo }: HeroBannerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (queryText: string) => {
    const text = queryText || searchQuery;
    if (!text.trim()) return;
    setSearchQuery(text);
    setHasSearched(true);
    onShowToast(`ИИ обработал запрос: «${text.slice(0, 30)}...»`);
  };

  return (
    <section id="hero" className="relative pt-12 pb-20 md:pt-20 md:pb-28">
      <div className="max-w-5xl mx-auto px-6 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Пошаговые регламенты с фиксацией прогресса и аналитикой</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white font-display leading-[1.12]">
          Интерактивные регламенты, <br />
          <span className="bg-gradient-to-r from-brand-500 via-accent-cyan to-accent-violet bg-clip-text text-transparent">
            где виден каждый затык
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-400 font-sans leading-relaxed">
          Создавайте пошаговые SOP с обязательными чек-листами. Платформа замеряет время каждого шага и показывает, где сотрудники теряют темп.
        </p>

        <div id="ai-search-section" className="pt-2 max-w-2xl mx-auto">
          <div className="glass-card rounded-2xl p-2 sm:p-2.5 shadow-2xl relative group">
            <div className="flex items-center gap-3 px-3 py-1.5">
              <Bot className="w-5 h-5 text-accent-cyan shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch(searchQuery);
                }}
                placeholder="Поиск регламента: «Развернуть PostgreSQL в Docker с healthcheck»..."
                className="w-full bg-transparent border-none text-sm sm:text-base text-white placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleSearch(searchQuery)}
                className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-glow-indigo flex items-center gap-1.5 shrink-0"
              >
                <span>Найти</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs text-slate-400">
            <span className="font-mono text-[11px] text-slate-500">Примеры:</span>
            {[
              'Развернуть PostgreSQL в Docker Compose',
              'Настроить CI/CD пайплайн в GitHub Actions',
              'Подключить авторизацию NextAuth.js'
            ].map((promptText) => (
              <button
                key={promptText}
                type="button"
                onClick={() => handleSearch(promptText)}
                className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-slate-300 font-mono text-[11px]"
              >
                {promptText}
              </button>
            ))}
          </div>

          {hasSearched && (
            <div className="mt-6 text-left glass-card rounded-xl p-5 border border-brand-500/30 animate-fadeIn space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Регламент найден в каталоге
                </span>
                <span className="text-[11px] font-mono text-slate-400">5 шагов, 24 мин</span>
              </div>
              <h4 className="text-sm font-bold text-white font-heading">
                Развертывание Node.js и PostgreSQL в Docker Compose для Production
              </h4>
              <p className="text-xs text-slate-400">
                Multi-stage сборка, изоляция внутренних сетей, настройка volume-хранилищ и проверка healthcheck.
              </p>
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onExploreDemo}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  Открыть в плеере
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-slate-400 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent-indigo" />
            <span>Контрольные чек-листы</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent-cyan" />
            <span>Аналитика отказов</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-violet" />
            <span>Помощник автора</span>
          </div>
        </div>
      </div>
    </section>
  );
}
