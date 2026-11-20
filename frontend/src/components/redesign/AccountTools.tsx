'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { actorId, isOwner } from '@shared/community';
import { Check, ChevronRight } from 'lucide-react';
import { paidPlans, plans } from '@/data/subscription-plans';
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

type PaidPlan = (typeof paidPlans)[number];
const demoPrices = { standard: '200 ₽', business: '300 ₽' } satisfies Record<PaidPlan['id'], string>;

function Subscriptions() {
  const { profile, data, send, pending, error, notify } = useStore();
  const dialog = useRef<HTMLDialogElement>(null);
  const [order, setOrder] = useState<PaidPlan | null>(null);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const active = profile?.plan || 'free';
  const canTry = active === 'free' && !profile?.plusTrialUsed;
  const used = data.guides.filter(g => !g.teamId && isOwner(g, profile)).length;
  const ends = profile?.plusTrialEndsAt;
  useEffect(() => {
    if (order) dialog.current?.showModal();
  }, [order]);

  function openCheckout(plan: PaidPlan) {
    setOrder(plan);
    setPaymentFailed(false);
  }
  async function confirmPayment() {
    if (!order || pending) return;
    setPaymentFailed(false);
    if (await send({ type: 'plan', plan: order.id })) {
      dialog.current?.close();
      notify(`Тариф «${order.name}» подключён. Демо-оплата прошла.`);
    } else {
      setPaymentFailed(true);
    }
  }
  return <section className="account-tools">
    <h1>Подписки</h1>
    <p className="muted">Цены демонстрационные. Можно попробовать оплату без карты и списания денег.</p>
    <div className={styles.planGrid}>{plans.map(plan => {
      const current = active === plan.id;
      const alreadySubscribed = current && !(plan.id === 'standard' && ends);
      return <article className={styles.plan} data-current={current} key={plan.id}>
        <h2>{plan.name}</h2>
        <p>{plan.summary}</p>
        {plan.id === 'free' && active === 'free' && <p className={styles.price}>Личных инструкций: {used} из 10</p>}
        {plan.id === 'standard' && (ends ? <p className={styles.price}>Пробный Plus до {new Date(ends).toLocaleDateString('ru-RU')}. Затем вернётся бесплатный тариф.</p> : canTry && <p className={styles.price}>Месяц бесплатно. Затем вернётся бесплатный тариф без списаний.</p>)}
        {plan.id !== 'free' && <p className={styles.price}>Демо-цена за месяц · {demoPrices[plan.id]}</p>}
        <ul className={styles.features}>{plan.features.map(feature =>
          <li key={feature}><Check size={17} aria-hidden="true" /><span>{feature}</span></li>
        )}</ul>
        {plan.id === 'standard' && canTry && <button type="button" className="button button-outline" disabled={pending}
          onClick={() => void send({ type: 'start-plus-trial' })}>Попробовать Plus на месяц</button>}
        <button type="button" className={`button ${plan.id === 'business' ? 'button-dark' : 'button-outline'}`} disabled={pending || alreadySubscribed}
          onClick={() => plan.id === 'free' ? void send({ type: 'plan', plan: 'free' }) : openCheckout(plan)}>
          {alreadySubscribed ? 'Текущий тариф' : plan.id === 'free' ? 'Выбрать бесплатный' : plan.id === 'standard' ? 'Подключить Plus' : 'Подключить Бизнес'}
        </button>
      </article>;
    })}</div>
    <dialog ref={dialog} className={styles.checkout} aria-labelledby="checkout-title" aria-describedby="checkout-info"
      onCancel={event => { if (pending) event.preventDefault(); }} onClose={() => setOrder(null)}>
      {order && <>
        <h2 id="checkout-title">Демо-оплата</h2>
        <dl className={styles.receipt}>
          <div><dt>Тариф</dt><dd>{order.name}</dd></div>
          <div><dt>Демо-цена за месяц</dt><dd>{demoPrices[order.id]}</dd></div>
        </dl>
        <p id="checkout-info">После подтверждения тариф сразу изменится. Деньги с карты не спишутся.</p>
        {Boolean(ends) && <p>Текущий пробный период Plus завершится.</p>}
        {paymentFailed && <p role="alert" className={styles.paymentError}>{error || 'Не удалось подключить тариф. Попробуй ещё раз.'}</p>}
        <div className={styles.checkoutActions}>
          <button type="button" className="button button-outline" disabled={pending} onClick={() => dialog.current?.close()}>Отмена</button>
          <button type="button" className="button button-red" disabled={pending} onClick={() => void confirmPayment()}>{pending ? 'Подключаем…' : 'Подтвердить демо-оплату'}</button>
        </div>
      </>}
    </dialog>
    {active === 'business' && <div className={styles.teamAccess}>
      <p>{data.teams.length ? 'Управляй участниками и инструкциями в своей команде.' : 'Создай команду и добавь участников по юзернейму.'}</p>
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
      </li>)}</ul> : <p className="muted">Ты пока не состоишь в командах. Владелец команды может добавить тебя по юзернейму.</p>}
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
