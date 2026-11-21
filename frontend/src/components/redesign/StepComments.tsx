'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, Send, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useStore } from './store';
import styles from './StepComments.module.css';

const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function StepComments({ guideId, stepId }: { guideId: string; stepId: string }) {
  const { data, profile, send, pending } = useStore();
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const teamId = data.guides.find(guide => guide.id === guideId)?.teamId;
  const teammates = new Map<string, string>();
  for (const team of data.teams) {
    if (!team.active || (teamId && team.id !== teamId)) continue;
    for (const member of team.members ?? []) {
      if (member.username && member.username !== profile?.username) teammates.set(member.username, member.name);
    }
  }
  const token = caret === null ? null : text.slice(0, caret).match(/(?:^|[^\p{L}\p{N}_@])@([a-z0-9_]*)$/iu);
  const matches = token ? [...teammates].filter(([name]) => name.startsWith(token[1].toLowerCase())).slice(0, 6) : [];

  function selectMention(username: string) {
    if (!token || caret === null) return;
    const start = caret - token[1].length - 1;
    const tail = text.slice(caret).replace(/^[a-z0-9_]*/i, '');
    const insert = '@' + username + (tail && /^[\s.,!?;:]/.test(tail) ? '' : ' ');
    const next = text.slice(0, start) + insert + tail;
    if (next.length > 2000) { setStatus('Для упоминания нужно больше места в комментарии'); return; }
    setText(next);
    input.current?.focus();
    requestAnimationFrame(() => {
      input.current?.setSelectionRange(start + insert.length, start + insert.length);
      setCaret(null);
    });
  }
  const fieldId = useId();
  const headingId = useId();
  const comments = data.comments.filter(c => c.guideId === guideId && c.stepId === stepId).sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0) || a.createdAt.localeCompare(b.createdAt));

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
        <div className={styles.reactions}>{(['helpful', 'unhelpful'] as const).map(value => {
          const positive = value === 'helpful';
          const Icon = positive ? ThumbsUp : ThumbsDown;
          const count = (positive ? comment.likes : comment.dislikes) ?? 0;
          return <button key={value} type="button" disabled={!profile || pending} aria-pressed={comment.myVote === value}
            aria-label={(positive ? 'Лайки' : 'Дизлайки') + ': ' + count}
            onClick={() => void send({ type: 'comment-vote', guideId, commentId: comment.id, value: comment.myVote === value ? '' : value })}>
            <Icon size={15} aria-hidden="true" />{count}</button>;
        })}</div>
      </div>
    </li>)}</ol> : <p className={styles.empty}>Пока никто не написал. Можно задать вопрос или поделиться подсказкой.</p>}
    {profile && <form className={styles.form} onSubmit={submit}>
      <label className={styles.label} htmlFor={fieldId}>Твой комментарий</label>
      <textarea ref={input} id={fieldId} className={styles.input} rows={3} maxLength={2000} value={text}
        aria-describedby={fieldId + '-hint'} aria-controls={matches.length ? fieldId + '-matches' : undefined}
        aria-activedescendant={matches[active] ? fieldId + '-option-' + active : undefined}
        onSelect={event => { setCaret(event.currentTarget.selectionEnd); setActive(0); }}
        onChange={event => { setText(event.target.value); setCaret(event.target.selectionEnd); setActive(0); setStatus(''); }}
        onBlur={() => setCaret(null)}
        onKeyDown={event => {
          if (!matches.length || event.nativeEvent.isComposing) return;
          if (event.key === 'Escape') { event.preventDefault(); setCaret(null); }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
          }
          if (event.key === 'Enter' && !event.shiftKey && matches[active]) {
            event.preventDefault();
            selectMention(matches[active][0]);
          }
        }} placeholder="Что стоит уточнить или добавить к этому шагу?" />
      {matches.length > 0 && <div id={fieldId + '-matches'} role="listbox" aria-label="Участники команды" className={styles.matches}>
        {matches.map(([username, name], index) => <button type="button" tabIndex={-1} role="option" aria-selected={active === index}
          key={username} id={fieldId + '-option-' + index} onPointerDown={event => event.preventDefault()}
          onClick={() => selectMention(username)}>{name} <strong>@{username}</strong></button>)}
      </div>}
      {token && teammates.size > 0 && !matches.length && <small role="status">В команде нет совпадений</small>}
      <div className={styles.footer}>
        <p id={fieldId + '-hint'} className={styles.note}>Комментарий увидят читатели инструкции.{teammates.size > 0 && ' Введи @, чтобы позвать участника команды.'}</p>
        <button className={styles.submit} type="submit" disabled={!text.trim() || pending} aria-label="Отправить комментарий"><Send size={16} aria-hidden="true" />Отправить</button>
      </div>
      <span className={styles.status} role="status">{status}</span>
    </form>}
  </section>;
}
