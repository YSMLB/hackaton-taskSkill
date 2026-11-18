export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/10 bg-dark-950/80 py-12 relative z-10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/logo-mark.svg"
            alt="StepFlow Logo"
            className="w-7 h-7 rounded-lg shrink-0"
          />
          <span className="text-sm font-bold text-white font-display">StepFlow.ai</span>
          <span className="text-xs text-slate-500 font-mono">
            , платформа регламентов и аналитики прохождения
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400 font-mono">
          <a href="#hero" className="hover:text-white transition">
            Главная
          </a>
          <a href="#advantages" className="hover:text-white transition">
            Преимущества
          </a>
          <a href="#demo-section" className="hover:text-white transition">
            Интерактивное демо
          </a>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Все сервисы в норме</span>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          © 2026 StepFlow.ai. Все права защищены.
        </div>
      </div>
    </footer>
  );
}
