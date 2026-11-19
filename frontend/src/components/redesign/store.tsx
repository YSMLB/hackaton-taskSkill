'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Instruction, Profile } from '@shared/community';
import { actorId } from '@shared/community';
import { emptyWorkspace, type Command, type CommandResult, type WorkspaceSnapshot } from '@shared/workspace-data';

export type { Instruction, Profile, Step } from '@shared/community';
export { defaultRun } from '@shared/workspace-data';
export { SAMPLE_ID } from '@backend/data/guide-seeds';

type Store = WorkspaceSnapshot & {
  ready: boolean;
  error: string;
  pending: boolean;
  refresh: () => Promise<void>;
  send: (command: Command) => Promise<CommandResult | null>;
  notify: (message: string) => void;
  catalogSort: 'default' | 'helpful';
  setCatalogSort: (sort: 'default' | 'helpful') => void;
};

const Context = createContext<Store | null>(null);

export function localDrafts(email: string): Instruction[] {
  try {
    const previous = JSON.parse(localStorage.getItem('stepflow-redesign-v1-accounts') || '{}') as Record<string, Profile>;
    const localProfile = Object.values(previous).find(p => p.email.trim().toLowerCase() === email.trim().toLowerCase());
    const ownerId = actorId(localProfile || { email, name: '', role: '' });
    const data = JSON.parse(localStorage.getItem('stepflow-redesign-v1') || '{}') as { guides?: Instruction[] };
    return (data.guides || []).filter(guide => guide.owned && guide.ownerId === ownerId);
  } catch { return []; }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>({ profile: null, data: emptyWorkspace });
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [catalogSort, setCatalogSort] = useState<Store['catalogSort']>('default');
  const version = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const work = useRef(0);

  const refresh = useCallback(async () => {
    if (work.current) return;
    if (!navigator.onLine || location.pathname === '/offline') { setReady(true); return; }
    const revision = ++version.current;
    try {
      const response = await fetch('/api/workspace', { cache: 'no-store' });
      if (!response.ok) throw new Error('Не удалось загрузить данные StepFlow.');
      const result: WorkspaceSnapshot = await response.json();
      if (revision === version.current) {
        setSnapshot(result);
        setError('');
      }
    } catch {
      if (revision === version.current) setError('Сервер недоступен. Сохранённые инструкции можно открыть офлайн.');
    } finally {
      if (revision === version.current) setReady(true);
    }
  }, []);

  useEffect(() => {
    function onFocus() { void refresh(); }
    const startup = setTimeout(onFocus, 0);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') onFocus(); }, 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      clearInterval(timer);
      clearTimeout(startup);
    };
  }, [refresh]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  const send = useCallback((command: Command) => {
    version.current++;
    work.current++;
    setPending(true);
    const task = queue.current.then(async () => {
      try {
        const response = await fetch('/api/workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(command),
        });
        const result = await response.json() as CommandResult & { message?: string };
        if (!response.ok) throw new Error(result.message || 'Не удалось сохранить изменения.');
        setSnapshot(result);
        setError('');
        return result;
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : 'Не удалось связаться с сервером.');
        return null;
      } finally {
        work.current--;
        if (!work.current) setPending(false);
        setReady(true);
      }
    });
    queue.current = task;
    return task;
  }, []);

  return <Context.Provider value={{ ...snapshot, ready, pending, error, refresh, send, notify: setMessage, catalogSort, setCatalogSort }}>
    {children}
    {error && <div className="storage-error" role="alert">{error}</div>}
    {message && <div className="toast" role="status">{message}</div>}
  </Context.Provider>;
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error('StoreProvider is missing');
  return store;
}
