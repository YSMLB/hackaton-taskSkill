'use client';

import { Sparkles, ArrowRight } from 'lucide-react';
import { AuthModalMode } from '@shared/stepflow';

interface HeaderProps {
  onOpenAuth: (mode: AuthModalMode) => void;
}

export function Header({ onOpenAuth }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full glass-nav">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between gap-6">
        <a href="#hero" className="flex items-center gap-3.5 group select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/logo-mark.svg"
            alt="StepFlow Logo"
            className="w-10 h-10 rounded-xl shadow-glow-indigo group-hover:scale-105 transition shrink-0"
          />
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white font-display leading-none">
              StepFlow<span className="text-brand-500">.ai</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400 mt-1">
              Интерактивные SOP
            </span>
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
          <a href="#hero" className="hover:text-white">
            Главная
          </a>
          <a
            href="#ai-search-section"
            className="hover:text-white flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent-indigo" />
            Поиск
          </a>
          <a href="#advantages" className="hover:text-white">
            Преимущества
          </a>
          <a href="#demo-section" className="hover:text-white">
            Демо
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenAuth('login')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
          >
            Войти
          </button>
          <button
            type="button"
            onClick={() => onOpenAuth('register')}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-glow-indigo flex items-center gap-1.5"
          >
            <span>Регистрация</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
