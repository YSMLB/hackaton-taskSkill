'use client';

import Image from 'next/image';
import { Check, Paperclip, Plus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import type { Instruction, Step } from '@shared/community';
import { useStore } from './store';
import styles from './MentorChat.module.css';

type Screenshot = { name: string; url: string };
type Turn = { question: string; answer: string; screenshot?: Screenshot };


type Thread = {
  turns: Turn[];
  question: string;
  screenshot?: Screenshot;
  sending?: string;
  reading?: boolean;
  error?: string;
};

const emptyThread: Thread = { turns: [], question: '' };

type MentorChatProps = { open?: boolean; id?: string } & (
  | { guide: Instruction; step: Step; onClose: () => void }
  | { guide?: never; step?: never; onClose?: never }
);

export function MentorChat({ guide, step, open = true, id, onClose }: MentorChatProps) {
  const { data } = useStore();
  const headingId = useId();
  const messageId = headingId + '-message';
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const requests = useRef(new Map<string, AbortController>());
  const panel = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messages = useRef<HTMLDivElement>(null);
  const standalone = !step;
  const threadKey = step?.id ?? 'chat';
  const thread = threads[threadKey] ?? emptyThread;
  const current = guide?.steps.findIndex(item => item.id === step?.id) ?? -1;
  const completed = guide?.steps.slice(0, current).filter(item => data.runs[guide.id]?.completed.includes(item.id)) ?? [];

  useEffect(() => {
    const controllers = requests.current;
    return () => {
      for (const controller of controllers.values()) controller.abort();
    };
  }, []);
  useEffect(() => {
    if (!open || standalone) return;
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ block: 'nearest' });
  }, [open, standalone]);
  useEffect(() => {
    const log = messages.current;
    if (open && log) log.scrollTop = log.scrollHeight;
  }, [open, threadKey, thread.turns.length, thread.sending]);

  function update(stepId: string, patch: Partial<Thread>) {
    setThreads(previous => ({
      ...previous,
      [stepId]: { ...(previous[stepId] ?? emptyThread), ...patch },
    }));
  }

  function attach(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const stepId = threadKey;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !file.size || file.size > 2 * 1024 * 1024) {
      update(stepId, { error: 'Выбери PNG, JPEG или WebP размером до 2 МБ.' });
      return;
    }
    update(stepId, { reading: true, error: '' });
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        update(stepId, { screenshot: { name: file.name, url: reader.result }, reading: false });
      } else {
        update(stepId, { error: 'Не удалось открыть скриншот.', reading: false });
      }
    };
    reader.onerror = () => update(stepId, { error: 'Не удалось открыть скриншот.', reading: false });
    reader.readAsDataURL(file);
  }

  async function send(message: string) {
    const stepId = threadKey;
    if (requests.current.has(stepId) || thread.reading) return;
    const controller = new AbortController();
    requests.current.set(stepId, controller);
    update(stepId, { sending: message, question: '', error: '' });
    const timeout = setTimeout(() => controller.abort(), 100_000);
    try {
      const previousScreenshot = [...thread.turns].reverse().find(turn => turn.screenshot)?.screenshot;
      const response = await fetch(step ? '/api/ai/step-hint' : '/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          guideId: guide?.id,
          stepId: step?.id,
          question: message,
          history: thread.turns.slice(-6).map(({ question, answer }) => ({ question, answer })),
          screenshot: (thread.screenshot ?? previousScreenshot)?.url,
        }),
      });
      const result: { hint?: string; message?: string } = await response.json();
      if (!response.ok || !result.hint) throw new Error(result.message || 'Не удалось получить ответ. Попробуй ещё раз.');
      if (controller.signal.aborted) return;
      update(stepId, {
        turns: [...thread.turns, { question: message, answer: result.hint, screenshot: thread.screenshot }],
        question: '',
        screenshot: undefined,
      });
    } catch (cause) {
      update(stepId, {
        question: message,
        error: cause instanceof Error && !(cause instanceof TypeError) && !(cause instanceof SyntaxError)
          ? (controller.signal.aborted ? 'Ответ занял слишком много времени. Попробуй ещё раз.' : cause.message) : 'Не удалось связаться с сервером. Попробуй ещё раз.',
      });
    } finally {
      clearTimeout(timeout);
      requests.current.delete(stepId);
      update(stepId, { sending: undefined });
    }
  }

  const pending = Boolean(thread.sending);
  const Heading = step ? 'h2' : 'h1';
  return <section ref={panel} className={step ? styles.chat : `${styles.chat} ${styles.standalone}`} id={id} hidden={!open} tabIndex={-1} aria-labelledby={headingId}
    onKeyDown={event => {
      if (event.key === 'Escape' && onClose) { event.stopPropagation(); onClose(); }
    }}>
    <div className={styles.chatHeading}>
      <div><Heading id={headingId}>Artem.AI</Heading>{step && <p>Шаг {current + 1} из {guide.steps.length} · {step.title}</p>}</div>
      {onClose ? <button className="icon-button" type="button" aria-label="Закрыть Artem.AI" onClick={onClose}>
        <X size={19} aria-hidden="true" />
      </button> : <button className="button button-outline" type="button" disabled={pending || thread.reading}
        onClick={() => setThreads({})}><Plus size={17} aria-hidden="true" />Новый чат</button>}
    </div>
    {completed.length > 0 && <details className={styles.context}>
      <summary>Выполненные шаги</summary>
      <ul>{completed.map(item => <li key={item.id}><Check size={15} aria-hidden="true" />{item.title}</li>)}</ul>
    </details>}
    <div ref={messages} className={styles.messages} role="log" aria-label="Переписка">
      {!thread.turns.length && !pending && <div className={styles.welcome}>
        <p>{step ? 'Спроси про этот шаг или прикрепи скриншот ошибки.' : 'Напиши вопрос или приложи скриншот.'}</p>
        {step && !thread.question && !thread.screenshot && <div className={styles.suggestions}>
          <button type="button" onClick={() => void send('Объясни этот шаг простыми словами.')}>Объясни проще</button>
          <button type="button" onClick={() => void send('Как проверить, что шаг выполнен правильно?')}>Как проверить результат?</button>
        </div>}
      </div>}
      {thread.turns.map((turn, index) => <div className={styles.turn} key={index}>
        <div className={styles.question}>
          <b>Ты</b><p>{turn.question}</p>
          {turn.screenshot && <Image unoptimized src={turn.screenshot.url} alt="Приложенный скриншот ошибки" width={280} height={180} />}
        </div>
        <div className={styles.answer}><b>Artem.AI</b><p>{turn.answer}</p></div>
      </div>)}
      {pending && <div className={styles.turn}>
        <div className={styles.question}><b>Ты</b><p>{thread.sending}</p></div>
        <p className="muted" role="status">Artem.AI готовит ответ…</p>
      </div>}
    </div>
    <form className={styles.composer} onSubmit={event => {
      event.preventDefault();
      const message = thread.question.trim() || (thread.screenshot ? 'Помоги разобраться со скриншотом.' : '');
      if (message) void send(message);
    }}>
      {thread.error && <p className="field-error" role="alert">{thread.error}</p>}
      <label htmlFor={messageId}>Сообщение</label>
      <textarea id={messageId} maxLength={1500} rows={3} value={thread.question} readOnly={pending}
        onKeyDown={event => {
          if (step || event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }}
        onChange={event => update(threadKey, { question: event.target.value })}
        placeholder={step ? 'Что не получилось на этом шаге?' : 'Напиши сообщение'} />
      <input ref={fileInput} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={attach} />
      {thread.screenshot && <div className={styles.attachment}>
        <Image unoptimized src={thread.screenshot.url} alt="Предпросмотр скриншота" width={64} height={48} />
        <span>{thread.screenshot.name}</span>
        <button className="text-button" type="button" disabled={pending || thread.reading}
          onClick={() => update(threadKey, { screenshot: undefined })}>Убрать</button>
      </div>}
      <div className={styles.actions}>
        <button className="button button-outline" type="button" disabled={pending || thread.reading} onClick={() => fileInput.current?.click()}>
          <Paperclip size={16} aria-hidden="true" />Скриншот
        </button>
        <button className="button button-dark" type="submit" disabled={pending || thread.reading || (!thread.question.trim() && !thread.screenshot)}>
          Отправить
        </button>
      </div>
    </form>
  </section>;
}
