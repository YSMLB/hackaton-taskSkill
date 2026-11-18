import { Suspense } from 'react';
import { backendURL } from '@/lib/backend';
import type { Instruction } from '@shared/community';
import { EmbeddedGuide } from './EmbeddedGuide';

type Props = { searchParams: Promise<{ id?: string | string[] }> };

async function Content({ searchParams }: Props) {
  const { id } = await searchParams;
  const response = typeof id === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(id)
    ? await fetch(backendURL('/api/guides/' + id), { cache: 'no-store' })
    : undefined;
  if (response && !response.ok && response.status !== 404) throw new Error('Не удалось загрузить инструкцию.');
  const guide: Instruction | undefined = response?.ok ? await response.json() : undefined;
  if (!guide) return <main className="offline-page"><h1>Инструкция недоступна</h1><p>Проверь ссылку на опубликованную инструкцию.</p></main>;
  const { id: guideId, title, description, steps } = guide;
  return <EmbeddedGuide guide={{ id: guideId, title, description, steps }} />;
}

export default function EmbedPage(props: Props) {
  return <Suspense fallback={<main className="offline-page">Открываем инструкцию…</main>}><Content {...props} /></Suspense>;
}
