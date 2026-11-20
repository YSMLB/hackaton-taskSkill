'use client';

import Link from 'next/link';
import { DeleteGuide } from './DeleteGuide';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ArrowLeft, ChevronRight, FileText, Plus } from 'lucide-react';
import type { UserMatch } from '@shared/workspace-data';
import { actorId, publicationLabels } from '@shared/community';
import { RegistrationGate, WorkShell } from './Chrome';
import { ProfileAvatar } from './ProfileAvatar';
import { useStore } from './store';
import styles from './TeamOverview.module.css';

const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' });

export function TeamOverview() {
  const { profile, ready } = useStore();
  if (!ready) return <div className="page-loading">Открываем команду…</div>;
  if (!profile) return <RegistrationGate />;

  return <WorkShell active="team">
    <Suspense fallback={<p>Открываем команду…</p>}><Overview userId={actorId(profile)} /></Suspense>
  </WorkShell>;
}

function Overview({ userId }: { userId: string }) {
  const id = useSearchParams().get('id');
  const { data, pending, send, notify } = useStore();
  const team = data.teams.find(item => item.id === id);
  const back = <Link className="back-link" href="/team"><ArrowLeft size={17} aria-hidden="true" />Мои команды</Link>;
  if (!team) return <section className="empty-state">
    <h1>Команда недоступна</h1>
    <p>Проверь ссылку или открой одну из своих команд.</p>
    {back}
  </section>;

  const guides = data.guides.filter(guide => guide.teamId === team.id);
  const published = guides.filter(guide => guide.status === 'published')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
    .slice(0, 5);
  const members = team.members ?? [];
  const owner = members.find(member => member.id === team.ownerId);
  const roster = owner ? [owner, ...members.filter(member => member.id !== owner.id)] : members;
  const allGuides = team.active ? guides : guides.filter(guide => guide.status === 'published');

  return <div className={styles.overview}>
    {back}
    <header className={styles.header}>
      <h1>{team.name}</h1>
      {team.active && <Link className="button button-dark" href={`/editor?team=${encodeURIComponent(team.id)}`}>
        <Plus size={18} aria-hidden="true" />Новая инструкция
      </Link>}
    </header>
    {!team.active && <p className={styles.inactive}>Редактирование приостановлено до подключения «Бизнеса» у владельца.</p>}
    <div className={styles.grid}>
      <section className={styles.panel}>
        <h2>Последние публикации</h2>
        {published.length ? <ul>{published.map(guide => <li key={guide.id}>
          <Link className={styles.guide} href={`/guide?id=${encodeURIComponent(guide.id)}`}>
            <span className={styles.guideIcon}><FileText size={20} aria-hidden="true" /></span>
            <span className={styles.details}>
              <strong>{guide.title}</strong>
              <span>{guide.author}{guide.submittedAt && <> · <time dateTime={guide.submittedAt}>{dateFormat.format(new Date(guide.submittedAt))}</time></>}</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </li>)}</ul> : <p className={styles.empty}>Команда пока ничего не опубликовала.</p>}
      </section>
      <section className={styles.panel}>
        <h2>Участники <span className={styles.count}>{team.memberIds.length}</span></h2>
        {roster.length ? <ul>{roster.map(member => <li key={member.id} className={styles.member}>
          <ProfileAvatar name={member.name} size={36} />
          <span className={styles.details}>
            <strong>{member.name}{member.id === userId && <span> · Ты</span>}</strong>
            <span>{member.username && `@${member.username} · `}{member.id === team.ownerId ? 'Владелец' : 'Участник'}</span>
          </span>
          {team.active && team.ownerId === userId && member.id !== userId &&
            <button type="button" className="text-button" disabled={pending} aria-label={`Отозвать доступ: ${member.name}`} onClick={async () => {
              if (!window.confirm(`Отозвать у ${member.name} доступ к команде «${team.name}»?`)) return;
              if (await send({ type: 'team-member', teamId: team.id, memberId: member.id, remove: true })) notify('Доступ отозван');
            }}>Отозвать доступ</button>}
        </li>)}</ul> : <p className={styles.empty}>Список участников пока недоступен.</p>}
        {team.active && team.ownerId === userId && <MemberAccess key={team.id} teamId={team.id} />}
      </section>
    </div>
    {allGuides.length > 0 && <details className={styles.allGuides}>
      <summary>Все инструкции команды <span className="muted">({allGuides.length})</span></summary>
      <ul>{allGuides.map(guide => <li key={guide.id} className={styles.guideActions}>
        <span className={styles.details}>
          {guide.status === 'published'
            ? <Link href={`/guide?id=${encodeURIComponent(guide.id)}`}>{guide.title}</Link>
            : <strong>{guide.title}</strong>}
          <span>{publicationLabels[guide.status]}</span>
        </span>
        {team.active && <Link className="text-button" href={`/editor?id=${encodeURIComponent(guide.id)}`}>Редактировать</Link>}
        <DeleteGuide guide={guide} />
      </li>)}</ul>
    </details>}
  </div>;
}

function MemberAccess({ teamId }: { teamId: string }) {
  const { send, pending, notify } = useStore();
  const [username, setUsername] = useState('');
  const [match, setMatch] = useState<UserMatch | null>(null);
  async function addMember() {
    if (!match) return;
    if (await send({ type: 'team-member', teamId, username: match.username, selection: match.selection })) {
      setUsername('');
      notify('Доступ выдан');
    }
    setMatch(null);
  }
  return <details className={styles.memberAccess}>
    <summary>Добавить участника</summary>
    <form onSubmit={async event => {
      event.preventDefault();
      if (pending) return;
      setMatch(null);
      const result = await send({ type: 'team-member-search', teamId, username });
      setMatch(result?.memberMatch ?? null);
    }}>
      <div className="field">
        <label htmlFor="team-member-username">Юзернейм участника</label>
        <input id="team-member-username" placeholder="@alex_01" autoCapitalize="none" spellCheck={false} required maxLength={31} pattern="@?[A-Za-z0-9_]{3,30}" disabled={pending} value={username} onChange={event => { setUsername(event.target.value); setMatch(null); }} />
      </div>
      <button type="submit" className="button button-outline" disabled={pending || !username.trim()}>Найти участника</button>
    </form>
    {match && <div className="utility-actions">
      <span role="status">{match.name} · @{match.username}</span>
      <button type="button" className="button button-dark" disabled={pending} onClick={() => void addMember()}>Добавить в команду</button>
    </div>}
  </details>;
}
