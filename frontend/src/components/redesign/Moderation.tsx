'use client';

import Link from 'next/link';
import { ArticleStats } from './ArticleStats';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ShieldCheck } from 'lucide-react';
import { isAdmin, type Instruction } from '@shared/community';
import type { ExpertSummary, ModerationDecision } from '@shared/workspace-data';
import { StepMedia } from './StepMedia';
import { useStore } from './store';
import styles from './Moderation.module.css';

const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
const sections = [
  { id: 'queue', label: 'Очередь', href: '/moderation' },
  { id: 'stats', label: 'Статистика и вопросы', href: '/moderation?tab=stats' },
  { id: 'history', label: 'Решения', href: '/moderation?tab=history' },
  { id: 'experts', label: 'Эксперты', href: '/moderation?tab=experts' },
  { id: 'admins', label: 'Администраторы', href: '/moderation?tab=admins' },
] as const;

export function Moderation() {
  const { data, profile } = useStore();
  const params = useSearchParams();
  const tab = params.get('tab');
  const guideId = params.get('guide');
  const revision = params.get('revision');
  const matchesRevision = (value?: number) => revision === null || String(value ?? 0) === revision;
  const targetGuide = data.guides.find(guide => guide.id === guideId && guide.status === 'pending' && matchesRevision(guide.revision));
  const targetDecision = data.moderation?.decisions.slice().reverse().find(item => item.guideId === guideId && matchesRevision(item.revision));
  const target = targetGuide ? `request-${targetGuide.id}` : targetDecision ? `decision-${targetDecision.id}` : null;
  const section = sections.find(item => item.id === (targetDecision && !targetGuide ? 'history' : tab)) ?? sections[0];
  useEffect(() => {
    if (target) document.getElementById(target)?.scrollIntoView({ block: 'nearest' });
  }, [target]);
  if (!isAdmin(profile)) return <section className="empty-state">
    <ShieldCheck size={32} aria-hidden="true" />
    <h1>Админ-панель недоступна</h1>
    <p>Для доступа нужна роль администратора.</p>
    <Link href="/catalog" className="button button-dark">В каталог</Link>
  </section>;

  const queue = data.guides.filter(guide => guide.status === 'pending')
    .sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''));
  const decisions = data.moderation?.decisions ?? [];
  const experts = data.moderation?.experts ?? [];
  return <div className={styles.admin}>
    <header className={styles.header}>
      <h1>Админ-панель</h1>
      <p>Проверяй публикации, просматривай решения и управляй правами участников.</p>
    </header>
    <nav className={styles.sections} aria-label="Разделы админ-панели">
      {sections.map(item => <Link key={item.id} href={item.href} aria-current={item.id === section.id ? 'page' : undefined}>
        {item.label}{item.id === 'queue' && <span className={styles.count}>{queue.length}</span>}
      </Link>)}
    </nav>
    {guideId && !target && <p role="status">Этой версии заявки уже нет в очереди.</p>}
    {section.id === 'stats' ? <section className="reports-panel">
      <ArticleStats ranking rows={data.moderation?.posts ?? []} />
      <h2>Прохождения и вопросы</h2>
      {(data.moderation?.posts ?? []).map(post => <article key={post.id}>
        <h3>{post.title}</h3>
        <p>Начали {post.started} · Завершили {post.completed} · Вопросов {post.reports?.length ?? 0}</p>
        {!!post.reports?.length && <details><summary>Посмотреть вопросы</summary>
          {post.reports.map(report => <div key={report.id}><p>{report.text}</p><p className="muted">{report.reply || 'Ответа пока нет'}</p></div>)}
        </details>}
      </article>)}
    </section> : section.id === 'queue' ? <Queue key={targetGuide?.id} guides={queue} selectedId={targetGuide?.id} /> : section.id === 'history' ? <History key={targetDecision?.id} decisions={decisions} selectedId={targetDecision?.id} /> : section.id === 'admins' ? <AdminAssignment /> : <Experts experts={experts} />}
  </div>;
}

function AdminAssignment() {
  const { send, pending, notify } = useStore();
  const [email, setEmail] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [assigned, setAssigned] = useState('');
  return <section className={styles.content}>
    <div className={styles.toolbar}><div><h2>Администраторы</h2><p>Выдача доступа к проверке публикаций и управлению ролями.</p></div></div>
    <form className={styles.assignment} onSubmit={async event => {
    event.preventDefault();
    if (!confirming) { setConfirming(true); return; }
    if (await send({ type: 'admin', email: email.trim() })) { setAssigned(email.trim()); setEmail(''); setConfirming(false); notify('Администратор назначен'); }
  }}>
    <h2>Добавить администратора</h2>
    <p className="muted">Пользователь должен быть зарегистрирован. Он получит доступ к модерации, назначению экспертов и других администраторов.</p>
    <div className="field"><label htmlFor="admin-email">Email зарегистрированного пользователя</label>
      <input id="admin-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => { setEmail(event.target.value); setConfirming(false); setAssigned(''); }} /></div>
    {confirming && <p className={styles.confirmation}>Предоставить пользователю {email.trim()} полные права администратора?</p>}
    <div className={styles.assignmentActions}>
      <button className="button button-dark" disabled={pending || !email.trim()}>{pending ? 'Сохраняем…' : confirming ? 'Подтвердить назначение' : 'Продолжить'}</button>
      {confirming && <button className="button button-outline" type="button" disabled={pending} onClick={() => setConfirming(false)}>Отмена</button>}
    </div>
    {assigned && <p className={styles.success} role="status">Права администратора выданы пользователю {assigned}.</p>}
  </form></section>;
}

function Queue({ guides, selectedId }: { guides: Instruction[]; selectedId?: string }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase('ru');
  const visible = guides.filter(guide => [guide.title, guide.author, guide.category].some(value => value.toLocaleLowerCase('ru').includes(needle)));

  return <section className={styles.content}>
    <div className={styles.toolbar}>
      <div><h2>Проверка инструкций</h2><p>Сначала показаны материалы, которые дольше всего ждут решения.</p></div>
      {guides.length > 0 && <input className={styles.search} type="search" aria-label="Поиск по очереди" placeholder="Название, автор или категория" value={query} onChange={event => setQuery(event.target.value)} />}
    </div>
    <AutoModeration />
    {visible.length ? <div className={styles.stack}>{visible.map(guide =>
      <ReviewCard key={`${guide.id}:${guide.revision ?? 0}`} guide={guide} selected={guide.id === selectedId} />
    )}</div> : <div className={styles.empty}>
      <strong>{guides.length ? 'По запросу ничего не найдено' : 'Очередь пуста'}</strong>
      {!guides.length && <p>Здесь появятся инструкции, которые авторы отправят на проверку.</p>}
    </div>}
  </section>;
}

function AutoModeration() {
  const { data, send, pending } = useStore();
  if (data.autoModeration === undefined) return null;
  return <div className={styles.autoModeration}>
    <label>
      <input type="checkbox" role="switch" checked={data.autoModeration === true} disabled={pending}
        aria-describedby="auto-moderation-description"
        onChange={event => void send({ type: 'auto-moderation', enabled: event.target.checked })} />
      Автоматическая модерация с ИИ
    </label>
    <p id="auto-moderation-description" role="status">{data.moderation?.pausedReason || 'ИИ проверяет текущую очередь и новые заявки. Подходящие инструкции публикует, остальные возвращает автору с замечанием или оставляет администратору для проверки.'}</p>
  </div>;
}

function ReviewCard({ guide, selected }: { guide: Instruction; selected: boolean }) {
  const { data, send, pending, notify } = useStore();
  const manualReviewNote = data.moderation?.manualReviewNotes?.[guide.id];
  const [note, setNote] = useState('');
  const noteInput = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState('');

  async function review(decision: 'approve' | 'reject') {
    if (decision === 'reject' && !note.trim()) {
      setError('Укажи, что автору нужно исправить.');
      noteInput.current?.focus();
      return;
    }
    if (await send({ type: 'moderate', guideId: guide.id, revision: guide.revision ?? 0, decision, note })) {
      notify(decision === 'approve' ? 'Инструкция опубликована' : 'Инструкция возвращена автору');
    }
  }

  return <article id={`request-${guide.id}`} className={`review-card ${selected ? styles.selected : ''}`}>
    <div className="panel-heading">
      <div>
        <h3>{guide.title}</h3>
        <p>{guide.teamId && 'Командная · '}{guide.author} · {guide.category}{guide.submittedAt && <> · <time dateTime={guide.submittedAt}>{dateFormat.format(new Date(guide.submittedAt))}</time></>}</p>
      </div>
      <Link href={`/guide?id=${encodeURIComponent(guide.id)}`} className="button button-outline">Предпросмотр <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>
    <p>{guide.description}</p>
    {manualReviewNote && <p className={styles.note}><strong>Требуется проверка администратора. </strong>{manualReviewNote}</p>}
    {guide.source && <p className="fork-origin">Форк «{guide.source.title}». Автор исходника: {guide.source.author}</p>}
    <details className="review-content">
      <summary>Содержание · {guide.steps.length} шагов</summary>
      {guide.steps.map((step, index) => <section key={step.id}>
        <h4>{index + 1}. {step.title}</h4>
        <p>{step.text}</p>
        <StepMedia step={step} />
        {step.code && <pre><code>{step.code}</code></pre>}
        <ul>{step.checks.map((check, position) => <li key={position}>{check}</li>)}</ul>
      </section>)}
    </details>
    <div className="field">
      <label htmlFor={`review-${guide.id}`}>Замечание автору</label>
      <textarea ref={noteInput} id={`review-${guide.id}`} rows={3} maxLength={2000} value={note} aria-invalid={Boolean(error)}
        aria-describedby={error ? `review-error-${guide.id}` : undefined}
        onChange={event => { setNote(event.target.value); setError(''); }} placeholder="При возврате укажи, что исправить." />
    </div>
    {error && <p className="field-error" id={`review-error-${guide.id}`} role="alert">{error}</p>}
    <div className="review-actions">
      <button type="button" className="button button-outline" disabled={pending} onClick={() => void review('reject')}>Вернуть на доработку</button>
      <button type="button" className="button button-dark" disabled={pending} onClick={() => void review('approve')}><Check size={17} aria-hidden="true" />Опубликовать</button>
    </div>
  </article>;
}

function History({ decisions, selectedId }: { decisions: ModerationDecision[]; selectedId?: string }) {
  const [filter, setFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const visible = decisions.filter(item => filter === 'all' || item.approved === (filter === 'approved'))
    .reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return <section className={styles.content}>
    <div className={styles.toolbar}>
      <div><h2>История решений</h2><p>Видно, кто принял решение, когда и с каким замечанием.</p></div>
      <label className={styles.filter}>Решение
        <select value={filter} onChange={event => {
          const value = event.target.value;
          setFilter(value === 'approved' || value === 'rejected' ? value : 'all');
        }}>
          <option value="all">Все</option><option value="approved">Опубликованные</option><option value="rejected">Возвращённые</option>
        </select>
      </label>
    </div>
    {visible.length ? <ul className={styles.stack}>{visible.map(item => <li key={item.id} id={`decision-${item.id}`} className={`${styles.decision} ${selectedId === item.id ? styles.selected : ''}`}>
      <div className={styles.decisionHeading}>
        <h3>{item.title}</h3><span className={`status ${item.approved ? 'published' : 'rejected'}`}>{item.approved ? 'Опубликована' : 'На доработку'}</span>
      </div>
      <p className="muted">{item.author} · Решение принял: {item.reviewer || 'Администратор'} · <time dateTime={item.createdAt}>{dateFormat.format(new Date(item.createdAt))}</time></p>
      {item.note && <p className={styles.note}>{item.note}</p>}
    </li>)}</ul> : <div className={styles.empty}>{filter === 'all' ? 'Решений пока нет.' : 'По этому фильтру решений нет.'}</div>}
  </section>;
}

function Experts({ experts }: { experts: ExpertSummary[] }) {
  const { send, pending, notify } = useStore();
  const [email, setEmail] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const sorted = [...experts].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  async function change(enabled: boolean) {
    if (await send({ type: 'expert', email: email.trim(), enabled })) {
      setEmail('');
      notify(enabled ? 'Эксперт назначен' : 'Роль эксперта отозвана');
    }
  }

  return <div className={styles.expertGrid}>
    <section className={styles.expertPanel}>
      <h2>Назначение экспертов</h2>
      <p>Введи email пользователя с подпиской, чтобы назначить его экспертом. Роль можно отозвать по тому же email.</p>
      <div className="field">
        <label htmlFor="expert-email">Email пользователя</label>
        <input ref={input} id="expert-email" inputMode="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
      </div>
      <div className="utility-actions">
        <button type="button" className="button button-dark" disabled={pending || !email.trim()} onClick={() => void change(true)}>Назначить экспертом</button>
        <button type="button" className="button button-outline" disabled={pending || !email.trim()} onClick={() => void change(false)}>Отозвать роль</button>
      </div>
    </section>
    <section className={styles.expertPanel}>
      <h2>Назначенные эксперты <span className={styles.count}>{experts.length}</span></h2>
      {sorted.length ? <ul className={styles.roster}>{sorted.map(expert => <li key={expert.id}>
        <div><strong>{expert.name}</strong><span>{expert.email}</span><span>{expert.active ? 'Подписка активна' : 'Без активной подписки'}</span></div>
        <button type="button" className="text-button" disabled={pending} aria-label={`Выбрать эксперта ${expert.name}`} onClick={() => {
          setEmail(expert.email);
          input.current?.focus();
        }}>Выбрать</button>
      </li>)}</ul> : <p>Экспертов пока нет.</p>}
    </section>
  </div>;
}
