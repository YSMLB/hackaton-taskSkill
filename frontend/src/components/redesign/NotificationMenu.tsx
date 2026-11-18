'use client';

import Link from 'next/link';
import { useId, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { useStore } from './store';
import styles from './NotificationMenu.module.css';

export function NotificationMenu() {
  const { data, send, pending } = useStore();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const unread = data.notices.filter(notice => !notice.read).length;
  const recent = [...data.notices].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5);

  function close() { panel.current?.hidePopover(); }

  return <div className={styles.anchor}>
    <button type="button" className={styles.trigger} popoverTarget={id}
      aria-label={`Уведомления, непрочитанных: ${unread}`} aria-haspopup="dialog">
      <Bell size={19} aria-hidden="true" />
      {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
    </button>
    <div ref={panel} id={id} popover="auto" role="dialog" aria-labelledby={id + '-title'} className={styles.panel}>
      <header className={styles.heading}>
        <h2 id={id + '-title'}>Уведомления</h2>
        <button className="icon-button" type="button" aria-label="Закрыть уведомления" onClick={close}><X size={18} /></button>
      </header>
      {unread > 0 && <button className={styles.markRead} type="button" disabled={pending}
        onClick={() => void send({ type: 'notices-read' })}>Прочитать все</button>}
      {recent.length ? <ul className={styles.list}>
        {recent.map(notice => <li key={notice.id}>
          <Link href={notice.href} data-unread={!notice.read} onClick={() => {
            close();
            if (!notice.read) void send({ type: 'notices-read', id: notice.id });
          }}>
            <span className={styles.dot} aria-label={notice.read ? undefined : 'Не прочитано'} />
            <span><span className={styles.text}>{notice.text}</span>
              <time dateTime={notice.createdAt}>{new Date(notice.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
            </span>
          </Link>
        </li>)}
      </ul> : <div className={styles.empty}><Bell size={25} aria-hidden="true" /><p>Уведомлений пока нет</p></div>}
      <Link className={styles.showAll} href="/notifications" onClick={close}>Показать все</Link>
    </div>
  </div>;
}
