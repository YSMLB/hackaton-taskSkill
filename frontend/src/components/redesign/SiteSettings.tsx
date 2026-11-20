'use client';

import { useId, useRef, useSyncExternalStore } from 'react';
import { setAiEnabled, useAiEnabled } from '@/lib/ai-preference';
import { accents, appearanceChanged, accentKey, themeKey, themes } from '@/lib/appearance';
import styles from './ProfilePage.module.css';

function subscribe(callback: () => void) {
  window.addEventListener(appearanceChanged, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(appearanceChanged, callback);
    window.removeEventListener('storage', callback);
  };
}

function setAppearance(setting: 'accent' | 'theme', value: string) {
  document.documentElement.dataset[setting] = value;
  try { localStorage.setItem(setting === 'accent' ? accentKey : themeKey, value); } catch {}
  window.dispatchEvent(new Event(appearanceChanged));
}

export function SiteSettings() {
  const accent = useSyncExternalStore(subscribe, () => document.documentElement.dataset.accent || 'blue', () => 'blue');
  const theme = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme || 'system', () => 'system');
  const aiEnabled = useAiEnabled();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return <div className={styles.panel}>
    <h2>Настройки сайта</h2>
    <fieldset className={styles.preferenceGroup}>
      <legend>Тема оформления</legend>
      <div className={styles.preferenceGrid}>
        {themes.map(({ id, label }) => <label className={styles.preference} key={id}>
          <input type="radio" name="site-theme" value={id} checked={theme === id} onChange={() => setAppearance('theme', id)} />
          {label}
        </label>)}
      </div>
    </fieldset>
    <fieldset className={styles.preferenceGroup}>
      <legend>Акцентный цвет</legend>
      <div className={styles.preferenceGrid}>
        {accents.map(({ id, label }) => <label className={styles.preference} key={id}>
          <input type="radio" name="site-accent" value={id} checked={accent === id} onChange={() => setAppearance('accent', id)} />
          <span className={styles.swatch} data-accent={id} aria-hidden="true" />
          {label}
        </label>)}
      </div>
    </fieldset>
    <p className={styles.appearanceHint}>Выбор сразу применяется и сохраняется в этом браузере.</p>
    <section className={styles.aiSettings}>
      <div>
        <h3>Функции ИИ</h3>
        <p role="status">{aiEnabled ? 'Разрешены в этом браузере.' : 'Отключены в этом браузере.'}</p>
      </div>
      <button type="button" className="button button-outline" onClick={() => {
        if (aiEnabled) dialog.current?.showModal();
        else setAiEnabled(true);
      }}>{aiEnabled ? 'Отключить все функции ИИ' : 'Включить функции ИИ'}</button>
    </section>
    <dialog ref={dialog} className={styles.aiDialog} aria-labelledby={titleId} aria-describedby={descriptionId}>
      <h2 id={titleId}>Отключить ИИ?</h2>
      <div id={descriptionId}>
        <p>Если застрянешь, «Alina.AI» сможет подсказать, что проверить. Она уже видит текущий шаг, поэтому пересказывать инструкцию не придётся.</p>
        <p>Отключатся «Alina.AI», ИИ-поиск и генерация черновиков. Обычный поиск и ручной редактор продолжат работать. Вернуть ИИ можно здесь же.</p>
      </div>
      <div className={styles.aiDialogActions}>
        <button type="button" className="button button-outline" onClick={() => dialog.current?.close()}>Оставить включённым</button>
        <button type="button" className={`button ${styles.aiDisable}`} onClick={() => {
          setAiEnabled(false);
          dialog.current?.close();
        }}>Отключить ИИ</button>
      </div>
    </dialog>
  </div>;
}
