'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Bell, CheckCheck, ChevronRight, X } from 'lucide-react';
import type { Notice } from '@shared/workspace-data';
import { useStore } from './store';
import styles from './NotificationMenu.module.css';

const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

function NoticeRow({ notice, compact, onOpen }: { notice: Notice; compact?: boolean; onOpen: () => void }) {
  const date = new Date(notice.createdAt);
  return <li>
    <Link className={styles.row} href={notice.href} data-unread={!notice.read} onClick={onOpen}>
      <span className={styles.dot} aria-hidden="true" />
      {!notice.read && <span className="sr-only">Непрочитано. </span>}
      <span className={styles.text}>{notice.text}</span>
      <time className={styles.time} dateTime={notice.createdAt}>
        {compact ? `${dayFormat.format(date)} · ${timeFormat.format(date)}` : timeFormat.format(date)}
      </time>
      {!compact && <ChevronRight className={styles.rowArrow} size={16} aria-hidden="true" />}
    </Link>
  </li>;
}

export function NotificationCenter() {
  const { data, send, pending } = useStore();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const unread = data.notices.filter(notice => !notice.read);
  const visible = unreadOnly ? unread : data.notices;
  const groups = new Map<string, Notice[]>();
  for (const notice of visible) {
    const day = dayFormat.format(new Date(notice.createdAt));
    const group = groups.get(day);
    if (group) group.push(notice);
    else groups.set(day, [notice]);
  }

  return <section className={styles.center}>
    <h1>Уведомления</h1>
    <div className={styles.toolbar}>
      <div role="group" aria-label="Фильтр уведомлений" className={styles.filters}>
        <button type="button" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>Все</button>
        <button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>
          Непрочитанные <span className={styles.count}>{unread.length}</span>
        </button>
      </div>
      <button type="button" className={styles.markRead} disabled={pending || !unread.length}
        onClick={() => void send({ type: 'notices-read' })}>
        <CheckCheck size={17} aria-hidden="true" /> Прочитать все
      </button>
    </div>
    {groups.size ? Array.from(groups, ([day, notices]) => <section key={day} className={styles.day}>
      <h2>{day}</h2>
      <ul className={styles.list}>{notices.map(notice => <NoticeRow key={notice.id} notice={notice}
        onOpen={() => { if (!notice.read) void send({ type: 'notices-read', id: notice.id }); }} />)}</ul>
    </section>) : <div className={styles.empty}>
      <Bell size={23} aria-hidden="true" />
      <p>{unreadOnly && data.notices.length ? 'Все уведомления прочитаны' : 'Уведомлений пока нет'}</p>
      {unreadOnly && data.notices.length > 0 && <button className="text-button" type="button" onClick={() => setUnreadOnly(false)}>Вернуться ко всем</button>}
    </div>}
  </section>;
}

export function NotificationMenu({ collapsed, current, onNavigate }: { collapsed: boolean; current: boolean; onNavigate: () => void }) {
  const { data, send, pending } = useStore();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const unread = data.notices.filter(notice => !notice.read).length;
  const recent = data.notices.slice(0, 5);

  const positionPanel = useCallback(() => {
    const floating = panel.current;
    const bounds = trigger.current?.getBoundingClientRect();
    if (!floating || !bounds) return;
    const inset = 12;
    const openUp = (bounds.top + bounds.bottom) / 2 > window.innerHeight / 2;
    const edge = openUp ? window.innerHeight - bounds.bottom : bounds.top;
    floating.dataset.openUp = String(openUp);
    floating.style.setProperty('--notice-edge', `${Math.max(inset, edge)}px`);
  }, []);

  useEffect(() => {
    function reposition() {
      if (panel.current?.matches(':popover-open')) positionPanel();
    }
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [positionPanel]);

  function close() { panel.current?.hidePopover(); }

  return <div className={styles.anchor} data-collapsed={collapsed}>
    <button ref={trigger} type="button" className={styles.trigger} popoverTarget={id} aria-current={current ? 'page' : undefined}
      aria-label={`Уведомления, непрочитанных: ${unread}`} title={collapsed ? 'Уведомления' : undefined} aria-haspopup="dialog">
      <Bell size={19} aria-hidden="true" />
      <span className={styles.label}>Уведомления</span>
      {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
    </button>
    <div ref={panel} id={id} popover="auto" role="dialog" aria-labelledby={id + '-title'} className={styles.panel}
      onBeforeToggle={event => { if (event.newState === 'open') positionPanel(); }}>
      <header className={styles.heading}>
        <h2 id={id + '-title'}>Уведомления</h2>
        <button className="icon-button" type="button" aria-label="Закрыть уведомления" onClick={close}><X size={18} /></button>
      </header>
      {recent.length > 0 && <div className={styles.panelToolbar}>
        <span role="status">{unread ? `Непрочитанные · ${unread}` : 'Всё прочитано'}</span>
        <button className={styles.markRead} type="button" disabled={pending || !unread}
          onClick={() => void send({ type: 'notices-read' })}><CheckCheck size={16} aria-hidden="true" /> Прочитать все</button>
      </div>}
      {recent.length ? <ul className={styles.list}>
        {recent.map(notice => <NoticeRow compact key={notice.id} notice={notice} onOpen={() => {
            close();
            onNavigate();
            if (!notice.read) void send({ type: 'notices-read', id: notice.id });
          }} />)}
      </ul> : <div className={styles.empty}><Bell size={23} aria-hidden="true" /><p>Уведомлений пока нет</p></div>}
      <Link className={styles.showAll} href="/notifications" onClick={() => { close(); onNavigate(); }}>
        Показать все <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  </div>;
}
