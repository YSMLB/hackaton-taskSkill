import offlineExample from '../../public/offline-example.json';
import type { Instruction } from '@shared/community';

const key = 'stepflow-offline-guides-v1';
export interface OfflineGuide {
  guide: Pick<Instruction, 'id' | 'title' | 'description' | 'category' | 'minutes' | 'author' | 'steps'>;
  checked: Record<string, number[]>;
  savedAt: string;
}

export function offlineGuides(): OfflineGuide[] {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return offlineExample;
    const value = JSON.parse(stored);
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function writeOfflineGuides(items: OfflineGuide[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

export async function saveOfflineGuide({ id, title, description, category, minutes, author, steps }: Instruction) {
  if (!('serviceWorker' in navigator) || !navigator.onLine) throw new Error('Подключись к сети, чтобы сохранить инструкцию.');
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) throw new Error('Офлайн-режим недоступен. Открой сайт по HTTPS или через localhost.');
  const worker = registration.active || (await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Офлайн-режим ещё запускается. Попробуй снова.')), 10000)),
  ])).active;
  if (!worker) throw new Error('Офлайн-режим ещё запускается. Попробуй снова.');
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      channel.port1.close();
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => finish(new Error('Не удалось подготовить офлайн-библиотеку. Попробуй снова.')), 12000);
    channel.port1.onmessage = event => finish(event.data === 'ready' ? undefined : new Error('Не удалось подготовить офлайн-библиотеку.'));
    worker.postMessage('prepare-offline', [channel.port2]);
  });
  const entries = offlineGuides();
  const checked = entries.find(item => item.guide.id === id)?.checked || {};
  writeOfflineGuides([{ guide: { id, title, description, category, minutes, author, steps }, savedAt: new Date().toISOString(), checked }, ...entries.filter(item => item.guide.id !== id)]);
}
