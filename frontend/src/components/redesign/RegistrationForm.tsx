'use client';

import { UsernameInput } from './UsernameInput';
import { useId, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useStore } from './store';
import styles from './RegistrationForm.module.css';

export type AuthMode = 'register' | 'login';

export function RegistrationForm({ onComplete, mode = 'register', onModeChange }: { onComplete: () => void; mode?: AuthMode; onModeChange?: (mode: AuthMode) => void }) {
  const { send, pending } = useStore();
  const prefix = useId();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const signingIn = mode === 'login';
  return <form className="registration-form" aria-labelledby={`${prefix}-heading`} onSubmit={async event => {
    event.preventDefault();
    if (pending) return;
    const result = await send(signingIn ? { type: 'login', email } : { type: 'register', profile: { name, email, username, role: 'Ученик' } });
    if (result) onComplete();
  }}>
    {onModeChange && <div className={styles.modes} role="group" aria-label="Способ входа"><button type="button" aria-pressed={!signingIn} onClick={() => onModeChange('register')}>Регистрация</button><button type="button" aria-pressed={signingIn} onClick={() => onModeChange('login')}>Вход</button></div>}
    <h2 id={`${prefix}-heading`}>{signingIn ? 'С возвращением' : 'Давай познакомимся'}</h2>
    <p>{signingIn ? 'Введи email, с которым создавал профиль StepFlow.' : 'Представься, чтобы открыть инструкции и своё пространство.'}</p>
    {!signingIn && <div className="field">
      <label htmlFor={`${prefix}-name`}>Имя и фамилия</label>
      <input id={`${prefix}-name`} type="text" autoComplete="name" maxLength={100} placeholder="Как к тебе обращаться" value={name} onChange={event => setName(event.target.value)} />
    </div>}
    {!signingIn && <div className="field">
      <label htmlFor={`${prefix}-username`}>Юзернейм</label>
      <UsernameInput id={`${prefix}-username`} hintId={`${prefix}-username-hint`} required value={username} onChange={setUsername} />
      <small id={`${prefix}-username-hint`}>3–30 латинских букв, цифр или подчёркиваний. По юзернейму тебя найдут для приглашения в команду.</small>
    </div>}
    <div className="field">
      <label htmlFor={`${prefix}-email`}>Email</label>
      <input id={`${prefix}-email`} type="text" inputMode="email" required autoComplete="email" maxLength={254} placeholder="Твой email" value={email} onChange={event => setEmail(event.target.value)} />
    </div>
    <button className="button button-red registration-submit" type="submit" disabled={pending}>{signingIn ? 'Войти' : 'Зарегистрироваться'} <ArrowUpRight size={18} /></button>
    <p className="registration-note">{signingIn ? 'Для входа в демо нужен email зарегистрированного профиля. Пароль не требуется.' : 'В демо подтверждать почту не нужно.'}</p>
  </form>;
}
