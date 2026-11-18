'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Instruction } from '@shared/community';

export function EmbeddedGuide({ guide }: { guide: Pick<Instruction, 'id' | 'title' | 'description' | 'steps'> }) {
  const [index, setIndex] = useState(0);
  const [checks, setChecks] = useState<Record<string, boolean[]>>({});
  const [finished, setFinished] = useState(false);
  const step = guide.steps[index];
  const canAdvance = step?.checks.every((_, i) => checks[step.id]?.[i]);
  return <main className="embed-page">
    <header><span>StepFlow</span><h1>{guide.title}</h1><p>{guide.description}</p></header>
    {finished ? <section className="embed-step"><h2>Инструкция пройдена</h2>
      <button className="button button-outline" type="button" onClick={() => { setFinished(false); setIndex(0); setChecks({}); }}>Начать заново</button>
    </section> : step && <section className="embed-step">
      <p className="small-note">Шаг {index + 1} из {guide.steps.length}</p>
      <div className="progress-track"><span style={{ width: `${index / guide.steps.length * 100}%` }} /></div>
      <h2>{step.title}</h2><p className="embed-text">{step.text}</p>
      {step.code && <pre><code>{step.code}</code></pre>}
      <div className="checklist">{step.checks.map((check, i) => <label key={i}>
        <input type="checkbox" checked={checks[step.id]?.[i] || false} onChange={event => {
          const value = event.target.checked;
          setChecks(current => {
            const next = [...(current[step.id] || [])];
            next[i] = value;
            return { ...current, [step.id]: next };
          });
        }} /><span>{check}</span>
      </label>)}</div>
      <div className="step-actions">
        <button className="button button-outline" type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft size={16} />Назад</button>
        <button className="button button-dark" type="button" disabled={!canAdvance} onClick={() => {
          if (index + 1 === guide.steps.length) setFinished(true);
          else setIndex(index + 1);
        }}>{index + 1 === guide.steps.length ? 'Завершить' : 'Дальше'}<ChevronRight size={16} /></button>
      </div>
    </section>}
    <a className="back-link" href={`/guide?id=${encodeURIComponent(guide.id)}`} target="_blank" rel="noopener noreferrer">Открыть в StepFlow</a>
  </main>;
}
