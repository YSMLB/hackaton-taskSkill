'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Check, MessageSquare, ShieldCheck } from 'lucide-react';
import { isAdmin, publicationLabels, type Instruction } from '@/lib/community';
import { useStore } from './store';

export function Moderation() {
  const { data, profile } = useStore();
  const [filter, setFilter] = useState('pending');
  if (!isAdmin(profile)) return <div className="empty-state"><ShieldCheck size={32} /><h1>Проверка доступна администратору</h1><p>Для демонстрации выйди из профиля и выбери роль «Администратор (демо)» при регистрации.</p><Link href="/author" className="button button-dark">Мои инструкции</Link></div>;
  const guides = data.guides.filter(g => filter === 'pending' ? g.status === 'pending' : Boolean(g.reviewedAt)).sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  return <><div className="page-heading"><div><span className="section-label">Модерация</span><h1>Проверка инструкций</h1><p>Одобри материал для каталога или верни автору с конкретным замечанием.</p></div><span className="pill">В очереди: {data.guides.filter(g => g.status === 'pending').length}</span></div>
    <div className="category-filters moderation-filters"><button className={filter === 'pending' ? 'active' : ''} onClick={() => setFilter('pending')}>На проверке</button><button className={filter === 'history' ? 'active' : ''} onClick={() => setFilter('history')}>Решения</button></div>
    {guides.length ? <div className="moderation-list">{guides.map(g => <ReviewCard key={`${g.id}-${g.status}-${g.submittedAt}`} guide={g} />)}</div> : <div className="empty-state"><ShieldCheck size={32} /><h2>{filter === 'pending' ? 'Очередь пуста' : 'Пока нет решений'}</h2><p>После отправки автором инструкция появится здесь.</p></div>}
    <p className="workspace-disclaimer">На стенде роль администратора можно выбрать при регистрации.</p></>;
}

function ReviewCard({ guide }: { guide: Instruction }) {
  const { send, pending, notify } = useStore();
  async function review(decision: 'approve' | 'reject') {
    if (await send({ type: 'moderate', guideId: guide.id, decision, note })) {
      notify(decision === 'approve' ? 'Инструкция опубликована' : 'Инструкция возвращена автору');
    }
  }
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  return <article className="review-card"><div className="panel-heading"><div><span className={`status ${guide.status}`}>{publicationLabels[guide.status]}</span><h2>{guide.title}</h2><p>Автор: {guide.author}</p></div><Link href={`/guide?id=${guide.id}`} className="button button-outline">Открыть <ArrowUpRight size={17} /></Link></div><p>{guide.description}</p>
    {guide.source && <p className="fork-origin">Форк «{guide.source.title}». Автор исходника: {guide.source.author}</p>}
    <details className="review-content"><summary>Содержание: {guide.steps.length} шагов</summary>{guide.steps.map((s, i) => <section key={s.id}><h3>{i + 1}. {s.title}</h3><p>{s.text}</p>{s.code && <pre><code>{s.code}</code></pre>}<ul>{s.checks.map((c, index) => <li key={index}>{c}</li>)}</ul></section>)}</details>
    {guide.status === 'pending' ? <><div className="field"><label htmlFor={`review-${guide.id}`}>Замечание автору</label><textarea id={`review-${guide.id}`} rows={3} maxLength={2000} value={note} onChange={e => { setNote(e.target.value); setError(''); }} placeholder="Что нужно исправить? Обязательно при возврате." /></div>{error && <p className="field-error" role="alert">{error}</p>}<div className="review-actions"><button className="button button-outline" disabled={pending} onClick={() => { if (!note.trim()) { setError('Напиши причину возврата, чтобы автор понял, что изменить.'); return; } void review('reject'); }}><MessageSquare size={17} />Вернуть на доработку</button><button className="button button-dark" disabled={pending} onClick={() => void review('approve')}><Check size={17} />Одобрить и опубликовать</button></div></> : <div className="review-decision"><p>{guide.moderationNote || 'Одобрено без замечаний.'}</p><span className="small-note">Решение: {guide.reviewedBy || 'Администратор'}</span></div>}
  </article>;
}
