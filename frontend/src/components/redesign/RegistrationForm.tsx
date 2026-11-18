'use client';

import { useId, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useStore } from './store';
import styles from './RegistrationForm.module.css';

export type AuthMode = 'register' | 'login';

export function RegistrationForm({ onComplete, mode = 'register', onModeChange }: { onComplete: () => void; mode?: AuthMode; onModeChange?: (mode: AuthMode) => void }) {
  const { send, pending } = useStore();
  const prefix = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Ученик');

  const signingIn = mode === 'login';
  return <form className="registration-form" aria-labelledby={`${prefix}-heading`} noValidate onSubmit={async event => {
    event.preventDefault();
    if (pending) return;
    const result = await send(signingIn ? { type: 'login', email } : { type: 'register', profile: { name, email, role } });
    if (result) onComplete();
  }}>
    {onModeChange && <div className={styles.modes} role="group" aria-label="Способ входа"><button type="button" aria-pressed={!signingIn} onClick={() => onModeChange('register')}>Регистрация</button><button type="button" aria-pressed={signingIn} onClick={() => onModeChange('login')}>Вход</button></div>}
    <h2 id={`${prefix}-heading`}>{signingIn ? 'С возвращением' : 'Давай познакомимся'}</h2>
    <p>{signingIn ? 'Введи email, с которым создавал профиль StepFlow.' : 'Представься, чтобы открыть инструкции и своё пространство.'}</p>
    {!signingIn && <div className="field">
      <label htmlFor={`${prefix}-name`}>Имя и фамилия</label>
      <input id={`${prefix}-name`} type="text" autoComplete="name" maxLength={100} placeholder="Как к тебе обращаться" value={name} onChange={event => setName(event.target.value)} />
    </div>}
    <div className="field">
      <label htmlFor={`${prefix}-email`}>Email</label>
      <input id={`${prefix}-email`} type="text" inputMode="email" autoComplete="email" maxLength={254} placeholder="Твой email" value={email} onChange={event => setEmail(event.target.value)} />
    </div>
    {!signingIn && <div className="field">
      <label htmlFor={`${prefix}-role`}>Роль</label>
      <select id={`${prefix}-role`} value={role} onChange={event => setRole(event.target.value)}>
        <option>Ученик</option><option>Автор</option><option value="Администратор">Администратор (демо)</option>
      </select>
    </div>}
    <button className="button button-red registration-submit" type="submit" disabled={pending}>{signingIn ? 'Войти' : 'Зарегистрироваться'} <ArrowUpRight size={18} /></button>
    <p className="registration-note">{signingIn ? 'Демо-вход без пароля: можно ввести любые символы. Для нового email откроется профиль ученика.' : 'Пока это демо: можно ввести любые символы. Подтверждать почту не нужно.'}</p>
  </form>;
}
