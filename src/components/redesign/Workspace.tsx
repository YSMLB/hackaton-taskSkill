'use client';
import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, BarChart3, BookOpen, Check, ChevronLeft, ChevronRight, Clock, Copy, ListChecks, MessageCircle, Search, X } from 'lucide-react';
import { RegistrationGate, StepBadge, WorkShell } from './Chrome';
import { defaultRun, Instruction, SAMPLE_ID, useStore } from './store';
import { Editor } from './Editor';
import { Analytics } from './Analytics';
import { Moderation } from './Moderation';
import { GuideCommunity, RatingLabel } from './GuideCommunity';
import { StepComments } from './StepComments';
import { canView, isOwner, publicationLabels, voteSummary } from '@/lib/community';
import { searchScore } from '@/lib/search';
import { GuideUtilities } from './GuideUtilities';
import { VerifiedBadge } from './ExpertReviews';

type Screen = 'catalog' | 'library' | 'author' | 'guide' | 'editor' | 'analytics' | 'moderation';
export function WorkspacePage({ screen }: { screen: Screen }) {
  const { profile, ready } = useStore();
  if (!ready) return <div className="page-loading">Открываем пространство…</div>;
  if (!profile) return <RegistrationGate />;
  return <Suspense fallback={<div className="page-loading">Открываем пространство…</div>}><WorkspaceContent screen={screen} /></Suspense>;
}
function WorkspaceContent({ screen }: { screen: Screen }) {
  const params = useSearchParams();
  const { data, ready, profile } = useStore();
  const id = params.get('id') || SAMPLE_ID;
  const active = screen === 'moderation' ? 'moderation' : ['author', 'editor', 'analytics', 'moderation'].includes(screen) ? 'author' : screen === 'library' ? 'library' : 'catalog';
  const candidate = data.guides.find(g => g.id === id);
  const guide = candidate && canView(candidate, profile) ? candidate : undefined;
  return <WorkShell active={active}>{!ready ? <div className="page-loading">Открываем пространство…</div> : screen === 'moderation' ? <Moderation /> : screen === 'editor' ? <Editor key={params.get('id') || 'new'} id={params.get('id')} /> : screen === 'analytics' ? <Analytics guide={guide} /> : screen === 'guide' ? (guide ? <Player key={guide.id} guide={guide} /> : <Empty title="Инструкция не найдена" text="Проверь ссылку или вернись в каталог." />) : <Catalog screen={screen} key={screen} />}</WorkShell>;
}
export function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) { return <div className="empty-state"><BookOpen size={32} /><h2>{title}</h2><p>{text}</p>{action || <Link className="button button-dark" href="/catalog">Перейти в каталог</Link>}</div>; }
function Catalog({ screen }: { screen: 'catalog' | 'library' | 'author' }) {
  const { data, profile } = useStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');
  const [sort, setSort] = useState('default');
  const base = data.guides.filter(g => screen === 'author' ? isOwner(g, profile) : g.status === 'published' && (screen !== 'library' || data.runs[g.id]));
  const categories = ['Все', ...new Set(base.map(g => g.category))];
  const [aiReady, setAiReady] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiResult, setAiResult] = useState<{ query: string; catalog: string; ids: string[] } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const candidates = base.filter(g => category === 'Все' || g.category === category).map(g => ({ id: g.id, title: g.title, description: g.description, category: g.category, steps: g.steps.map(s => s.title) }));
  const catalogKey = JSON.stringify(candidates);
  const currentAi = aiResult?.query === query && aiResult.catalog === catalogKey ? aiResult : null;
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/search', { signal: controller.signal }).then(r => r.json()).then(result => setAiReady(result.configured === true)).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => () => requestRef.current?.abort(), [query, catalogKey]);
  function changeQuery(value: string) { setQuery(value); setAiMessage(''); }
  function changeCategory(value: string) { setCategory(value); setAiMessage(''); }
  async function aiSearch() {
    if (screen !== 'catalog' || !query.trim() || busy || !aiReady) return;
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
  const filtered = base.filter(g => candidates.some(c => c.id === g.id)).filter(g => currentAi ? currentAi.ids.includes(g.id) : searchScore({ ...g, steps: g.steps.map(s => s.title) }, query) > 0);
  if (sort === 'short') filtered.sort((a, b) => a.minutes - b.minutes);
  else if (sort === 'title') filtered.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  else if (sort === 'helpful') filtered.sort((a, b) => {
    const first = voteSummary(data.votes[a.id]); const second = voteSummary(data.votes[b.id]);
    return (second.helpful + 1) / (second.total + 2) - (first.helpful + 1) / (first.total + 2);
  });
  else if (currentAi) filtered.sort((a, b) => currentAi.ids.indexOf(a.id) - currentAi.ids.indexOf(b.id));
  else if (query.trim()) filtered.sort((a, b) => searchScore({ ...b, steps: b.steps.map(s => s.title) }, query) - searchScore({ ...a, steps: a.steps.map(s => s.title) }, query));
  const continueGuide = data.guides.find(g => data.runs[g.id] && data.runs[g.id].completed.length < g.steps.length && g.status === 'published');
  const heading = screen === 'author' ? 'Мои инструкции' : screen === 'library' ? 'Мои прохождения' : 'Каталог инструкций';
  return <><div className="page-heading"><div><span className="section-label">{screen === 'catalog' ? 'Каждой задаче — свой маршрут' : 'Твоё пространство'}</span><h1>{heading}</h1><p>{screen === 'author' ? 'Черновики, публикации и обратная связь — всё здесь.' : screen === 'library' ? 'Возвращайся к начатому и сохраняй сделанное.' : 'Выбирай задачу. Остальное — шаг за шагом.'}</p></div></div>
    {screen === 'catalog' && continueGuide && <ContinueCard guide={continueGuide} />}
    <form className="catalog-tools" onSubmit={e => { e.preventDefault(); void aiSearch(); }}><label className="search-field"><Search size={19} /><input maxLength={500} aria-label="Поиск инструкций" placeholder="Название, задача или инструмент" value={query} onChange={e => changeQuery(e.target.value)} />{query && <button type="button" className="icon-button" onClick={() => changeQuery('')} aria-label="Очистить поиск"><X size={17} /></button>}</label>{screen === 'catalog' && <button type="submit" className="button button-dark ai-search-button" disabled={!aiReady || !query.trim() || busy}>{busy ? 'Ищем…' : 'Найти с ИИ'}</button>}<label className="sort-field"><span className="sr-only">Сортировка</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="default">По умолчанию</option><option value="short">Сначала короткие</option><option value="title">По названию</option><option value="helpful">По полезности</option></select></label></form>
    {screen === 'catalog' && <div className="search-status" aria-live="polite">{aiMessage || (!aiReady ? 'ИИ-поиск пока не подключён. Работает поиск по словам и синонимам.' : 'Опиши задачу своими словами и нажми «Найти с ИИ».')}{currentAi && <button className="text-button" onClick={() => { setAiResult(null); setAiMessage(''); }}>Искать по словам</button>}</div>}
    <div className="catalog-filter-row"><div className="category-filters">{categories.map(c => <button key={c} className={c === category ? 'active' : ''} aria-pressed={c === category} onClick={() => changeCategory(c)}>{c}</button>)}</div><span className="muted">Найдено: {filtered.length}</span></div>
    {filtered.length ? <div className="guide-grid">{filtered.map((g, i) => <GuideCard key={g.id} guide={g} index={i} author={screen === 'author'} />)}</div> : <Empty title={query || category !== 'Все' ? 'Ничего не нашлось' : screen === 'author' ? 'Здесь начнётся твоя инструкция' : screen === 'library' ? 'Пока нет начатых инструкций' : 'Пока нет публикаций'} text={query || category !== 'Все' ? 'Попробуй другой запрос или убери фильтры.' : screen === 'author' ? 'Разложи знакомую задачу на шаги и помоги кому-то пройти её впервые.' : 'Выбери задачу в каталоге и начни прохождение.'} action={query || category !== 'Все' ? <button className="button button-dark" onClick={() => { changeQuery(''); changeCategory('Все'); }}>Сбросить фильтры</button> : screen === 'author' ? <Link className="button button-dark" href="/editor">Создать первую инструкцию</Link> : undefined} />}
    <p className="workspace-disclaimer">Примеры показывают устройство платформы. Перед использованием технических команд проверь их для своего окружения.</p></>;
}
function ContinueCard({ guide }: { guide: Instruction }) {
  const { data } = useStore(); const run = data.runs[guide.id];
  return <div className="continue-card"><div><span className="section-label">Продолжи с того же места</span><h2>{guide.title}</h2><p>Шаг {Math.min(run.current + 1, guide.steps.length)} из {guide.steps.length}</p></div><div className="continue-progress"><span>{Math.round(run.completed.length / guide.steps.length * 100)}% выполнено</span><div className="progress-track"><span style={{ width: `${run.completed.length / guide.steps.length * 100}%` }} /></div></div><Link href={`/guide?id=${guide.id}`} className="button button-dark">Продолжить <ChevronRight size={18} /></Link></div>;
}
function GuideCard({ guide: g, index, author }: { guide: Instruction; index: number; author: boolean }) {
  const { data } = useStore(); const run = data.runs[g.id];
  return <article className="guide-card"><div className={`guide-card-art art-${index % 3}`} aria-hidden="true"><div className="mini-route"><span><Check size={16} /></span><i /><span>2</span><i /><span>3</span></div>{index % 3 === 0 ? <span className="art-word">Шаг за шагом.</span> : index % 3 === 1 ? <ClipboardIllustration /> : <span className="art-word">Всё по плану.</span>}</div><div className="guide-card-body"><div className="card-labels"><span className="pill">{g.category}</span>{author && <span className={`status ${g.status}`}>{publicationLabels[g.status]}</span>}</div><h2><Link className="guide-card-open" href={`/${author ? 'editor' : 'guide'}?id=${g.id}`}>{g.title}</Link></h2><p>{g.description}</p><div className="guide-card-badges"><RatingLabel id={g.id} /><VerifiedBadge guideId={g.id} /></div><div className="guide-meta"><span><ListChecks size={16} />{g.steps.length} шага</span><span><Clock size={16} />~{g.minutes} мин</span></div>{run && !author && <div className="card-progress"><span>{run.completed.length === g.steps.length ? 'Пройдено' : `Выполнено ${run.completed.length} из ${g.steps.length}`}</span><div className="progress-track"><span style={{ width: `${run.completed.length / g.steps.length * 100}%` }} /></div></div>}<div className="guide-card-footer"><span>{author ? 'Автор: ты' : g.author}</span><span className="round-link" aria-hidden="true"><ArrowUpRight size={19} /></span></div>{author && <Link className="analytics-link" href={`/analytics?id=${g.id}`}><BarChart3 size={16} />Статистика и вопросы</Link>}</div></article>;
}
function ClipboardIllustration() { return <span className="art-paper" aria-hidden="true"><i /><i /><i /><Check size={25} /></span>; }
function Player({ guide }: { guide: Instruction }) {
  const { data, send, pending, notify, profile } = useStore();
  const published = guide.status === 'published';
  const [preview, setPreview] = useState(defaultRun);
  const run = published ? data.runs[guide.id] || preview : preview;
  const [overview, setOverview] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [pendingCheck, setPendingCheck] = useState<{ stepId: string; index: number; checked: boolean } | null>(null);
  const current = Math.min(run.current, guide.steps.length - 1);
  const step = guide.steps[current];
  const initialVisit = useRef(false);
  useEffect(() => {
    if (!published || !step || initialVisit.current) return;
    initialVisit.current = true;
    void send({ type: 'visit', guideId: guide.id, stepId: step.id });
  }, [published, send, guide.id, step]);
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
  return <><div className="player-heading"><Link className="back-link" href="/catalog"><ArrowLeft size={17} />Каталог</Link><span className="saved-label"><CheckCheckIcon />{published ? 'Прогресс сохраняется в профиле' : 'Предпросмотр'}</span></div><h1 className="player-guide-title">{guide.title}</h1><GuideUtilities guide={guide} /><button className="mobile-step-toggle button button-outline" onClick={() => setOverview(!overview)} aria-expanded={overview}>Шаг {current + 1} из {guide.steps.length}<ListChecks size={18} /></button><div className="player-layout"><aside className={`player-sidebar ${overview ? 'expanded' : ''}`}><span className="section-label">Шаги инструкции</span>{guide.steps.map((s, i) => <button className={`step-nav-item ${i === current ? 'active' : ''}`} key={s.id} aria-current={i === current ? 'step' : undefined} onClick={() => { goTo(i); }}><StepBadge number={i + 1} done={run.completed.includes(s.id)} /><span>{s.title}</span></button>)}<div className="demo-progress"><span>Выполнено {run.completed.length} из {guide.steps.length}</span><div className="progress-track"><span style={{ width: `${run.completed.length / guide.steps.length * 100}%` }} /></div></div></aside><article className="player-step"><div className="step-topline"><span className="pill">Шаг {current + 1}</span><span className="muted">{guide.category}</span></div><h2>{step.title}</h2><p className="step-text">{step.text}</p>{step.code && <div className="code-panel"><div><span>{step.filename || 'Команда'}</span><button onClick={copy}><Copy size={15} />Копировать</button></div><pre><code>{step.code}</code></pre></div>}<div className="checklist-heading"><h3>Проверь перед следующим шагом</h3><span>{step.checks.filter((_, i) => checkedAt(i)).length} из {step.checks.length}</span></div><div className="checklist">{step.checks.map((text, i) => <label key={`${step.id}-${i}`} className={checkedAt(i) ? 'is-checked' : ''}><input type="checkbox" checked={checkedAt(i)} disabled={pending} onChange={e => void toggleCheck(i, e.target.checked)} /><span>{text}</span></label>)}</div>{published && <button className="text-button help-trigger" aria-expanded={showHelp} onClick={() => setShowHelp(!showHelp)}><MessageCircle size={18} />Не получается?</button>}{showHelp && <form className="help-form" onSubmit={async e => { e.preventDefault(); if (!report.trim() || pending) return; if (await send({ type: 'help', guideId: guide.id, stepId: step.id, text: report })) { setReport(''); setShowHelp(false); notify('Вопрос отправлен автору'); } }}><label htmlFor="step-question">Что именно вызвало затруднение?</label><textarea id="step-question" required maxLength={1500} value={report} onChange={e => setReport(e.target.value)} placeholder="Опиши, на каком действии возникла проблема" /><p className="small-note">Автор увидит вопрос в статистике инструкции.</p><button className="button button-dark" type="submit" disabled={pending}>Отправить вопрос</button></form>}{error && <p className="field-error" role="alert">{error}</p>}<div className="step-actions"><button className="button button-outline" disabled={current === 0 || pending} onClick={() => goTo(current - 1)}><ChevronLeft size={18} />Назад</button><button className="button button-dark" disabled={pending} onClick={advance}>{current === guide.steps.length - 1 ? 'Завершить инструкцию' : 'Шаг выполнен'}<ChevronRight size={18} /></button></div>{guide.status === 'published' && <StepComments key={step.id} guideId={guide.id} stepId={step.id} />}</article></div><GuideCommunity guide={guide} /></>;
}
function CheckCheckIcon() { return <Check size={16} />; }
