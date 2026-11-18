export const accents = [
  { id: 'blue', label: 'Синий' },
  { id: 'violet', label: 'Фиолетовый' },
  { id: 'emerald', label: 'Изумрудный' },
  { id: 'orange', label: 'Рыжий' },
  { id: 'rose', label: 'Розовый' },
] as const;

export const accentKey = 'stepflow:accent';
export const appearanceChanged = 'stepflow:appearance-changed';

export const appearanceScript = `(() => {
  const key = ${JSON.stringify(accentKey)};
  const choices = ${JSON.stringify(accents.map(accent => accent.id))};
  function apply() {
    try {
      let value = localStorage.getItem(key);
      if (value === 'amber') {
        value = 'orange';
        localStorage.setItem(key, value);
      }
      if (choices.includes(value)) document.documentElement.dataset.accent = value;
      else delete document.documentElement.dataset.accent;
    } catch {}
  }
  apply();
  window.addEventListener('storage', event => {
    if (event.key === null || event.key === key) apply();
  });
})();`;
