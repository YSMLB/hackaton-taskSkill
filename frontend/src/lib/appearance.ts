export const accents = [
  { id: 'blue', label: 'Синий' },
  { id: 'violet', label: 'Фиолетовый' },
  { id: 'emerald', label: 'Изумрудный' },
  { id: 'orange', label: 'Рыжий' },
  { id: 'rose', label: 'Розовый' },
] as const;

export const accentKey = 'stepflow:accent';
export const themeKey = 'stepflow:theme';
export const themes = [
  { id: 'system', label: 'Как в системе' },
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Тёмная' },
] as const;
export const appearanceChanged = 'stepflow:appearance-changed';

export const appearanceScript = `(() => {
  const key = ${JSON.stringify(accentKey)};
  const themeKey = ${JSON.stringify(themeKey)};
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const choices = ${JSON.stringify(accents.map(accent => accent.id))};
  function applyColorScheme() {
    root.dataset.colorScheme = root.dataset.theme === 'system'
      ? (media.matches ? 'dark' : 'light') : root.dataset.theme;
  }
  function apply() {
    let theme = 'system';
    try {
      const saved = localStorage.getItem(themeKey);
      if (saved === 'light' || saved === 'dark') theme = saved;
      let value = localStorage.getItem(key);
      if (value === 'amber') {
        value = 'orange';
        localStorage.setItem(key, value);
      }
      if (choices.includes(value)) root.dataset.accent = value;
      else delete root.dataset.accent;
    } catch {}
    root.dataset.theme = theme;
    applyColorScheme();
  }
  apply();
  media.addEventListener('change', applyColorScheme);
  window.addEventListener(${JSON.stringify(appearanceChanged)}, applyColorScheme);
  window.addEventListener('storage', event => {
    if (event.key === null || event.key === key || event.key === themeKey) apply();
  });
})();`;
