'use client';

import Link from 'next/link';
import { useState } from 'react';
import { actorId } from '@shared/community';
import { Check, ChevronRight } from 'lucide-react';
import { businessPrice, plans } from '@/data/subscription-plans';
import { RegistrationGate, WorkShell } from './Chrome';
import { NotificationCenter } from './NotificationMenu';
import { useStore } from './store';
import styles from './SubscriptionPlans.module.css';

export function AccountTools({ screen }: { screen: 'team' | 'notices' | 'subscriptions' }) {
  const { profile, ready } = useStore();
  if (!ready) return <div className="page-loading">Открываем пространство…</div>;
  if (!profile) return <RegistrationGate continueTo={screen === 'subscriptions' ? '/subscriptions' : '/catalog'} />;
  return <WorkShell active={screen}>
    {screen === 'notices' ? <NotificationCenter /> : screen === 'subscriptions' ? <Subscriptions /> : <Teams />}
  </WorkShell>;
}

function Subscriptions() {
  const { profile, data, send, pending } = useStore();
  const active = profile?.plan || 'free';
  return <section className="account-tools">
    <h1>Подписки</h1>
    <p className="muted">В демо можно переключать тарифы без оплаты.</p>
    <div className={styles.planGrid}>{plans.map(plan => <article className={styles.plan} data-current={active === plan.id} key={plan.id}>
      <h2>{plan.name}</h2>
      <p>{plan.summary}</p>
      {plan.id === 'business' && <p className={styles.price}>{businessPrice}</p>}
      <ul className={styles.features}>{plan.features.map(feature =>
        <li key={feature}><Check size={17} aria-hidden="true" /><span>{feature}</span></li>
      )}</ul>
      <button type="button" className={`button ${plan.id === 'business' ? 'button-dark' : 'button-outline'}`} disabled={pending || active === plan.id}
        onClick={() => void send({ type: 'plan', plan: plan.id })}>
        {active === plan.id ? 'Текущий тариф' : plan.id === 'free' ? 'Выбрать бесплатный' : plan.id === 'standard' ? 'Выбрать Plus' : 'Выбрать Бизнес'}
      </button>
    </article>)}</div>
    {active === 'business' && <div className={styles.teamAccess}>
      <p>{data.teams.length ? 'Управляй участниками и инструкциями в своей команде.' : 'Создай команду и добавь участников по email.'}</p>
      <Link className="button button-outline" href="/team">Перейти в команды <ChevronRight size={17} aria-hidden="true" /></Link>
    </div>}
  </section>;
}

function Teams() {
  const { profile, data, send, pending } = useStore();
  const [name, setName] = useState('');
  return <section className="account-tools">
    <h1>Мои команды</h1>
    <section className="reports-panel" aria-label="Список команд">
      {data.teams.length > 0 ? <ul className={styles.teamList}>{data.teams.map(team => <li key={team.id}>
        <Link className={styles.teamLink} href={`/team/overview?id=${encodeURIComponent(team.id)}`}>
          <span><strong>{team.name}</strong><span className="muted">
            {profile && actorId(profile) === team.ownerId ? 'Владелец' : 'Участник'} · Участников: {team.memberIds.length}
            {!team.active && ' · Режим чтения'}
          </span></span>
          <span className={styles.openTeam}>Открыть команду <ChevronRight size={18} aria-hidden="true" /></span>
        </Link>
      </li>)}</ul> : <p className="muted">Ты пока не состоишь в командах. Владелец команды может добавить тебя по email.</p>}
    </section>
    <section className="reports-panel">
      <h2>Создать команду</h2>
      {profile?.plan === 'business' ? <form className="account-tool-form" onSubmit={async event => {
        event.preventDefault();
        if (await send({ type: 'team-create', name })) setName('');
      }}>
        <div className="field"><label htmlFor="new-team">Название новой команды</label><input id="new-team" maxLength={100} value={name} onChange={event => setName(event.target.value)} required /></div>
        <button className="button button-dark" disabled={pending || !name.trim()}>Создать команду</button>
      </form> : <div className={styles.teamAccess}>
        <p>Создание своей команды доступно на тарифе «Бизнес».</p>
        <Link className="button button-outline" href="/subscriptions">Посмотреть подписки <ChevronRight size={17} aria-hidden="true" /></Link>
      </div>}
    </section>
  </section>;
}
