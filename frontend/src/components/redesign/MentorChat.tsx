'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Paperclip } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { Instruction, Step } from '@shared/community';
import { useStore } from './store';
import styles from './MentorChat.module.css';

type Screenshot = { name: string; url: string };
type Turn = { question: string; answer: string; screenshot?: Screenshot };

export function MentorStart({ guides, unavailable }: { guides: Instruction[]; unavailable: boolean }) {
  const { data } = useStore();
  const router = useRouter();
  const [guideId, setGuideId] = useState('');
  const [stepId, setStepId] = useState('');
  const recent = guides.filter(guide => data.runs[guide.id])
    .sort((a, b) => (data.runs[b.id].updatedAt || 0) - (data.runs[a.id].updatedAt || 0))[0];
  const guide = guides.find(item => item.id === guideId) ?? recent ?? guides[0];
  const step = guide?.steps.find(item => item.id === stepId)
    ?? guide?.steps.find(item => item.id === data.runs[guide.id]?.lastStepId)
    ?? guide?.steps[0];

  return <section className={styles.mentor}>
    <h1>STEPWISE AI</h1>
    {unavailable && <p role="alert" className="field-error">Этот шаг недоступен. Выбери другую инструкцию или шаг.</p>}
    {guide && step ? <form className={styles.start} onSubmit={event => {
      event.preventDefault();
      router.push(`/mentor?id=${encodeURIComponent(guide.id)}&step=${encodeURIComponent(step.id)}`);
    }}>
      <p>Выбери шаг, с которым нужна помощь.</p>
      <div className="field">
        <label htmlFor="mentor-guide">Инструкция</label>
        <select id="mentor-guide" value={guide.id} onChange={event => {
          setGuideId(event.target.value);
          setStepId('');
        }}>
          {guides.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="mentor-step">Шаг</label>
        <select id="mentor-step" value={step.id} onChange={event => setStepId(event.target.value)}>
          {guide.steps.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.title}</option>)}
        </select>
      </div>
      <button type="submit" className="button button-dark">Открыть чат</button>
    </form> : <div className={styles.start}>
      <p>Чат можно открыть из опубликованной инструкции.</p>
      <Link className="button button-dark" href="/catalog">Открыть каталог</Link>
    </div>}
  </section>;
}

export function MentorChat({ guide, step }: { guide: Instruction; step: Step }) {
  const { data } = useStore();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [screenshot, setScreenshot] = useState<Screenshot>();
  const [pending, setPending] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const current = guide.steps.findIndex(item => item.id === step.id);
  const completed = guide.steps.slice(0, current).filter(item => data.runs[guide.id]?.completed.includes(item.id));

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (turns.length || pending) messagesEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [turns.length, pending]);

  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !file.size || file.size > 2 * 1024 * 1024) {
      setError('Выбери PNG, JPEG или WebP размером до 2 МБ.');
      return;
    }
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setScreenshot({ name: file.name, url: reader.result });
      setReading(false);
    };
    reader.onerror = () => {
      setError('Не удалось открыть скриншот. Попробуй выбрать файл снова.');
      setReading(false);
    };
    reader.readAsDataURL(file);
  }

  async function send(message: string) {
    if (request.current || reading) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError('');
    try {
      const previousScreenshot = [...turns].reverse().find(turn => turn.screenshot)?.screenshot;
      const response = await fetch('/api/ai/step-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          guideId: guide.id, stepId: step.id, question: message,
          history: turns.slice(-6).map(({ question, answer }) => ({ question, answer })),
          screenshot: (screenshot ?? previousScreenshot)?.url,
        }),
      });
      const result: { hint?: string; message?: string } = await response.json();
      if (!response.ok || !result.hint) throw new Error(result.message || 'Не удалось получить ответ. Попробуй ещё раз.');
      if (controller.signal.aborted) return;
      const answer = result.hint;
      setTurns(previous => [...previous, { question: message, answer, screenshot }]);
      setQuestion('');
      setScreenshot(undefined);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Не удалось связаться с сервером.');
    } finally {
      request.current = null;
      setPending(false);
    }
  }

  return <section className={styles.mentor}>
    <Link href={`/guide?id=${encodeURIComponent(guide.id)}&step=${encodeURIComponent(step.id)}`} className="back-link">
      <ArrowLeft size={17} aria-hidden="true" />Вернуться к шагу
    </Link>
    <h1>STEPWISE AI</h1>
    <div className={styles.layout}>
      <aside className={styles.context} aria-label="Контекст инструкции">
        <p className="muted">{guide.title}</p>
        <h2>{step.title}</h2>
        <p className={styles.stepText}>{step.text}</p>
        {completed.length > 0 && <>
          <h3>Выполнено до этого шага</h3>
          <ul>{completed.map(item => <li key={item.id}><Check size={15} aria-hidden="true" />{item.title}</li>)}</ul>
        </>}
      </aside>
      <section className={styles.chat} aria-label="Чат с наставником">
        <div className={styles.messages} role="log" aria-label="Переписка">
          {turns.length === 0 && <p className={styles.welcome}>На каком действии ты застрял? Вставь текст ошибки или прикрепи скриншот.</p>}
          {turns.map((turn, index) => <div className={styles.turn} key={index}>
            <div className={styles.question}><b>Ты</b><p>{turn.question}</p>
              {turn.screenshot && <Image unoptimized src={turn.screenshot.url} alt="Приложенный скриншот ошибки" width={280} height={180} />}
            </div>
            <div className={styles.answer}><b>STEPWISE AI</b><p>{turn.answer}</p></div>
          </div>)}
          {pending && <p className="muted" role="status">Наставник готовит ответ…</p>}
          <div ref={messagesEnd} />
        </div>
        <form className={styles.composer} onSubmit={event => {
          event.preventDefault();
          void send(question.trim() || (screenshot ? 'Помоги разобраться со скриншотом.' : 'Объясни текущий шаг.'));
        }}>
          {error && <p className="field-error" role="alert">{error}</p>}
          <label htmlFor="mentor-message">Сообщение</label>
          <textarea id="mentor-message" maxLength={1500} rows={3} value={question} disabled={pending}
            onChange={event => setQuestion(event.target.value)} placeholder="Опиши, что сделал и какая ошибка появилась" />
          <input ref={fileInput} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={attach} />
          {screenshot && <div className={styles.attachment}>
            <Image unoptimized src={screenshot.url} alt="Предпросмотр скриншота" width={64} height={48} />
            <span>{screenshot.name}</span>
            <button className="text-button" type="button" disabled={pending} onClick={() => setScreenshot(undefined)}>Убрать</button>
          </div>}
          <div className={styles.actions}>
            <button className="button button-outline" type="button" disabled={pending || reading} onClick={() => fileInput.current?.click()}>
              <Paperclip size={16} aria-hidden="true" />Скриншот
            </button>
            <button className="button button-dark" type="submit" disabled={pending || reading}>
              {question.trim() || screenshot || turns.length ? 'Отправить' : 'Объясни шаг'}
            </button>
          </div>
        </form>
      </section>
    </div>
  </section>;
}
