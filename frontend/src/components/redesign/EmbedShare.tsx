'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';

export function EmbedShare({ id }: { id: string }) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  function toggle() {
    if (code) { setCode(''); setCopied(false); return; }
    const url = new URL('/embed', window.location.origin);
    url.searchParams.set('id', id);
    setCode(`<iframe src="${url.href}" title="Инструкция StepFlow" width="100%" height="720" loading="lazy" style="border:0"></iframe>`);
  }

  return <div className="embed-share">
    <button type="button" className="button button-outline" aria-expanded={Boolean(code)} aria-controls="embed-snippet" onClick={toggle}>Встроить на сайт</button>
    <div id="embed-snippet" hidden={!code} className="embed-share-code">
      <label htmlFor="embed-code">Код для вставки</label>
      <p>Добавь этот код в HTML страницы или блок «HTML / Встраивание» конструктора сайта. В консоли браузера HTML не выполняется. Адрес localhost доступен только на твоём компьютере. Для другого сайта используй опубликованный адрес StepFlow.</p>
      <a className="text-button" href={`/embed?id=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">Открыть предпросмотр встраивания</a>
      <textarea id="embed-code" rows={3} value={code} readOnly onFocus={event => event.target.select()} />
      <button type="button" className="text-button" onClick={async () => {
        try { await navigator.clipboard.writeText(code); setCopied(true); }
        catch { document.getElementById('embed-code')?.focus(); }
      }}><Copy size={16} aria-hidden="true" />{copied ? 'Код скопирован' : 'Скопировать код'}</button>
    </div>
  </div>;
}
