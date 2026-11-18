'use client';

import { useSyncExternalStore } from 'react';
import { accents, appearanceChanged, accentKey } from '@/lib/appearance';
import styles from './ProfilePage.module.css';

function subscribe(callback: () => void) {
  window.addEventListener(appearanceChanged, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(appearanceChanged, callback);
    window.removeEventListener('storage', callback);
  };
}

function setAccent(value: string) {
  document.documentElement.dataset.accent = value;
  try { localStorage.setItem(accentKey, value); } catch {}
  window.dispatchEvent(new Event(appearanceChanged));
}

export function SiteSettings() {
  const accent = useSyncExternalStore(subscribe, () => document.documentElement.dataset.accent || 'blue', () => 'blue');

  return <div className={styles.panel}>
    <h2>Настройки сайта</h2>
    <fieldset className={styles.preferenceGroup}>
      <legend>Акцентный цвет</legend>
      <div className={styles.preferenceGrid}>
        {accents.map(({ id, label }) => <label className={styles.preference} key={id}>
          <input type="radio" name="site-accent" value={id} checked={accent === id} onChange={() => setAccent(id)} />
          <span className={styles.swatch} data-accent={id} aria-hidden="true" />
          {label}
        </label>)}
      </div>
    </fieldset>
    <p className={styles.appearanceHint}>Выбор сразу применяется и сохраняется в этом браузере.</p>
  </div>;
}
