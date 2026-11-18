import { Video, FileText, MessageSquareOff, CheckCircle2, ShieldCheck, Flame } from 'lucide-react';

export function CompetitiveCards() {
  const cards = [
    {
      id: 'adv-video',
      icon: Video,
      accentColor: 'rose',
      competitorTitle: 'Видеозаписи и скринкасты',
      competitorFlaws: [
        'Нельзя скопировать команду без риска опечатки',
        'Сложно найти нужный шаг в длинной записи',
        'Автор не видит, на каком этапе возник затык'
      ],
      stepflowAdvantageTitle: 'Интерактивный плеер шагов',
      stepflowBenefits: [
        'Копирование команд терминала в один клик',
        'Четкий тайминг и фокус на одной задаче',
        'Кнопка вызова помощи автора на проблемном шаге'
      ]
    },
    {
      id: 'adv-notion',
      icon: FileText,
      accentColor: 'indigo',
      competitorTitle: 'Статьи и корпоративные вики',
      competitorFlaws: [
        'Сплошной текст без фиксации текущего действия',
        'Сотрудники пропускают промежуточные шаги',
        'Нет подтверждения, что регламент пройден до конца'
      ],
      stepflowAdvantageTitle: 'Чек-листы с фиксацией прогресса',
      stepflowBenefits: [
        'Переход к следующему шагу только после отметки подзадач',
        'Сохранение сессии в браузере и аккаунте',
        'Подтвержденный статус выполнения регламента'
      ]
    },
    {
      id: 'adv-forums',
      icon: MessageSquareOff,
      accentColor: 'cyan',
      competitorTitle: 'Чаты поддержки и форумы',
      competitorFlaws: [
        'Одни и те же вопросы повторяются каждую неделю',
        'Устаревшие советы ломают рабочее окружение',
        'Инженеры тратят часы на ручной разбор типовых сбоев'
      ],
      stepflowAdvantageTitle: 'Воронка прохождения (Drop-off)',
      stepflowBenefits: [
        'Точный процент отказов на каждом этапе',
        'Тепловая карта проблемных шагов для автора',
        'Улучшение спорных формулировок с помощью ИИ'
      ]
    }
  ];

  return (
    <section id="advantages" className="py-20 border-t border-white/5 relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs font-mono text-brand-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Сравнение подходов</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display">
            Почему статичные регламенты перестают работать
          </h2>
          <p className="text-sm sm:text-base text-slate-400 font-sans">
            Текстовые базы знаний и видео скрывают заминки. StepFlow фиксирует каждое действие и показывает, где именно застопорилась работа.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="glass-card glass-card-hover rounded-2xl p-6 sm:p-7 space-y-6 flex flex-col justify-between"
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300">
                      <Icon className="w-5 h-5 text-accent-indigo" />
                    </div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full">
                      Ограничения
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white font-heading">
                      {card.competitorTitle}
                    </h3>
                    <ul className="space-y-2 text-xs text-slate-400">
                      {card.competitorFlaws.map((flaw) => (
                        <li key={flaw} className="flex items-start gap-2">
                          <span className="text-rose-500 shrink-0 mt-0.5">✕</span>
                          <span>{flaw}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-5 border-t border-white/10 space-y-3 bg-white/[0.02] -mx-6 -mb-6 p-6 rounded-b-2xl">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{card.stepflowAdvantageTitle}</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-200">
                    {card.stepflowBenefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2">
                        <Flame className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
