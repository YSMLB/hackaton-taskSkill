import { Suspense } from 'react';
import { getPublishedGuide } from '@/lib/server/workspace';
import { EmbeddedGuide } from './EmbeddedGuide';

type Props = { searchParams: Promise<{ id?: string | string[] }> };

async function Content({ searchParams }: Props) {
  const { id } = await searchParams;
  const guide = typeof id === 'string' ? getPublishedGuide(id) : undefined;
  if (!guide) return <main className="offline-page"><h1>Инструкция недоступна</h1><p>Проверь ссылку на опубликованную инструкцию.</p></main>;
  const { id: guideId, title, description, steps } = guide;
  return <EmbeddedGuide guide={{ id: guideId, title, description, steps }} />;
}

export default function EmbedPage(props: Props) {
  return <Suspense fallback={<main className="offline-page">Открываем инструкцию…</main>}><Content {...props} /></Suspense>;
}
