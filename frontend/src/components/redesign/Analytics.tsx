'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ArrowLeft, ArrowUpRight, MessageCircle } from 'lucide-react';
import type { Instruction } from '@shared/community';
import { useStore } from './store';

export function Analytics({ guide }: { guide?: Instruction }) {
  const { data, refresh } = useStore();
  useEffect(() => { void refresh(); }, [refresh]);
  const stats = guide && data.analytics[guide.id];
  if (!guide || !stats) return <div className="empty-state">
    <h1>Статистика доступна автору</h1><Link href="/author">Мои инструкции</Link>
  </div>;
  const worst = stats.steps.reduce<typeof stats.steps[number] | undefined>((best, step) => {
    const signals = step.stopped + step.questions;
    return signals > (best ? best.stopped + best.questions : 0) ? step : best;
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
      <div><span className="section-label">Шаг, который стоит проверить</span><h2>{worstStep.title}</h2>
        <p>Остановились на шаге: {worst.stopped}. Попросили помощь: {worst.questions}.</p>
      </div>
      <Link href={`/editor?id=${guide.id}`} className="button button-dark">Открыть редактор</Link>
    </section>}
    <section className="analytics-table-panel">
      <h2>Прохождение по шагам</h2>
      <p className="muted">Остановкой считаем 30 минут без действий на последнем незавершённом шаге. Предпросмотр автора не входит в статистику.</p>
      <div className="table-scroll"><table>
        <thead><tr><th>Шаг</th><th>Открыли</th><th>Выполнили</th><th>Остановились</th><th>Попросили помощь</th></tr></thead>
        <tbody>{stats.steps.map((step, index) => <tr key={step.stepId} className={worst?.stepId === step.stepId ? 'problem-row' : undefined}>
          <th scope="row"><span>{index + 1}. {guide.steps[index].title}</span>
            <div className="progress-track"><span style={{ width: `${step.started ? step.completed / step.started * 100 : 0}%` }} /></div>
          </th>
          <td>{step.started}</td><td>{step.completed}</td><td>{step.stopped}</td><td>{step.questions}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
    <section className="reports-panel"><h2><MessageCircle size={22} />Вопросы к шагам</h2>
      {stats.reports.length ? stats.reports.map(report => <article key={report.id}>
        <span className="section-label">{guide.steps.find(step => step.id === report.stepId)?.title || 'Удалённый шаг'}</span>
        <p>{report.text}</p>
      </article>) : <p className="muted">Пока вопросов нет.</p>}
    </section>
  </>;
}
