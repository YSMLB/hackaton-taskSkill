'use client';

import { useState } from 'react';
import { INITIAL_GUIDES } from '@shared/mock-data';
import { GuideCategory, Guide } from '@shared/stepflow';
import { Search, Clock, ListChecks, ArrowUpRight, GitFork, Eye } from 'lucide-react';

interface CatalogSectionProps {
  onSelectGuide: (guide: Guide) => void;
}

const CATEGORIES: ('Все' | GuideCategory)[] = [
  'Все',
  'DevOps',
  'Backend',
  'Frontend',
  'Security',
  'Database'
];

export function CatalogSection({ onSelectGuide }: CatalogSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<'Все' | GuideCategory>('Все');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGuides = INITIAL_GUIDES.filter((guide) => {
    const matchesCategory =
      selectedCategory === 'Все' || guide.category === selectedCategory;
    const matchesSearch =
      guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guide.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                selectedCategory === category
                  ? 'bg-brand-600 text-white font-bold shadow-glow-indigo'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по регламентам..."
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Guide Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGuides.map((guide) => (
          <div
            key={guide.id}
            className="glass-card glass-card-hover rounded-2xl p-6 space-y-5 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/20 text-brand-300 text-[11px] font-mono font-bold">
                  {guide.category}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {guide.difficulty}
                </span>
              </div>

              <h3 className="text-base font-bold text-white font-heading leading-snug line-clamp-2">
                {guide.title}
              </h3>

              <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                {guide.description}
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5 text-accent-indigo" />
                  {guide.totalSteps} шагов
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-accent-cyan" />
                  ~{guide.estimatedTotalMinutes} мин
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {guide.completionRatePercent}%
                </span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400 font-mono">
                  Автор: <span className="text-slate-300 font-medium">{guide.authorName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onSelectGuide(guide)}
                  className="px-3 py-1.5 rounded-lg bg-brand-600/80 hover:bg-brand-600 text-white text-xs font-bold font-mono transition"
                >
                  Открыть
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
