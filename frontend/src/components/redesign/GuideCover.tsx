'use client';

import { useState, type ChangeEvent } from 'react';
import { ImagePlus } from 'lucide-react';

const kinds = ['image/jpeg', 'image/png', 'image/webp'];
const maxCoverLength = 300_000;

export function GuideCover({ cover }: { cover: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- Covers are local JPEG data URLs.
  return <img className="guide-cover" src={cover} alt="" />;
}

async function prepareCover(file: File) {
  const image = await createImageBitmap(file);
  try {
    const targetRatio = 16 / 9;
    const cropWidth = Math.min(image.width, image.height * targetRatio);
    const cropHeight = cropWidth / targetRatio;
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(960, Math.max(1, Math.round(cropWidth)));
    canvas.height = Math.max(1, Math.round(canvas.width / targetRatio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#f8faf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, (image.width - cropWidth) / 2, (image.height - cropHeight) / 2, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.83, 0.68, 0.5, 0.3]) {
      const cover = canvas.toDataURL('image/jpeg', quality);
      if (cover.startsWith('data:image/jpeg;base64,') && cover.length <= maxCoverLength) return cover;
    }
    throw new Error('Cover is too large');
  } finally { image.close(); }
}

export function CoverField({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!kinds.includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('Выбери JPG, PNG или WebP размером до 10 МБ.');
      return;
    }
    setError('');
    setPending(true);
    try { onChange(await prepareCover(file)); }
    catch { setError('Не удалось обработать изображение. Попробуй другой файл.'); }
    finally { setPending(false); }
  }
  return <div className="cover-field">
    <h3>Обложка карточки</h3>
    {value && <div className="cover-preview"><GuideCover cover={value} /></div>}
    <div className="utility-actions">
      <label className="cover-upload">
        <ImagePlus size={17} aria-hidden="true" />
        {pending ? 'Обрабатываем…' : value ? 'Заменить обложку' : 'Загрузить обложку'}
        <input type="file" accept={kinds.join(',')} onChange={pick} disabled={pending} />
      </label>
      {value && <button type="button" className="text-button" disabled={pending} onClick={() => { setError(''); onChange(''); }}>Убрать обложку</button>}
    </div>
    <p className="field-hint">JPG, PNG или WebP до 10 МБ. Обложка обрезается по центру до 16:9.</p>
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
