'use client';
import Link from 'next/link';
import { Suspense, useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, BarChart3, BookOpen, Check, ChevronLeft, ChevronRight, Clock, Copy, ListChecks, MessageCircle, MessageSquareText, Search, X } from 'lucide-react';
import { RegistrationGate, StepBadge, WorkShell } from './Chrome';
import { defaultRun, Instruction, SAMPLE_ID, useStore } from './store';
import { Editor } from './Editor';
import { Analytics } from './Analytics';
import { Moderation } from './Moderation';
import { GuideCommunity, RatingLabel } from './GuideCommunity';
import { StepComments } from './StepComments';
import { MentorChat } from './MentorChat';
import mentorStyles from './MentorChat.module.css';
import { canView, isOwner, publicationLabels, voteSummary } from '@shared/community';
import { searchScore } from '@shared/search';
import { GuideCover } from './GuideCover';
import { StepMedia } from './StepMedia';
import { GuideUtilities } from './GuideUtilities';
import { VerifiedBadge } from './ExpertReviews';
import { useAiEnabled } from '@/lib/ai-preference';

type Screen = 'catalog' | 'library' | 'author' | 'guide' | 'editor' | 'analytics' | 'moderation' | 'mentor';
export function WorkspacePage({ screen }: { screen: Screen }) {
  const { profile, ready } = useStore();
  if (!ready) return <div className="page-loading">Открываем пространство…</div>;
  if (!profile) return <RegistrationGate />;
  return <Suspense fallback={<div className="page-loading">Открываем пространство…</div>}><WorkspaceContent screen={screen} /></Suspense>;
}
function WorkspaceContent({ screen }: { screen: Screen }) {
  const params = useSearchParams();
  const aiEnabled = useAiEnabled();
  const { data, ready, profile } = useStore();
  const id = params.get('id') || SAMPLE_ID;
  const active = screen === 'moderation' ? 'moderation' : ['author', 'editor', 'analytics', 'moderation'].includes(screen) ? 'author' : screen === 'library' ? 'library' : 'catalog';
  const candidate = data.guides.find(g => g.id === id);
  const guide = candidate && (candidate.teamId ? data.teams.some(team => team.id === candidate.teamId) : canView(candidate, profile)) ? candidate : undefined;
  const stepId = params.get('step');
  if (screen === 'mentor') {
    const step = guide?.steps.find(item => item.id === stepId);
    if (!aiEnabled) return <WorkShell active="mentor"><Empty title="Напарник отключён"
      text="Ты можешь вернуть функции ИИ в настройках сайта."
      action={<Link className="button button-dark" href="/profile?tab=settings">Открыть настройки</Link>} /></WorkShell>;
    return <WorkShell active="mentor">{guide?.status === 'published' && step
      ? <Player key={guide.id} guide={guide} openMentor />
      : <>{(params.get('id') || stepId) && <p role="alert" className="field-error">Этот шаг недоступен. Здесь можно задать общий вопрос.</p>}
        <MentorChat /></>}</WorkShell>;
  }
  return <WorkShell active={active}>{!ready ? <div className="page-loading">Открываем пространство…</div> : screen === 'moderation' ? <Moderation /> : screen === 'editor' ? <Editor key={params.get('id') || params.get('team') || 'new'} id={params.get('id')} teamId={params.get('team')} /> : screen === 'analytics' ? <Analytics guide={guide} /> : screen === 'guide' ? (guide ? <Player key={`${guide.id}:${stepId ?? ""}`} guide={guide} /> : <Empty title="Инструкция не найдена" text="Проверь ссылку или вернись в каталог." />) : <Catalog screen={screen} key={screen} />}</WorkShell>;
}
export function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) { return <div className="empty-state"><BookOpen size={32} /><h2>{title}</h2><p>{text}</p>{action || <Link className="button button-dark" href="/catalog">Перейти в каталог</Link>}</div>; }
const authorFilters = [
  { id: 'all', label: 'Все' },
  { id: 'draft', label: 'Черновики' },
  { id: 'pending', label: 'На проверке' },
  { id: 'published', label: 'Опубликованные' },
  { id: 'rejected', label: 'Нужны правки' },
  { id: 'forks', label: 'Форки' },
] as const;

export function Catalog({ screen, embedded = false, initialAuthorFilter = 'all' }: {
  screen: 'catalog' | 'library' | 'author' | 'forks';
  embedded?: boolean;
  initialAuthorFilter?: 'all' | 'forks';
}) {
  const { data, profile, catalogSort, setCatalogSort } = useStore();
  const aiSearchEnabled = useAiEnabled() && screen === 'catalog';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');
  const [authorFilter, setAuthorFilter] = useState<(typeof authorFilters)[number]['id']>(initialAuthorFilter);
  const base = data.guides.filter(g => (screen === 'author' || screen === 'forks') ? isOwner(g, profile) && (screen !== 'forks' || Boolean(g.source)) : g.status === 'published' && (screen === 'library' ? Boolean(data.runs[g.id]) : !g.teamId));
  const categories = ['Все', ...new Set(base.map(g => g.category))];
  const [aiReady, setAiReady] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiResult, setAiResult] = useState<{ query: string; catalog: string; ids: string[] } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const candidates = base.filter(g => category === 'Все' || g.category === category).map(g => ({ id: g.id, title: g.title, description: g.description, category: g.category, steps: g.steps.map(s => s.title) }));
  const catalogKey = JSON.stringify(candidates);
  const currentAi = aiSearchEnabled && aiResult?.query === query && aiResult.catalog === catalogKey ? aiResult : null;
  useEffect(() => {
    if (!aiSearchEnabled) return;
    const controller = new AbortController();
    fetch('/api/search', { signal: controller.signal }).then(r => r.json()).then(result => setAiReady(result.configured === true)).catch(() => {});
    return () => controller.abort();
  }, [aiSearchEnabled]);
  useEffect(() => () => requestRef.current?.abort(), [query, catalogKey, aiSearchEnabled]);
  function changeQuery(value: string) { setQuery(value); setAiMessage(''); }
  function changeCategory(value: string) { setCategory(value); setAiMessage(''); }
  async function aiSearch() {
    if (!aiSearchEnabled || !query.trim() || busy || !aiReady) return;
    const controller = new AbortController();
    requestRef.current?.abort(); requestRef.current = controller;
    setBusy(true); setAiMessage('');
    try {
      const response = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ query, candidates: candidates.filter(c => base.some(g => g.id === c.id && g.status === 'published')) }) });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok || !Array.isArray(result.ids)) { setAiResult(null); setAiMessage(result.message || 'ИИ-поиск недоступен. Показаны результаты поиска по словам.'); return; }
      setAiResult({ query, catalog: catalogKey, ids: result.ids });
      setAiMessage(result.ids.length ? 'Инструкции подобраны ИИ по твоему запросу.' : 'ИИ не нашёл подходящих инструкций. Попробуй уточнить задачу.');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') { setAiResult(null); setAiMessage('Не удалось выполнить ИИ-поиск. Показаны результаты поиска по словам.'); }
    } finally { if (requestRef.current === controller) setBusy(false); }
  }
  let filtered = base.filter(g => candidates.some(c => c.id === g.id)).filter(g => currentAi ? currentAi.ids.includes(g.id) : searchScore({ ...g, steps: g.steps.map(s => s.title) }, query) > 0);
  if (screen === 'author' && authorFilter !== 'all') {
    filtered = filtered.filter(guide => authorFilter === 'forks' ? Boolean(guide.source) : guide.status === authorFilter);
  }
  if (currentAi) filtered.sort((a, b) => currentAi.ids.indexOf(a.id) - currentAi.ids.indexOf(b.id));
  else if (screen === 'catalog' && catalogSort === 'helpful') {
    const rated = filtered.map(guide => ({ guide, rating: voteSummary(data.votes[guide.id]) }));
    rated.sort(({ rating: a }, { rating: b }) => {
      if (!a.total || !b.total) return b.total - a.total;
      const byShare = b.helpful * a.total - a.helpful * b.total;
      return byShare || b.total - a.total;
    });
    filtered = rated.map(({ guide }) => guide);
  } else if (query.trim()) filtered.sort((a, b) => searchScore({ ...b, steps: b.steps.map(s => s.title) }, query) - searchScore({ ...a, steps: a.steps.map(s => s.title) }, query));
  const continueGuide = data.guides.find(g => data.runs[g.id] && data.runs[g.id].completed.length < g.steps.length && g.status === 'published');
  const heading = screen === 'author' ? 'Мои инструкции' : screen === 'library' ? 'Мои прохождения' : 'Каталог инструкций';
  return <>{!embedded && <div className="page-heading"><div><h1>{heading}</h1><p>{screen === 'author' ? 'Редактируй черновики и смотри результаты опубликованных инструкций.' : screen === 'library' ? 'Возвращайся к начатому и сохраняй сделанное.' : 'Найди инструкцию по названию, задаче или инструменту.'}</p></div></div>}
    {screen === 'catalog' && continueGuide && <ContinueCard guide={continueGuide} />}
    {screen === 'author' && <div className="category-filters author-guide-filters" role="group" aria-label="Тип моих инструкций">
      {authorFilters.map(filter => <button key={filter.id} type="button" className={authorFilter === filter.id ? 'active' : ''}
        aria-pressed={authorFilter === filter.id} onClick={() => setAuthorFilter(filter.id)}>{filter.label}</button>)}
    </div>}
    <form className="catalog-tools" onSubmit={e => { e.preventDefault(); void aiSearch(); }}><label className="search-field"><Search size={19} /><input maxLength={500} aria-label="Поиск инструкций" placeholder="Название, задача или инструмент" value={query} onChange={e => changeQuery(e.target.value)} />{query && <button type="button" className="icon-button" onClick={() => changeQuery('')} aria-label="Очистить поиск"><X size={17} /></button>}</label>{aiSearchEnabled && <button type="submit" className="button button-dark ai-search-button" disabled={!aiReady || !query.trim() || busy}>{busy ? 'Ищем…' : 'Найти с ИИ'}</button>}</form>
    {aiSearchEnabled && <div className="search-status" aria-live="polite">{aiMessage || (!aiReady ? 'ИИ-поиск пока не подключён. Работает поиск по словам и синонимам.' : 'Опиши задачу своими словами и нажми «Найти с ИИ».')}{currentAi && <button className="text-button" onClick={() => { setAiResult(null); setAiMessage(''); }}>Искать по словам</button>}</div>}
    <div className="catalog-filter-row">
      <div className="category-filters">{categories.map(c => <button key={c} className={c === category ? 'active' : ''} aria-pressed={c === category} onClick={() => changeCategory(c)}>{c}</button>)}</div>
      <div className="catalog-filter-meta">
        <span className="muted">Найдено: {filtered.length}</span>
        {screen === 'catalog' && <label className="sort-field">
          <span className="sort-label">Сортировка:</span>
          <select className="sort-select" disabled={Boolean(currentAi)}
            value={currentAi ? 'ai' : catalogSort}
            onChange={event => setCatalogSort(event.target.value === 'helpful' ? 'helpful' : 'default')}>
            {currentAi && <option value="ai">По релевантности ИИ</option>}
            <option value="default">{query.trim() ? 'По релевантности' : 'По умолчанию'}</option>
            <option value="helpful">По полезности</option>
          </select>
        </label>}
      </div>
    </div>
    {filtered.length ? <div className="guide-grid">{filtered.map((g, i) => <GuideCard key={g.id} guide={g} index={i} author={screen === 'author' || screen === 'forks'} />)}</div> : screen === 'author' && authorFilter !== 'all' ? <Empty title="В этой подборке пока пусто" text="Посмотри все свои инструкции или измени запрос." action={<button className="button button-outline" onClick={() => { setAuthorFilter('all'); changeQuery(''); changeCategory('Все'); }}>Показать все</button>} /> : <Empty title={query || category !== 'Все' ? 'Ничего не нашлось' : screen === 'forks' ? 'Форков пока нет' : screen === 'author' ? 'Здесь начнётся твоя инструкция' : screen === 'library' ? 'Пока нет начатых инструкций' : 'Пока нет публикаций'} text={query || category !== 'Все' ? 'Попробуй другой запрос или убери фильтры.' : screen === 'forks' ? 'Открой инструкцию в каталоге и создай свою версию.' : screen === 'author' ? 'Разложи знакомую задачу на шаги и помоги кому-то пройти её впервые.' : 'Выбери задачу в каталоге и начни прохождение.'} action={query || category !== 'Все' ? <button className="button button-dark" onClick={() => { changeQuery(''); changeCategory('Все'); }}>Сбросить фильтры</button> : screen === 'author' ? <Link className="button button-dark" href="/editor">Создать первую инструкцию</Link> : undefined} />}
    </>;
}
function ContinueCard({ guide }: { guide: Instruction }) {
  const { data } = useStore(); const run = data.runs[guide.id];
  return <div className="continue-card"><div><span className="section-label">Продолжи с того же места</span><h2>{guide.title}</h2><p>Шаг {Math.min(run.current + 1, guide.steps.length)} из {guide.steps.length}</p></div><div className="continue-progress"><span>{Math.round(run.completed.length / guide.steps.length * 100)}% выполнено</span><div className="progress-track"><span style={{ width: `${run.completed.length / guide.steps.length * 100}%` }} /></div></div><Link href={`/guide?id=${guide.id}`} className="button button-dark">Продолжить <ChevronRight size={18} /></Link></div>;
}
function GuideCard({ guide: g, author }: { guide: Instruction; index: number; author: boolean }) {
  const { data } = useStore(); const run = data.runs[g.id];
  return <article className="guide-card">{g.cover && <div className="guide-card-art" aria-hidden="true"><GuideCover cover={g.cover} /></div>}<div className="guide-card-body"><div className="card-labels"><span className="pill">{g.category}</span>{g.source && <span className="pill fork-label">Форк</span>}{author && <span className={`status ${g.status}`}>{publicationLabels[g.status]}</span>}</div><h2><Link className="guide-card-open" href={`/${author ? 'editor' : 'guide'}?id=${g.id}`}>{g.title}</Link></h2><p>{g.description}</p>{g.source && <p className="card-source">Основано на «{g.source.title}»</p>}<div className="guide-card-badges"><RatingLabel id={g.id} /><VerifiedBadge guideId={g.id} /></div><div className="guide-meta"><span><ListChecks size={16} />{g.steps.length} шага</span><span><Clock size={16} />~{g.minutes} мин</span></div>{run && !author && <div className="card-progress"><span>{run.completed.length === g.steps.length ? 'Пройдено' : `Выполнено ${run.completed.length} из ${g.steps.length}`}</span><div className="progress-track"><span style={{ width: `${run.completed.length / g.steps.length * 100}%` }} /></div></div>}<div className="guide-card-footer"><span>{author ? 'Автор: ты' : g.author}</span><span className="round-link" aria-hidden="true"><ArrowUpRight size={19} /></span></div>{author && <Link className="analytics-link" href={`/analytics?id=${g.id}`}><BarChart3 size={16} />Статистика и вопросы</Link>}</div></article>;
}
function Player({ guide, openMentor = false }: { guide: Instruction; openMentor?: boolean }) {
  const params = useSearchParams();
  const aiEnabled = useAiEnabled();
  const { data, send, pending, notify, profile } = useStore();
  const published = guide.status === 'published';
  const [preview, setPreview] = useState(defaultRun);
  const run = published ? data.runs[guide.id] || preview : preview;
  const [overview, setOverview] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(() => openMentor || params.get('mentor') === '1');
  const mentorId = useId();
  const mentorTrigger = useRef<HTMLButtonElement>(null);
  const [pendingCheck, setPendingCheck] = useState<{ stepId: string; index: number; checked: boolean } | null>(null);
  const current = Math.min(run.current, guide.steps.length - 1);
  const step = guide.steps[current];
  const questions = (data.myQuestions ?? []).filter(question => question.guideId === guide.id && question.stepId === step?.id);
  const hasQuestions = questions.length > 0;
  const linkedStep = params.get('step');
  const currentStepId = step?.id;
  useEffect(() => {
    if (hasQuestions && currentStepId === linkedStep && location.hash === '#author-questions') {
      document.getElementById('author-questions')?.scrollIntoView({ block: 'nearest' });
    }
  }, [hasQuestions, currentStepId, linkedStep]);
  const initialVisit = useRef(false);
  function closeMentor() {
    setMentorOpen(false);
    mentorTrigger.current?.focus();
  }
  useEffect(() => {
    if (!published || !step || initialVisit.current) return;
    initialVisit.current = true;
    const target = guide.steps.find(item => item.id === params.get('step')) ?? step;
    void send({ type: 'visit', guideId: guide.id, stepId: target.id });
  }, [published, send, guide.id, guide.steps, params, step]);
  function goTo(index: number) {
    const next = guide.steps[index];
    if (!next || pending) return;
    if (published) void send({ type: 'visit', guideId: guide.id, stepId: next.id });
    else setPreview({ ...run, current: index });
    setOverview(false); setError(''); setShowHelp(false); setReport('');
  }
  async function toggleCheck(index: number, checked: boolean) {
    if (published) {
      setPendingCheck({ stepId: step.id, index, checked });
      await send({ type: 'check', guideId: guide.id, stepId: step.id, index, checked });
      setPendingCheck(null);
    } else {
      const values = [...(run.checked[step.id] || [])];
      values[index] = checked;
      setPreview({ ...run, checked: { ...run.checked, [step.id]: values }, completed: checked ? run.completed : run.completed.filter(id => id !== step.id) });
    }
    setError('');
  }
  function checkedAt(index: number) {
    return pendingCheck?.stepId === step.id && pendingCheck.index === index
      ? pendingCheck.checked
      : run.checked[step.id]?.[index] || false;
  }
  async function copy() { try { await navigator.clipboard.writeText(step.code || ''); notify('Код скопирован'); } catch { notify('Не удалось скопировать. Выдели код и скопируй вручную.'); } }
  async function advance() {
    if (!step.checks.every((_, i) => run.checked[step.id]?.[i])) { setError('Отметь все пункты этого шага.'); return; }
    if (published) {
      const result = await send({ type: 'complete', guideId: guide.id, stepId: step.id });
      const saved = result?.data.runs[guide.id];
      if (!saved) return;
      setFinished(guide.steps.every(item => saved.completed.includes(item.id)));
    } else {
      const completed = [...new Set([...run.completed, step.id])];
      const target = guide.steps.findIndex(item => !completed.includes(item.id));
      setPreview({ ...run, completed, current: target < 0 ? current : current < guide.steps.length - 1 ? current + 1 : target });
      setFinished(target < 0);
    }
    setError(''); setShowHelp(false); setReport('');
  }
  if (!step) return <Empty title="В этой инструкции ещё нет шагов" text="Вернись в каталог и выбери другой материал." />;
  if (!canView(guide, profile)) return <Empty title="Инструкция пока не опубликована" text="Выбери другой материал в каталоге." />;

  if (finished) return <div className="completion"><span className="completion-mark"><Check size={36} /></span><span className="section-label">Всё получилось</span><h1>Ещё одно дело завершено.</h1><p>Все шаги «{guide.title}» отмечены. Инструкция останется в твоих прохождениях.</p><div className="hero-actions"><Link className="button button-red" href="/library">Мои прохождения</Link><button className="button button-outline" onClick={() => setFinished(false)}>Посмотреть шаги</button></div><GuideUtilities guide={guide} /><GuideCommunity guide={guide} /></div>;
  return <>
    <div className="player-heading">
      <Link className="back-link" href="/catalog"><ArrowLeft size={17} />Каталог</Link>
      <span className="saved-label"><CheckCheckIcon />{published ? 'Прогресс сохраняется в профиле' : 'Предпросмотр'}</span>
    </div>
    <h1 className="player-guide-title">{guide.title}</h1>
    <GuideUtilities guide={guide} />
    <button className="mobile-step-toggle button button-outline" onClick={() => setOverview(!overview)} aria-expanded={overview}>
      Шаг {current + 1} из {guide.steps.length}<ListChecks size={18} />
    </button>
    <div className={mentorStyles.stage}>
      <div className={`player-layout ${mentorStyles.playerLayout}`} data-chat-open={published && aiEnabled && mentorOpen}>
        <aside className={`player-sidebar ${overview ? 'expanded' : ''}`}>
          <span className="section-label">Шаги инструкции</span>
          {guide.steps.map((item, index) => <button
            className={`step-nav-item ${index === current ? 'active' : ''}`}
            key={item.id}
            aria-current={index === current ? 'step' : undefined}
            onClick={() => goTo(index)}
          >
            <StepBadge number={index + 1} done={run.completed.includes(item.id)} /><span>{item.title}</span>
          </button>)}
          <div className="demo-progress">
            <span>Выполнено {run.completed.length} из {guide.steps.length}</span>
            <div className="progress-track"><span style={{ width: `${run.completed.length / guide.steps.length * 100}%` }} /></div>
          </div>
        </aside>
        <article className="player-step">
          <div className="step-topline"><span className="pill">Шаг {current + 1}</span><span className="muted">{guide.category}</span></div>
          <h2>{step.title}</h2>
          <p className="step-text">{step.text}</p>
          <StepMedia step={step} />
          {step.code && <div className="code-panel">
            <div><span>{step.filename || 'Команда'}</span><button onClick={copy}><Copy size={15} />Копировать</button></div>
            <pre><code>{step.code}</code></pre>
          </div>}
          <div className="checklist-heading">
            <h3>Проверь перед следующим шагом</h3>
            <span>{step.checks.filter((_, index) => checkedAt(index)).length} из {step.checks.length}</span>
          </div>
          <div className="checklist">{step.checks.map((text, index) => <label
            key={`${step.id}-${index}`}
            className={checkedAt(index) ? 'is-checked' : ''}
          >
            <input type="checkbox" checked={checkedAt(index)} disabled={pending} onChange={event => void toggleCheck(index, event.target.checked)} />
            <span>{text}</span>
          </label>)}</div>
          {published && <div className={mentorStyles.stepHelp}>
            {aiEnabled && <button ref={mentorTrigger} type="button" className={mentorStyles.trigger}
              aria-expanded={mentorOpen} aria-controls={mentorId}
              onClick={() => mentorOpen ? closeMentor() : setMentorOpen(true)}>
              <MessageSquareText size={18} aria-hidden="true" />Я застрял на этом шаге
            </button>}
            <button type="button" className="text-button help-trigger" aria-expanded={showHelp} onClick={() => setShowHelp(!showHelp)}>
              <MessageCircle size={18} aria-hidden="true" />Спросить автора
            </button>
          </div>}
          {showHelp && <form className="help-form" onSubmit={async event => {
            event.preventDefault();
            if (!report.trim() || pending) return;
            if (await send({ type: 'help', guideId: guide.id, stepId: step.id, text: report })) {
              setReport('');
              setShowHelp(false);
              notify('Вопрос отправлен автору');
            }
          }}>
            <label htmlFor="step-question">Что именно вызвало затруднение?</label>
            <textarea id="step-question" required maxLength={1500} value={report}
              onChange={event => setReport(event.target.value)} placeholder="Опиши, на каком действии возникла проблема" />
            <p className="small-note">Автор увидит вопрос в статистике инструкции.</p>
            <button className="button button-dark" type="submit" disabled={pending}>Отправить вопрос</button>
          </form>}
          {published && questions.length > 0 && <section id="author-questions" className="help-form" aria-label="Твои вопросы автору">
            <h3>Твои вопросы автору</h3>
            <ul className="mt-3 space-y-4">{questions.map(question => <li key={question.id}>
              <p className="whitespace-pre-wrap wrap-anywhere">{question.text}</p>
              {question.reply ? <div className="mt-1 border-l-2 border-[var(--accent-border)] pl-3">
                <strong>Ответ автора</strong>
                <p className="whitespace-pre-wrap wrap-anywhere">{question.reply}</p>
              </div> : <p className="muted">Ответа пока нет</p>}
            </li>)}</ul>
          </section>}
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="step-actions">
            <button className="button button-outline" disabled={current === 0 || pending} onClick={() => goTo(current - 1)}>
              <ChevronLeft size={18} />Назад
            </button>
            <button className="button button-dark" disabled={pending} onClick={advance}>
              {current === guide.steps.length - 1 ? 'Завершить инструкцию' : 'Шаг выполнен'}<ChevronRight size={18} />
            </button>
          </div>
          {published && <StepComments key={step.id} guideId={guide.id} stepId={step.id} />}
        </article>
        {published && aiEnabled && <MentorChat guide={guide} step={step} open={mentorOpen} id={mentorId} onClose={closeMentor} />}
      </div>
    </div>
    <GuideCommunity guide={guide} />
  </>;
}
function CheckCheckIcon() { return <Check size={16} />; }
