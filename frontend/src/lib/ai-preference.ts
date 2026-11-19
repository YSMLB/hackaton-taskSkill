import { useSyncExternalStore } from 'react';
import { aiDisabledCookie } from './ai-cookie';
const changed = 'stepflow-ai-preference-changed';

function subscribe(listener: () => void) {
  window.addEventListener(changed, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(changed, listener);
    window.removeEventListener('storage', listener);
  };
}

function readEnabled() {
  return !document.cookie.split(';').some(cookie => cookie.trim() === aiDisabledCookie + '=1');
}

export function useAiEnabled() {
  return useSyncExternalStore(subscribe, readEnabled, () => true);
}

export function setAiEnabled(enabled: boolean) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${aiDisabledCookie}=1; Path=/; Max-Age=${enabled ? 0 : 31_536_000}; SameSite=Lax${secure}`;
  try { localStorage.setItem(changed, String(enabled)); } catch {}
  window.dispatchEvent(new Event(changed));
}
