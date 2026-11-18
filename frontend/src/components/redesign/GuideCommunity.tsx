'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GitFork, ThumbsDown, ThumbsUp } from 'lucide-react';
import { actorId, voteSummary, type Instruction } from '@shared/community';
import { useStore } from './store';
import styles from './GuideCommunity.module.css';
import { ExpertReviews } from './ExpertReviews';

export function GuideCommunity({ guide }: { guide: Instruction }) {
  const { data, profile, send, pending } = useStore();
  const router = useRouter();
  const votes = data.votes[guide.id] || {};
  const selected = profile ? votes[actorId(profile)] : undefined;
  const summary = voteSummary(votes);

  return <section className={styles.panel} aria-label="Полезность и версии инструкции">
    {guide.source && <p className={styles.origin}>На основе <Link href={`/guide?id=${guide.source.id}`}>«{guide.source.title}»</Link><span>Автор исходника: {guide.source.author}</span></p>}
    {guide.status === 'published' && <>
      <div className={styles.rating}>
        <div className={styles.ratingCopy}>
          <h3 className={styles.heading}>Помогла инструкция?</h3>
          <p className={styles.description}>{summary.total ? `Полезно: ${summary.helpful} · Не полезно: ${summary.unhelpful}` : 'Поделись оценкой — это поможет другим.'}</p>
        </div>
        <div className={styles.votes} role="group" aria-label="Оценить полезность">
          <button type="button" className={`${styles.vote} ${selected === 'helpful' ? styles.positive : ''}`} aria-label="Полезно" aria-pressed={selected === 'helpful'} disabled={pending} onClick={() => void send({ type: 'vote', guideId: guide.id, value: 'helpful' })}>
            <ThumbsUp size={18} strokeWidth={1.7} /><span>Полезно</span><span className={styles.count}>{summary.helpful}</span>
          </button>
          <button type="button" className={`${styles.vote} ${selected === 'unhelpful' ? styles.negative : ''}`} aria-label="Не полезно" aria-pressed={selected === 'unhelpful'} disabled={pending} onClick={() => void send({ type: 'vote', guideId: guide.id, value: 'unhelpful' })}>
            <ThumbsDown size={18} strokeWidth={1.7} /><span>Не полезно</span><span className={styles.count}>{summary.unhelpful}</span>
          </button>
        </div>
      </div>
      <div className={styles.fork}>
        <span className={styles.forkIcon} aria-hidden="true"><GitFork size={21} strokeWidth={1.7} /></span>
        <div className={styles.forkCopy}>
          <h3 className={styles.heading}>Есть что улучшить?</h3>
          <p className={styles.description}>Создай свою версию. Оригинал останется без изменений.</p>
        </div>
        <button type="button" className={styles.forkButton} disabled={pending} onClick={async () => { const result = await send({ type: 'fork', guideId: guide.id }); if (result?.id) router.push(`/editor?id=${result.id}`); }}>Форк инструкции</button>
      </div>
      <ExpertReviews guide={guide} />
    </>}
  </section>;
}

export function RatingLabel({ id }: { id: string }) {
  const { data } = useStore();
  const summary = voteSummary(data.votes[id]);
  return <span className={styles.catalogRating}><ThumbsUp size={14} />{summary.total ? `${summary.percent}% полезно (${summary.total})` : 'Пока без оценок'}</span>;
}
