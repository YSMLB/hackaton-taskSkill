'use client';
import { useConfirmation } from './ConfirmDialog';
import Link from 'next/link';
import { DeleteGuide } from './DeleteGuide';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Eye, Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { Instruction, Step, useStore } from './store';
import { StepBadge } from './Chrome';
import { actorId, isOwner, publicationLabels } from '@shared/community';
import { GenerateDraft } from './GenerateDraft';
import { DraftPreview } from './DraftPreview';
import { CoverField } from './GuideCover';
import { GuideCommunity } from './GuideCommunity';
import { editorTemplates } from '@/data/editor-templates';
import { useAiEnabled } from '@/lib/ai-preference';

function blankStep(): Step {
  const id = 'step-' + crypto.getRandomValues(new Uint32Array(4)).join('-');
  return { id, title: '', text: '', checks: [] };
}
export function Editor({ id, teamId }: { id: string | null; teamId: string | null }) {
  const { data, send, pending, notify, profile } = useStore();
  const router = useRouter();
  const { confirm, modal } = useConfirmation();
  const [previewOpen, setPreviewOpen] = useState(false);
  const aiEnabled = useAiEnabled();
  const source = data.guides.find(g => g.id === id);
  const team = data.teams.find(item => item.id === (source?.teamId || teamId));
  const [draft, setDraft] = useState<Instruction>(() => source ? structuredClone(source) : { id: 'new', teamId: team?.id, title: '', description: '', category: 'Учёба', minutes: 10, author: 'Вы', owned: true, status: 'draft', steps: [{ id: 'first-step', title: '', text: '', checks: [] }] });
  const [active, setActive] = useState(0);
  const [dirty, setDirty] = useState(false);
  const unsaved = useRef(false);
  const [error, setError] = useState('');
  const [removed, setRemoved] = useState<{ step: Step; position: number } | null>(null);
  const step = draft.steps[active];
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (unsaved.current) { e.preventDefault(); e.returnValue = ''; } };
    const guard = (e: MouseEvent) => {
      const link = (e.target as Element).closest<HTMLAnchorElement>('a[href]');
      if (!unsaved.current || !link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey ||
        (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const destination = new URL(link.href, location.href);
      if (destination.pathname === location.pathname && destination.search === location.search && destination.hash) return;
      e.preventDefault();
      e.stopPropagation();
      void confirm({ title: 'Выйти из редактора?', message: 'Несохранённые изменения будут потеряны.', action: 'Выйти' }).then(accepted => {
        if (!accepted) return;
        unsaved.current = false;
        if (destination.origin === location.origin && destination.pathname !== '/offline') {
          router.push(destination.pathname + destination.search + destination.hash);
        } else location.assign(destination.href);
      });
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guard, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', guard, true); };
  }, [confirm, router]);
  function patch(fields: Partial<Instruction>) { setDraft(d => ({ ...d, ...fields })); unsaved.current = true; setDirty(true); setError(''); }
  function patchStep(fields: Partial<Step>) { patch({ steps: draft.steps.map((s, i) => i === active ? { ...s, ...fields } : s) }); }
  function reorder(direction: number) { const to = active + direction; if (to < 0 || to >= draft.steps.length) return; const next = [...draft.steps]; [next[active], next[to]] = [next[to], next[active]]; patch({ steps: next }); setActive(to); }
  async function persist(publish: boolean) {
    if (publish && (!draft.title.trim() || !draft.description.trim() || draft.steps.some(s => !s.title.trim() || !s.text.trim() || !s.checks.some(c => c.trim())))) { setError('Для публикации заполни название, описание и каждый шаг: заголовок, действия и хотя бы один пункт чек-листа.'); return; }
    const saved: Instruction = { ...draft, owned: true, ownerId: profile ? actorId(profile) : undefined, author: profile?.name || 'Вы', title: draft.title.trim() || 'Без названия', status: publish ? 'pending' : 'draft', moderationNote: undefined, reviewedAt: undefined, reviewedBy: undefined, submittedAt: publish ? new Date().toISOString() : undefined, steps: draft.steps.map(s => ({ ...s, checks: s.checks.map(c => c.trim()).filter(Boolean) })) };
    const result = await send({ type: 'save', guide: saved, submit: publish, updateOnly: draft.id !== 'new' });
    const confirmed = result?.data.guides.find(guide => guide.id === result.id);
    if (confirmed) {
      setDraft(confirmed); unsaved.current = false; setDirty(false); setError('');
      window.history.replaceState(null, '', `/editor?id=${confirmed.id}`);
      notify(publish ? 'Инструкция отправлена на проверку' : 'Черновик сохранён');
    }
  }
  if ((source?.teamId || teamId) ? !team?.active : source && !isOwner(source, profile)) return <div className="empty-state"><h1>Редактировать можно свою инструкцию</h1><p>Для изменений создай независимую копию опубликованного материала.</p>{source?.status === 'published' && <GuideCommunity guide={source} />}<Link href="/catalog" className="button button-dark">В каталог</Link></div>;
  if (!id && draft.id === 'new' && !team && (!profile?.plan || profile.plan === 'free') && data.guides.filter(g => !g.teamId && isOwner(g, profile)).length >= 10 && !dirty) {
    return <section className="empty-state"><h1>Все 10 мест заняты</h1><p>Можно удалить одну из своих инструкций или подключить Plus, чтобы создавать новые без лимита.</p><div className="utility-actions"><Link href="/profile?tab=author" className="button button-outline">Мои инструкции</Link><Link href="/subscriptions" className="button button-dark">Посмотреть тарифы</Link></div></section>;
  }
  if (id && !source) return <div className="empty-state"><h1>Черновик не найден</h1><Link href="/catalog" className="button button-dark">В каталог</Link></div>;
  return <>{modal}{previewOpen && <DraftPreview guide={draft} initialStep={active} onClose={() => setPreviewOpen(false)} />}<Link href="/catalog" className="back-link"><ArrowLeft size={17} />В каталог</Link><div className="editor-top"><div><span className="section-label">Редактор инструкции</span><h1>{draft.title || 'Новая инструкция'}</h1><span className={`editor-save-state ${dirty ? '' : 'saved'}`}>{dirty ? 'Есть несохранённые изменения' : draft.id === 'new' ? 'Новый черновик' : <><Check size={15} />Сохранено</>}</span></div><div className="editor-actions"><button className="button button-outline" disabled={pending} onClick={() => persist(false)}><Save size={16} /><span>Сохранить</span></button><button className="button button-outline" disabled={pending} onClick={() => setPreviewOpen(true)}><Eye size={16} /><span>Предпросмотр</span></button>{(draft.id !== 'new' || dirty) && <DeleteGuide guide={draft} onDeleted={() => { unsaved.current = false; router.replace(team ? `/team/overview?id=${team.id}` : '/profile?tab=author'); }} />}</div></div>{source && source.status !== 'draft' && <div className={`moderation-notice ${source.status}`}><strong>{publicationLabels[source.status]}</strong><p>{source.status === 'pending' ? 'Администратор проверит инструкцию перед публикацией. Сохранение новых правок вернёт её в черновик.' : source.status === 'rejected' ? source.moderationNote : 'После изменения материал нужно отправить на проверку заново.'}</p></div>}{source?.source && <p className="fork-origin">Исходник: {data.guides.some(g => g.id === source.source?.id) ? <Link href={`/guide?id=${source.source.id}`}>{source.source.title}</Link> : source.source.title}<span>Автор: {source.source.author}</span></p>}{draft.id === 'new' && (!dirty || draft.aiGenerated) && Boolean(profile) &&
    aiEnabled && <GenerateDraft onApply={async fields => {
      if (unsaved.current && !(await confirm({ title: 'Заменить черновик?', message: 'Текущие изменения будут заменены выбранным вариантом.', action: 'Заменить' }))) return false;
      patch({ ...fields, aiGenerated: true });
      setActive(0);
      document.getElementById('guide-title')?.focus();
      return true;
    }} />}
  {draft.id === 'new' && !dirty && <section className="editor-templates" aria-label="Шаблоны инструкций"><h2>Начать с шаблона</h2><div className="utility-actions">{editorTemplates.map(template => <button className="button button-outline" type="button" key={template.label} onClick={() => { patch({ category: template.category, steps: template.steps.map(step => ({ ...blankStep(), ...step })) }); setActive(0); }}>{template.label}</button>)}</div></section>}<div className="editor-layout" inert={pending}><aside className="editor-sidebar"><div className="editor-sidebar-heading"><h2>Шаги</h2><span>{draft.steps.length}</span></div>{draft.steps.map((s, i) => <button key={s.id} className={`step-nav-item ${i === active ? 'active' : ''}`} aria-current={i === active ? 'step' : undefined} onClick={() => setActive(i)}><StepBadge number={i + 1} /><span>{s.title || 'Новый шаг'}{(!s.title || !s.text || !s.checks.some(c => c.trim())) && <small>Нужно заполнить</small>}</span></button>)}<button className="add-step-button" onClick={() => { patch({ steps: [...draft.steps, blankStep()] }); setActive(draft.steps.length); }}><Plus size={18} />Добавить шаг</button>{removed && <button className="undo-button" onClick={() => { const steps = [...draft.steps]; steps.splice(removed.position, 0, removed.step); patch({ steps }); setActive(removed.position); setRemoved(null); }}><Undo2 size={16} />Вернуть удалённый шаг</button>}<div className="editor-tip"><p>Один шаг — одно понятное действие.</p><span>Чек-лист помогает проверить результат, прежде чем двигаться дальше.</span></div></aside><div className="editor-main"><section className="editor-settings"><div className="panel-heading"><h2>Об инструкции</h2><span className="pill">{publicationLabels[draft.status]}</span></div><div className="field"><label htmlFor="guide-title">Название</label><textarea id="guide-title" rows={2} value={draft.title} maxLength={120} onChange={e => patch({ title: e.target.value })} placeholder="Например, подготовиться к защите проекта" /></div><div className="field"><label htmlFor="guide-description">Какой результат получит читатель?</label><textarea id="guide-description" rows={2} value={draft.description} maxLength={500} onChange={e => patch({ description: e.target.value })} placeholder="Коротко опиши задачу и результат" /></div><div className="field-row"><div className="field"><label htmlFor="guide-category">Категория</label><select id="guide-category" value={draft.category} onChange={e => patch({ category: e.target.value })}>{[...new Set(['Учёба', 'Технологии', 'Повседневные задачи', 'Работа', 'Алгоритмы', 'Структуры данных', 'SQL', 'Интерфейсы', 'Аналитика', 'Другое', draft.category])].map(c => <option key={c}>{c}</option>)}</select></div><div className="field"><label htmlFor="guide-time">Время, минут</label><input id="guide-time" type="number" min={1} max={10000} value={draft.minutes} onChange={e => patch({ minutes: Math.max(1, Math.min(10000, Number(e.target.value) || 1)) })} /></div></div><CoverField value={draft.cover} onChange={cover => patch({ cover })} /></section><section className="editor-step-panel"><div className="panel-heading"><div><span className="section-label">Шаг {active + 1} из {draft.steps.length}</span><h2>Что нужно сделать?</h2></div><div className="step-tools"><button className="icon-button" aria-label="Переместить шаг вверх" disabled={active === 0} onClick={() => reorder(-1)}><ArrowUp size={18} /></button><button className="icon-button" aria-label="Переместить шаг вниз" disabled={active === draft.steps.length - 1} onClick={() => reorder(1)}><ArrowDown size={18} /></button><button className="icon-button danger-icon" aria-label="Удалить шаг" disabled={draft.steps.length === 1} onClick={() => { setRemoved({ step, position: active }); patch({ steps: draft.steps.filter((_, i) => i !== active) }); setActive(Math.max(0, active - 1)); }}><Trash2 size={17} /></button></div></div><div className="field"><label htmlFor="step-title">Название шага</label><textarea id="step-title" rows={2} value={step.title} maxLength={160} onChange={e => patchStep({ title: e.target.value })} placeholder="Начни с действия: открой, проверь, установи" /></div><div className="field"><label htmlFor="step-text">Действия и ожидаемый результат</label><textarea id="step-text" rows={5} value={step.text} onChange={e => patchStep({ text: e.target.value })} placeholder="Объясни, что сделать и как понять, что всё получилось" /></div><div className="field"><label htmlFor="step-checks">Чек-лист</label><span className="field-hint">Каждый пункт с новой строки. Читатель отметит их перед переходом дальше.</span><textarea id="step-checks" rows={4} value={step.checks.join('\n')} onChange={e => patchStep({ checks: e.target.value.split('\n') })} placeholder={'Материалы собраны\nРезультат проверен'} /></div><details className="code-details" open={Boolean(step.imageUrl || step.videoUrl)}><summary>Фото и видео</summary>
<div className="field"><label htmlFor="step-image">Ссылка на изображение</label><input id="step-image" maxLength={2000} value={step.imageUrl || ''} onChange={e => patchStep({ imageUrl: e.target.value })} placeholder="https://…" /></div>
<div className="field"><label htmlFor="step-video">Ссылка на видео</label><input id="step-video" maxLength={2000} value={step.videoUrl || ''} onChange={e => patchStep({ videoUrl: e.target.value })} placeholder="https://…" /></div>
</details><details className="code-details" open={Boolean(step.code)}><summary>Добавить код или команду</summary><div className="field"><label htmlFor="step-filename">Название файла</label><input id="step-filename" value={step.filename || ''} onChange={e => patchStep({ filename: e.target.value })} placeholder="Например, Dockerfile" /></div><div className="field"><label htmlFor="step-code">Код</label><textarea id="step-code" className="code-input" rows={6} value={step.code || ''} onChange={e => patchStep({ code: e.target.value })} spellCheck={false} /></div></details></section>
    <div className="editor-submit">
      {error && <p className="validation-error" role="alert">{error}</p>}
      <p className="muted">{team ? 'После проверки инструкция появится в команде.' : 'После проверки инструкция появится в каталоге.'}</p>
      <button type="button" className="button button-red" disabled={pending} onClick={() => persist(true)}>Отправить на проверку</button>
    </div>
  </div></div></>;
}
