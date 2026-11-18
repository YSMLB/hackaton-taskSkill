'use client';

import { useSyncExternalStore } from 'react';
import { useState } from 'react';
import { ArrowLeft, BookOpen, Trash2 } from 'lucide-react';
import { offlineGuides, writeOfflineGuides, type OfflineGuide } from '@/lib/offline-guides';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function OfflineLibrary() {
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  return mounted ? <SavedGuides /> : <main className="offline-page"><h1>Офлайн-библиотека</h1></main>;
}

function SavedGuides() {
  const [items, setItems] = useState(offlineGuides);
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState('');
  const active = items.find(item => item.guide.id === selected);

  function update(next: OfflineGuide[]) {
    try { writeOfflineGuides(next); setItems(next); setError(''); }
    catch { setError('Не удалось сохранить изменения на устройстве.'); }
  }

  function setCheck(stepId: string, index: number, checked: boolean) {
    if (!active) return;
    const ticks = active.checked[stepId] || [];
    const values = checked ? [...new Set([...ticks, index])] : ticks.filter(item => item !== index);
    update(items.map(item => item.guide.id === selected ? { ...item, checked: { ...item.checked, [stepId]: values } } : item));
  }

  return <main id="main-content" className="offline-page">
    <a className="back-link" href="/catalog"><ArrowLeft size={17} />Каталог</a>
    <h1>Офлайн-библиотека</h1>
    <p className="muted">Сохранённые копии и отметки доступны на этом устройстве без интернета.</p>
    {error && <p className="field-error" role="alert">{error}</p>}
    {active ? <>
      <button type="button" className="text-button" onClick={() => setSelected(undefined)}><ArrowLeft size={17} />К сохранённым инструкциям</button>
      <article className="offline-guide">
        <h2>{active.guide.title}</h2><p>{active.guide.description}</p>
        {active.guide.steps.map((step, index) => <section key={step.id}>
          <h3>{index + 1}. {step.title}</h3><p>{step.text}</p>
          {step.code && <pre><code>{step.code}</code></pre>}
          <div className="checklist">{step.checks.map((check, i) => <label key={i}><input type="checkbox" checked={active.checked[step.id]?.includes(i) || false} onChange={event => setCheck(step.id, i, event.target.checked)} /><span>{check}</span></label>)}</div>
        </section>)}
      </article>
    </> : <div className="offline-items">
      {items.length ? items.map(item => <article key={item.guide.id} className="offline-item">
        <button type="button" className="text-button" onClick={() => setSelected(item.guide.id)}><BookOpen size={18} />{item.guide.title}</button>
        <button type="button" className="icon-button" aria-label={`Удалить копию: ${item.guide.title}`} onClick={() => update(items.filter(entry => entry.guide.id !== item.guide.id))}><Trash2 size={18} /></button>
      </article>) : <p className="offline-item">Открой опубликованную инструкцию и нажми «Сохранить офлайн».</p>}
    </div>}
  </main>;
}
