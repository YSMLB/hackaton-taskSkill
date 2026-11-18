'use client';

import { useState } from 'react';
import { Download, FileDown } from 'lucide-react';
import type { Instruction } from '@/lib/community';
import { downloadGuidePdf } from '@/lib/guide-pdf';
import { saveOfflineGuide } from '@/lib/offline-guides';
import { useStore } from './store';
import { VerifiedBadge } from './ExpertReviews';
import { EmbedShare } from './EmbedShare';

export function GuideUtilities({ guide }: { guide: Instruction }) {
  const { notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(offline: boolean) {
    setBusy(true);
    setError('');
    try {
      if (offline) { await saveOfflineGuide(guide); notify('Инструкция сохранена в офлайн-библиотеке'); }
      else await downloadGuidePdf(guide);
    } catch (problem) {
      setError(offline && problem instanceof Error ? problem.message : 'Не удалось скачать PDF. Попробуй снова.');
    } finally { setBusy(false); }
  }
  return <div className="guide-utilities">
    <VerifiedBadge guideId={guide.id} />
    <div className="utility-actions">
      <button type="button" className="button button-outline" disabled={busy} onClick={() => void run(false)}><FileDown size={17} aria-hidden="true" />Скачать PDF</button>
      {guide.status === 'published' && <button type="button" className="button button-outline" disabled={busy} onClick={() => void run(true)}><Download size={17} aria-hidden="true" />Сохранить офлайн</button>}
    </div>
    {guide.status === 'published' && <EmbedShare id={guide.id} />}
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
