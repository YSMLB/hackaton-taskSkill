'use client';

import { useEffect, useRef, useState } from 'react';
import type { Instruction } from '@shared/community';
import styles from './GenerateDraft.module.css';

type Draft = Pick<Instruction, 'title' | 'description' | 'category' | 'minutes' | 'steps'>;
type Variant = Draft & Pick<Instruction, 'id'>;

export function GenerateDraft({ onApply }: { onApply: (draft: Draft) => Promise<boolean> }) {
  const [prompt, setPrompt] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [editingTopic, setEditingTopic] = useState(true);
  const [lastTopic, setLastTopic] = useState('');
  const [applied, setApplied] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);


  const activeRequest = useRef<AbortController | null>(null);
  const canGenerate = !pending && prompt.trim().length >= 5;
  useEffect(() => () => activeRequest.current?.abort(), []);

  async function generate() {
    if (!canGenerate || activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);
    setError('');
    setPreview(null);

    try {
      const response = await fetch('/api/ai/generate-guide', {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const result = await response.json() as { variants?: Variant[]; message?: string; fallback?: boolean };
      if (!response.ok) throw new Error(result.message || 'Не удалось создать черновик.');
      if (controller.signal.aborted) return;
      if (!result.variants?.length) throw new Error('ИИ не предложил вариантов. Попробуй уточнить тему.');
      setVariants(result.variants);
      setLastTopic(prompt.trim());
      setEditingTopic(false);

    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Не удалось получить ответ.');
    } finally {
      activeRequest.current = null;
      setPending(false);
    }
  }

  const selected = variants.find(item => item.id === preview);
  if (applied) return <section className={styles.panel}>
    <strong>Вариант открыт в редакторе</strong>
    <button type="button" className="button button-outline" onClick={() => { setApplied(false); setPreview(null); }}>Вернуться к вариантам ({variants.length})</button>
  </section>;

  return <section className={styles.panel} aria-label="Черновик с ИИ">
    {editingTopic ? <>
      <div className="field"><label htmlFor="draft-prompt">Какую инструкцию составить?</label>
        <textarea id="draft-prompt" rows={2} maxLength={1000} value={prompt} disabled={pending}
          enterKeyHint="send"
          onKeyDown={event => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            event.preventDefault();
            if (!event.repeat) void generate();
          }}
          placeholder="Например, как собрать презентацию к защите проекта" onChange={event => { setPrompt(event.target.value); setError(''); }} />
      </div>
      {error && <p className="validation-error" role="alert">{error}</p>}
      <button className="button button-dark" type="button" disabled={!canGenerate}
        onClick={generate}>{pending ? 'Alina.AI готовит варианты…' : 'Предложить варианты с ИИ'}</button>
      {variants.length > 0 && <button className="text-button" type="button" disabled={pending} onClick={() => {
        setEditingTopic(false); setError(''); setPreview(null);
      }}>К предыдущим вариантам ({variants.length})</button>}
    </> : selected ? <>
      <button className="text-button" type="button" onClick={() => setPreview(null)}>← Ко всем вариантам</button>
      <h2>{selected.title}</h2><p>{selected.description}</p>
      <ol className={styles.steps}>{selected.steps.map((step,i) => <li key={i}><strong>{step.title}</strong><p>{step.text}</p>
        {step.code && <pre><code>{step.code}</code></pre>}<ul>{step.checks.map((c,j) => <li key={j}>{c}</li>)}</ul></li>)}</ol>
      <button type="button" className="button button-dark" onClick={async () => {
        const { title, description, category, minutes, steps } = selected;
        if (await onApply({ title, description, category, minutes, steps })) setApplied(true);
      }}>Открыть в редакторе</button>
    </> : <>
      <div className={styles.heading}><div><h2>Выбери вариант инструкции</h2><p>{lastTopic}</p></div>
        <button type="button" className="text-button" onClick={() => setEditingTopic(true)}>Изменить тему</button></div>
      <ul className={styles.cards}>{variants.map(variant => <li key={variant.id}>
        <button type="button" className={styles.card} onClick={() => setPreview(variant.id)}>
          <strong>{variant.title}</strong><span>{variant.description}</span>
          <small>{variant.minutes} мин · Шагов: {variant.steps.length}</small><b>Посмотреть шаги →</b>
        </button></li>)}</ul>
    </>}
  </section>;
}
