'use client';

import { useEffect, useRef, useState } from 'react';
import type { Instruction } from '@shared/community';
import styles from './GenerateDraft.module.css';

type Draft = Pick<Instruction, 'title' | 'description' | 'category' | 'minutes' | 'steps'>;
type Variant = Draft & Pick<Instruction, 'id'>;

export function GenerateDraft({ onApply }: { onApply: (draft: Draft) => void }) {
  const [prompt, setPrompt] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [fallback, setFallback] = useState(false);

  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);

  async function generate() {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);
    setError('');
    setVariants([]);
    setFallback(false);
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
      setFallback(result.fallback === true);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Не удалось получить ответ.');
    } finally {
      activeRequest.current = null;
      setPending(false);
    }
  }

  return <section className="editor-templates" aria-label="Черновик с ИИ">
    <div className="field"><label htmlFor="draft-prompt">Тема инструкции для ИИ</label>
      <textarea id="draft-prompt" maxLength={1000} value={prompt} disabled={pending} onChange={e => {
        setPrompt(e.target.value);
        setVariants([]);
        setError('');
      }}
        placeholder="Например, как подготовить отчёт по лабораторной" />
    </div>
    <button className="button button-outline" type="button" disabled={pending || prompt.trim().length < 5}
      onClick={generate}>{pending ? 'Готовим варианты…' : 'Предложить варианты с ИИ'}</button>
    <p className={styles.status} role="status">
      {pending && 'ИИ готовит черновики.'}
      {variants.length > 0 && (fallback ? 'ИИ недоступен. Можно использовать черновик из шаблона.' : `Готово вариантов: ${variants.length}. Открой шаги и выбери подходящий.`)}
    </p>
    {error && <p className="validation-error" role="alert">{error}</p>}
    {variants.length > 0 && <>
      <ul className={styles.variants}>
        {variants.map((variant, index) => <li key={variant.id} className={styles.variant}>
          <h3>{variant.title}</h3>
          <p>{variant.description}</p>
          <p className={styles.meta}>{variant.minutes} мин · Количество шагов: {variant.steps.length}</p>
          <details className={styles.preview}>
            <summary>Посмотреть шаги</summary>
            <ol>
              {variant.steps.map(step => <li key={step.id}>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
                {step.code && <pre><code>{step.code}</code></pre>}
                <ul>{step.checks.map((check, i) => <li key={i}>{check}</li>)}</ul>
              </li>)}
            </ol>
          </details>
          <button className="button button-dark" type="button" aria-label={`Использовать вариант ${index + 1}`} onClick={() => {
            const { title, description, category, minutes, steps } = variant;
            onApply({ title, description, category, minutes, steps });
          }}>Использовать вариант</button>
        </li>)}
      </ul>
      <button className="text-button" type="button" onClick={() => {
        setVariants([]);
        document.getElementById('draft-prompt')?.focus();
      }}>Скрыть варианты</button>
    </>}
  </section>;
}
