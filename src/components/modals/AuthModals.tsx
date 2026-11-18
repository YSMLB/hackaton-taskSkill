'use client';

import { useState } from 'react';
import { AuthModalMode } from '@/types/stepflow';
import { X, Lock, Mail, User, GraduationCap } from 'lucide-react';

interface AuthModalsProps {
  mode: AuthModalMode;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function AuthModals({ mode, onClose, onSuccess }: AuthModalsProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'student' | 'school' | 'beginner' | 'teacher'>('student');

  if (!mode) return null;

  const roleLabels: Record<string, string> = {
    student: 'Студент',
    school: 'Школьник',
    beginner: 'Начинающий специалист',
    teacher: 'Преподаватель / Ментор'
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      onSuccess('Вход выполнен');
    } else {
      onSuccess(`Аккаунт создан: ${roleLabels[role]}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card max-w-sm w-full rounded-2xl p-6 sm:p-7 space-y-5 border border-white/20 relative animate-fadeIn">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <h3 className="text-xl font-bold text-white font-heading">
            {mode === 'login' ? 'Вход в StepFlow' : 'Регистрация в StepFlow'}
          </h3>
          <p className="text-xs text-slate-400">
            {mode === 'login'
              ? 'Авторизация для доступа к регламентам'
              : 'Создание и прохождение регламентов'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div className="space-y-1 text-xs">
              <label className="font-mono text-slate-300">Имя и фамилия</label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Михаил Сергеев"
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-dark-900 border border-white/10 text-white focus:outline-none focus:border-brand-500 text-xs"
                />
              </div>
            </div>
          )}

          <div className="space-y-1 text-xs">
            <label className="font-mono text-slate-300">Email</label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-dark-900 border border-white/10 text-white focus:outline-none focus:border-brand-500 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-mono text-slate-300">Пароль</label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-dark-900 border border-white/10 text-white focus:outline-none focus:border-brand-500 text-xs"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div className="space-y-1 text-xs">
              <label className="font-mono text-slate-300">Кто вы</label>
              <div className="relative">
                <GraduationCap className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'student' | 'school' | 'beginner' | 'teacher')}
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-dark-900 border border-white/10 text-white focus:outline-none focus:border-brand-500 text-xs font-mono"
                >
                  <option value="student">Студент</option>
                  <option value="school">Школьник</option>
                  <option value="beginner">Начинающий специалист</option>
                  <option value="teacher">Преподаватель / Ментор</option>
                </select>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full h-10 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-glow-indigo transition pt-0.5"
          >
            {mode === 'login' ? 'Войти в аккаунт' : 'Создать аккаунт'}
          </button>
        </form>
      </div>
    </div>
  );
}
