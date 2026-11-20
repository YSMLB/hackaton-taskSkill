'use client';

import { useId, useState, type FormEvent } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { useStore } from './store';
import styles from './StepComments.module.css';

const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function StepComments({ guideId, stepId }: { guideId: string; stepId: string }) {
  const { data, profile, send, pending } = useStore();
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const fieldId = useId();
  const headingId = useId();
  const comments = data.comments.filter(c => c.guideId === guideId && c.stepId === stepId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await send({ type: 'comment', guideId, stepId, text })) {
      setText('');
      setStatus('Комментарий добавлен');
    }
  }

  return <section className={styles.comments} aria-labelledby={headingId}>
    <div className={styles.heading}>
      <h3 id={headingId} className={styles.title}><MessageCircle size={19} aria-hidden="true" />Комментарии к шагу</h3>
      <span className={styles.count} aria-label={`Всего комментариев: ${comments.length}`}>{comments.length}</span>
    </div>
    {comments.length ? <ol className={styles.list}>{comments.map(comment => <li className={styles.comment} key={comment.id} id={`comment-${comment.id}`}>
      <span className={styles.avatar} aria-hidden="true">{Array.from(comment.authorName)[0]?.toLocaleUpperCase('ru')}</span>
      <div className={styles.body}>
        <div className={styles.meta}><strong>{comment.authorName}</strong><time dateTime={comment.createdAt}>{dateFormat.format(new Date(comment.createdAt))}</time></div>
        <p className={styles.text}>{comment.text}</p>
      </div>
    </li>)}</ol> : <p className={styles.empty}>Пока никто не написал. Можно задать вопрос или поделиться подсказкой.</p>}
    {profile && <form className={styles.form} onSubmit={submit}>
      <label className={styles.label} htmlFor={fieldId}>Твой комментарий</label>
      <textarea id={fieldId} className={styles.input} rows={3} maxLength={2000} value={text} onChange={event => { setText(event.target.value); setStatus(''); }} placeholder="Что стоит уточнить или добавить к этому шагу?" />
      <div className={styles.footer}>
        <p className={styles.note}>Комментарий увидят читатели инструкции.</p>
        <button className={styles.submit} type="submit" disabled={!text.trim() || pending} aria-label="Отправить комментарий"><Send size={16} aria-hidden="true" />Отправить</button>
      </div>
      <span className={styles.status} role="status">{status}</span>
    </form>}
  </section>;
}
