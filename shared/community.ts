export type PublicationStatus = 'draft' | 'pending' | 'published' | 'rejected';
export type Vote = 'helpful' | 'unhelpful';
export type Plan = 'free' | 'standard' | 'business';
export interface Profile { id?: string; name: string; email: string; role: string; plan?: Plan; plusTrialUsed?: boolean; plusTrialEndsAt?: number; avatar?: string; bio?: string }
export interface Step { id: string; title: string; text: string; code?: string; filename?: string; checks: string[]; imageUrl?: string; videoUrl?: string }
export interface StepComment { id: string; guideId: string; stepId: string; authorId: string; authorName: string; text: string; createdAt: string }
export interface Instruction {
  aiGenerated?: boolean;
  id: string; title: string; description: string; category: string; minutes: number;
  author: string; status: PublicationStatus; owned?: boolean; ownerId?: string; steps: Step[];
  teamId?: string; revision?: number;
  cover?: string;
  source?: { id: string; title: string; author: string };
  moderationNote?: string; submittedAt?: string; reviewedAt?: string; reviewedBy?: string;
}
export const publicationLabels: Record<PublicationStatus, string> = {
  draft: 'Черновик', pending: 'На проверке', published: 'Опубликована', rejected: 'Нужны правки',
};
export function actorId(profile: Profile): string {
  return profile.id || `local:${profile.email.trim().toLocaleLowerCase('ru') || profile.name.trim() || 'anonymous'}`;
}
export function isAdmin(profile: Profile | null): boolean { return profile?.role === 'Администратор'; }
export function isExpert(profile: Profile | null): boolean { return profile?.role === 'Эксперт' && (profile.plan === 'standard' || profile.plan === 'business'); }
export function isOwner(guide: Instruction, profile: Profile | null): boolean {
  return Boolean(profile && guide.owned && guide.ownerId === actorId(profile));
}
export function canView(guide: Instruction, profile: Profile | null): boolean {
  return guide.status === 'published' || isOwner(guide, profile) || (isAdmin(profile) && (guide.status === 'pending' || guide.status === 'rejected'));
}
export function voteSummary(votes: Record<string, Vote> = {}) {
  const values = Object.values(votes);
  const helpful = values.filter(v => v === 'helpful').length;
  return { helpful, unhelpful: values.length - helpful, total: values.length, percent: values.length ? Math.round(helpful / values.length * 100) : null };
}
