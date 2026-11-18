'use client';

import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { isExpert, isOwner, type Instruction } from '@shared/community';
import { useStore } from './store';

export function VerifiedBadge({ guideId }: { guideId: string }) {
  const { data } = useStore();
  if (!data.reviews.some(review => review.guideId === guideId && review.verified)) return null;
  return <span className="verified-badge"><ShieldCheck size={15} aria-hidden="true" />Проверено экспертом</span>;
}

export function ExpertReviews({ guide }: { guide: Instruction }) {
  const { data, profile, send, pending } = useStore();
  const reviews = data.reviews.filter(review => review.guideId === guide.id);
  const mine = reviews.find(review => review.expertId === profile?.id);
  const [text, setText] = useState(mine?.text || '');
  const [verified, setVerified] = useState(mine?.verified ?? true);
  const [saved, setSaved] = useState(false);
  const canReview = isExpert(profile) && !isOwner(guide, profile);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !text.trim()) return;
    if (await send({ type: 'review', guideId: guide.id, text, verified })) setSaved(true);
  }

  return <section className="reports-panel" aria-label="Экспертные рецензии">
    <h2><ShieldCheck size={20} aria-hidden="true" />Экспертные рецензии</h2>
    {reviews.length ? reviews.map(review => <article key={review.expertId}>
      <strong>{review.expertName}</strong>
      <p className="review-verdict">{review.verified ? 'Подтвердил инструкцию' : 'Предложил правки'}</p>
      <p>{review.text}</p>
    </article>) : <p className="muted">Пока нет рецензий.</p>}
    {canReview && <form className="expert-form" onSubmit={submit} onChange={() => setSaved(false)}>
      <div className="field"><label htmlFor="expert-verdict">Результат проверки</label><select id="expert-verdict" value={verified ? 'yes' : 'no'} onChange={event => setVerified(event.target.value === 'yes')}><option value="yes">Подтвердить инструкцию</option><option value="no">Предложить правки</option></select></div>
      <div className="field"><label htmlFor="expert-review">Рецензия</label><textarea id="expert-review" required rows={4} maxLength={2000} value={text} onChange={event => setText(event.target.value)} placeholder="Что проверил и что стоит уточнить?" /></div>
      <button className="button button-dark" type="submit" disabled={pending || !text.trim()}>Сохранить рецензию</button>
      {saved && <p className="small-note" role="status">Рецензия сохранена</p>}
    </form>}
  </section>;
}
