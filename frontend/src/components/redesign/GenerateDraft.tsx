'use client';

import { useEffect, useRef, useState } from 'react';
import type { Instruction } from '@shared/community';

type Draft = Pick<Instruction, 'title' | 'description' | 'category' | 'minutes' | 'steps'>;

export function GenerateDraft({ onApply }: { onApply: (draft: Draft) => void }) {
  const [prompt, setPrompt] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);

  async function generate() {
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/ai/generate-guide', {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Не удалось создать черновик.');
      const { title, description, category, minutes, steps } = result.guide as Instruction;
      if (controller.signal.aborted) return;
      onApply({ title, description, category, minutes, steps });
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
      <textarea id="draft-prompt" maxLength={1000} value={prompt} onChange={e => setPrompt(e.target.value)}
        placeholder="Например, как подготовить отчёт по лабораторной" />
    </div>
    <button className="button button-outline" type="button" disabled={pending || prompt.trim().length < 5}
      onClick={generate}>{pending ? 'Готовим черновик…' : 'Создать черновик с ИИ'}</button>
    {error && <p className="validation-error" role="alert">{error}</p>}
  </section>;
}
