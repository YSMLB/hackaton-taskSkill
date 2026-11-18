import type { Step } from '@shared/community';

export function StepMedia({ step }: { step: Step }) {
  if (!step.imageUrl && !step.videoUrl) return null;
  return <div className="step-media">
    {/* eslint-disable-next-line @next/next/no-img-element -- External illustration URLs are provided by authors. */}
    {step.imageUrl && <img src={step.imageUrl} alt={'Иллюстрация к шагу «' + step.title + '»'} loading="lazy" referrerPolicy="no-referrer" />}
    {step.videoUrl && <a href={step.videoUrl} target="_blank" rel="noopener noreferrer">Открыть видео к шагу</a>}
  </div>;
}
