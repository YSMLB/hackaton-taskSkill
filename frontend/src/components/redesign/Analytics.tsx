'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, MessageCircle } from 'lucide-react';
import type { Instruction } from '@shared/community';
import { useStore } from './store';

export function Analytics({ guide }: { guide?: Instruction }) {
  const { data, refresh, send, pending } = useStore();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  useEffect(() => { void refresh(); }, [refresh]);
  const stats = guide && data.analytics[guide.id];
  const hasStats = Boolean(stats);
  useEffect(() => {
    const anchor = location.hash.slice(1);
    if (hasStats && anchor.startsWith('question-')) document.getElementById(anchor)?.scrollIntoView({ block: 'nearest' });
  }, [guide?.id, hasStats]);
  if (!guide || !stats) return <div className="empty-state">
    <h1>Статистика доступна автору</h1><Link href="/author">Мои инструкции</Link>
  </div>;
  const worst = stats.steps.reduce<typeof stats.steps[number] | undefined>((best, step) => {
    const signals = step.stopped + (step.questionAuthors ?? step.questions);
    const bestSignals = best ? best.stopped + (best.questionAuthors ?? best.questions) : 0;
    return signals > bestSignals ? step : best;
  }, undefined);
  const worstStep = worst && guide.steps.find(step => step.id === worst.stepId);

  return <>
    <Link href="/author" className="back-link"><ArrowLeft size={17} />Мои инструкции</Link>
    <div className="page-heading"><div><span className="section-label">Статистика прохождений</span><h1>{guide.title}</h1></div>
      <Link className="button button-dark" href={`/editor?id=${guide.id}`}>Редактировать <ArrowUpRight size={17} /></Link>
    </div>
    <div className="metric-grid">
      <div><span>Начали</span><strong>{stats.started}</strong></div>
      <div><span>Завершили</span><strong>{stats.completed}</strong></div>
      <div><span>Вопросов к шагам</span><strong>{stats.reports.length}</strong></div>
    </div>
    {worstStep && worst && <section className="bottleneck-panel">
      <div><span className="section-label">Где нужна помощь</span><h2>{worstStep.title}</h2>
        <p>Открыли шаг: {worst.started}. Незавершённых прохождений: {worst.stopped}. Вопросов: {worst.questions}.</p>
      </div>
      <Link href={`/editor?id=${guide.id}`} className="button button-dark">Открыть редактор</Link>
    </section>}
    <section className="analytics-table-panel">
      <h2>Прохождение по шагам</h2>
      <p className="muted">В колонке «Открыли шаг» каждый читатель учитывается один раз. Последний незавершённый шаг показывает текущий прогресс. Предпросмотр автора не учитывается.</p>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Статистика по шагам"><table>
        <thead><tr><th>Шаг</th><th>Открыли шаг</th><th>Выполнили</th><th>Последний незавершённый шаг</th><th>Вопросов</th></tr></thead>
        <tbody>{stats.steps.map((step, index) => <tr key={step.stepId} className={worst?.stepId === step.stepId ? 'problem-row' : undefined}>
          <th scope="row"><span>{index + 1}. {guide.steps[index].title}</span>
            <div className="progress-track"><span style={{ width: `${step.started ? step.completed / step.started * 100 : 0}%` }} /></div>
          </th>
          <td>{step.started}</td><td>{step.completed}</td><td>{step.stopped}</td><td>{step.questions}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
    <section className="reports-panel"><h2><MessageCircle size={22} />Вопросы к шагам</h2>
      {stats.reports.length ? stats.reports.map(report => <article key={report.id} id={`question-${report.id}`}>
        <span className="section-label">{guide.steps.find(step => step.id === report.stepId)?.title || 'Удалённый шаг'}</span>
        <p>{report.text}</p>
        {report.reply ? <p><strong>Ответ:</strong> {report.reply}</p> : <form className="account-tool-form" onSubmit={async event => {
          event.preventDefault();
          await send({ type: 'reply', guideId: guide.id, reportId: report.id, text: answers[report.id] || '' });
        }}>
          <div className="field"><label htmlFor={'reply-' + report.id}>Ответить на вопрос</label><textarea id={'reply-' + report.id} maxLength={2000} value={answers[report.id] || ''} onChange={event => setAnswers({ ...answers, [report.id]: event.target.value })} /></div>
          <button className="button button-outline" disabled={pending || !answers[report.id]?.trim()}>Отправить ответ</button>
        </form>}
      </article>) : <p className="muted">Пока вопросов нет.</p>}
    </section>
  </>;
}
