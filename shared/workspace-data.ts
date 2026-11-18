import type { Instruction, Profile, StepComment, Vote } from '@shared/community';

export interface Run {
  current: number;
  checked: Record<string, boolean[]>;
  completed: string[];
  visited?: string[];
  lastStepId?: string;
  updatedAt?: number;
}

export interface Report { id: string; guideId: string; stepId: string; text: string; authorId?: string }
export interface ExpertReview { guideId: string; expertId: string; expertName: string; verified: boolean; text: string; createdAt: string }
export interface StepMetric { stepId: string; started: number; completed: number; stopped: number; questions: number }
export interface GuideMetrics { started: number; completed: number; reports: Report[]; steps: StepMetric[] }
export interface WorkspaceData {
  guides: Instruction[];
  runs: Record<string, Run>;
  votes: Record<string, Record<string, Vote>>;
  comments: StepComment[];
  reviews: ExpertReview[];
  analytics: Record<string, GuideMetrics>;
}
export type ProfileEdits = Pick<Profile, 'name' | 'email' | 'avatar' | 'bio'>;
export interface WorkspaceSnapshot { profile: Profile | null; data: WorkspaceData }
export const emptyWorkspace: WorkspaceData = { guides: [], runs: {}, votes: {}, comments: [], reviews: [], analytics: {} };
export const defaultRun = (): Run => ({ current: 0, checked: {}, completed: [], visited: [] });

export type Command =
  | { type: 'register'; profile: ProfileEdits & { role: string } }
  | { type: 'login'; email: string }
  | { type: 'logout' }
  | { type: 'profile'; edits: ProfileEdits }
  | { type: 'save'; guide: Instruction; submit: boolean }
  | { type: 'fork'; guideId: string }
  | { type: 'moderate'; guideId: string; decision: 'approve' | 'reject'; note: string }
  | { type: 'vote'; guideId: string; value: Vote }
  | { type: 'comment' | 'help'; guideId: string; stepId: string; text: string }
  | { type: 'review'; guideId: string; verified: boolean; text: string }
  | { type: 'visit' | 'complete'; guideId: string; stepId: string }
  | { type: 'check'; guideId: string; stepId: string; index: number; checked: boolean }
  | { type: 'import'; guides: Instruction[] };

export interface CommandResult extends WorkspaceSnapshot { id?: string; count?: number }
