import { Suspense } from 'react';
import { EmbeddedGuide } from './EmbeddedGuide';

type Props = { searchParams: Promise<{ id?: string | string[] }> };

async function getPublishedGuide(id: string) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
    const res = await fetch(`${backendUrl}/api/guides/${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function Content({ searchParams }: Props) {
  const { id } = await searchParams;
  const guide = typeof id === 'string' ? await getPublishedGuide(id) : undefined;
  if (!guide) return <main className="offline-page"><h1>Инструкция недоступна</h1><p>Проверь ссылку на опубликованную инструкцию.</p></main>;
  const { id: guideId, title, description, steps } = guide;
  return <EmbeddedGuide guide={{ id: guideId, title, description, steps }} />;
}

export default function EmbedPage(props: Props) {
  return <Suspense fallback={<main className="offline-page">Открываем инструкцию…</main>}><Content {...props} /></Suspense>;
}
