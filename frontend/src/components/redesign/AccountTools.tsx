'use client';

import Link from 'next/link';
import { useState } from 'react';
import { actorId, isAdmin, type Plan } from '@shared/community';
import type { Team } from '@shared/workspace-data';
import { RegistrationGate, WorkShell } from './Chrome';
import { useStore } from './store';

const plans = [
  { id: 'free', name: 'Бесплатный', description: 'Каталог, прохождение и PDF.' },
  { id: 'standard', name: 'Обычная подписка', description: 'Возможность стать экспертом по назначению администратора. Базовая цена — 1×.' },
  { id: 'business', name: 'Бизнес', description: 'Командные инструкции без лимита публикаций и совместное редактирование. Цена — 1,5× от обычной подписки.' },
] as const;

export function AccountTools({ screen }: { screen: 'team' | 'notices' }) {
  const { profile, ready } = useStore();
  if (!ready) return <div className="page-loading">Открываем пространство…</div>;
  if (!profile) return <RegistrationGate />;
  return <WorkShell active={screen === 'team' ? 'team' : 'profile'}>{screen === 'notices' ? <Notifications /> : <Teams />}</WorkShell>;
}

function Notifications() {
  const { data, send, pending } = useStore();
  return <section className="account-tools">
    <div className="panel-heading"><h1>Уведомления</h1>{data.notices.some(item => !item.read) &&
      <button type="button" className="button button-outline" disabled={pending} onClick={() => void send({ type: 'notices-read' })}>Прочитать все</button>}</div>
    {data.notices.length ? <ul className="notice-list">{data.notices.map(item => <li key={item.id} data-read={item.read}>
      <Link href={item.href} onClick={() => { if (!item.read) void send({ type: 'notices-read', id: item.id }); }}>{item.text}</Link>
      <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('ru-RU')}</time>
    </li>)}</ul> : <p className="muted">Новых событий пока нет.</p>}
  </section>;
}

function Teams() {
  const { profile, data, send, pending } = useStore();
  const [name, setName] = useState('');
  const active = profile?.plan || 'free';
  return <section className="account-tools">
    <h1>Подписки и команды</h1>
    <p className="muted">Демо-режим. Можно переключать тарифы без оплаты.</p>
    <div className="plan-grid">{plans.map(plan => <article className="reports-panel plan-card" key={plan.id}>
      <h2>{plan.name}</h2><p>{plan.description}</p>
      <button type="button" className="button button-outline" disabled={pending || active === plan.id}
        onClick={() => void send({ type: 'plan', plan: plan.id as Plan })}>{active === plan.id ? 'Текущий тариф' : 'Выбрать'}</button>
    </article>)}</div>
    {isAdmin(profile) && <ExpertForm />}
    <section className="reports-panel"><h2>Твои команды</h2>
      {data.teams.map(team => <TeamPanel team={team} key={team.id} />)}
      {!data.teams.length && <p className="muted">Ты пока не состоишь в командах.</p>}
      {active === 'business' && <form className="account-tool-form" onSubmit={async event => {
        event.preventDefault();
        if (await send({ type: 'team-create', name })) setName('');
      }}>
        <div className="field"><label htmlFor="new-team">Название новой команды</label><input id="new-team" maxLength={100} value={name} onChange={event => setName(event.target.value)} required /></div>
        <button className="button button-dark" disabled={pending || !name.trim()}>Создать команду</button>
      </form>}
    </section>
  </section>;
}

function ExpertForm() {
  const { send, pending, notify } = useStore();
  const [email, setEmail] = useState('');
  async function change(enabled: boolean) {
    if (await send({ type: 'expert', email, enabled })) notify(enabled ? 'Эксперт назначен' : 'Роль эксперта отозвана');
  }
  return <section className="reports-panel expert-panel"><h2>Назначение экспертов</h2>
    <p className="muted">Укажи email зарегистрированного пользователя с подпиской, чтобы выдать или отозвать роль эксперта.</p>
    <div className="field"><label htmlFor="expert-email">Email пользователя</label><input id="expert-email" value={email} onChange={event => setEmail(event.target.value)} /></div>
    <div className="utility-actions">
      <button type="button" className="button button-dark" disabled={pending || !email.trim()} onClick={() => void change(true)}>Назначить экспертом</button>
      <button type="button" className="button button-outline" disabled={pending || !email.trim()} onClick={() => void change(false)}>Отозвать роль</button>
    </div>
  </section>;
}

function TeamPanel({ team }: { team: Team }) {
  const { data, profile, send, pending, notify } = useStore();
  const [email, setEmail] = useState('');
  const manages = profile && actorId(profile) === team.ownerId && team.active;
  const guides = data.guides.filter(guide => guide.teamId === team.id);
  async function changeMember(remove: boolean) {
    if (await send({ type: 'team-member', teamId: team.id, email, remove })) {
      setEmail('');
      notify(remove ? 'Доступ отозван' : 'Доступ выдан');
    }
  }
  return <article className="team-panel">
    <h3>{team.name}</h3><p className="muted">Участников: {team.memberIds.length}. Инструкций: {guides.length}.</p>
    {!team.active && <p>Редактирование приостановлено до подключения тарифа «Бизнес» у владельца.</p>}
    {guides.length > 0 && <ul>{guides.map(guide => <li key={guide.id}>
      <Link href={'/guide?id=' + guide.id}>{guide.title}</Link> {team.active && <Link className="text-button" href={'/editor?id=' + guide.id}>Редактировать</Link>}
    </li>)}</ul>}
    {team.active && <Link className="button button-outline" href={'/editor?team=' + team.id}>Новая командная инструкция</Link>}
    {manages && <div className="account-tool-form">
      <div className="field"><label htmlFor={'member-' + team.id}>Email участника</label><input id={'member-' + team.id} value={email} onChange={event => setEmail(event.target.value)} /></div>
      <div className="utility-actions">
        <button type="button" className="button button-dark" disabled={pending || !email.trim()} onClick={() => void changeMember(false)}>Добавить</button>
        <button type="button" className="button button-outline" disabled={pending || !email.trim()} onClick={() => void changeMember(true)}>Отозвать доступ</button>
      </div>
    </div>}
  </article>;
}
