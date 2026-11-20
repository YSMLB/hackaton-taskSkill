'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Instruction } from '@shared/community';
import { GuideCover } from './GuideCover';
import { StepMedia } from './StepMedia';
import styles from './DraftPreview.module.css';

export function DraftPreview({ guide, initialStep, onClose }: {
  guide: Instruction;
  initialStep: number;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState(initialStep);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const step = guide.steps[current];
  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return <dialog aria-labelledby="draft-preview-title" className={styles.dialog} ref={dialog}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className={styles.inner}>
      <header className={styles.toolbar}>
        <button type="button" className="button button-outline" onClick={onClose}>
          <ArrowLeft size={17} />Вернуться в редактор
        </button>
        <span className="section-label">Предпросмотр</span>
      </header>
      <h1 id="draft-preview-title" className="player-guide-title">{guide.title || 'Без названия'}</h1>
      {guide.description && <p className={styles.description}>{guide.description}</p>}
      <div className={styles.meta}>
        <span className="pill">{guide.category}</span><span>{guide.minutes} мин</span>
        {guide.aiGenerated && <span className="pill">Создано с ИИ</span>}
      </div>
      {guide.cover && <div className={styles.cover}><GuideCover cover={guide.cover} /></div>}
      <article className="player-step">
        <label className={styles.stepSelect}>Шаг инструкции
          <select value={current} onChange={event => setCurrent(Number(event.target.value))}>
            {guide.steps.map((item, index) => <option key={item.id} value={index}>{index + 1}. {item.title || 'Без названия'}</option>)}
          </select>
        </label>
        <h2>{step.title || 'Новый шаг'}</h2>
        <p className="step-text">{step.text}</p>
        <StepMedia step={{ ...step, imageUrl: step.imageUrl?.startsWith('https://') ? step.imageUrl : undefined,
          videoUrl: step.videoUrl?.startsWith('https://') ? step.videoUrl : undefined }} />
        {step.code && <div className="code-panel"><div>{step.filename || 'Команда'}</div><pre><code>{step.code}</code></pre></div>}
        {step.checks.some(check => check.trim()) && <fieldset className={styles.checklist}>
          <legend>Проверь перед следующим шагом</legend>
          {step.checks.map((check, index) => {
            const key = step.id + ':' + index;
            return check.trim() && <label key={key}><input type="checkbox" checked={!!checked[key]}
              onChange={event => setChecked({ ...checked, [key]: event.target.checked })} />{check}</label>;
          })}
        </fieldset>}
        <div className={styles.actions}>
          <button className="button button-outline" type="button" disabled={current === 0} onClick={() => setCurrent(current - 1)}><ChevronLeft size={16} />Назад</button>
          {current < guide.steps.length - 1
            ? <button className="button button-dark" type="button" onClick={() => setCurrent(current + 1)}>Далее<ChevronRight size={16} /></button>
            : <button className="button button-dark" type="button" onClick={onClose}>Завершить просмотр</button>}
        </div>
      </article>
    </div>
  </dialog>;
}
