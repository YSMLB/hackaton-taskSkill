export type GuideCategory =
  | 'DevOps'
  | 'Backend'
  | 'Frontend'
  | 'Security'
  | 'Database';

export type GuideDifficulty = 'Легкий' | 'Средний' | 'Продвинутый';

export interface ChecklistItem {
  id: string;
  title: string;
  isRequired: boolean;
  completed: boolean;
}

export interface GuideStep {
  id: string;
  order: number;
  title: string;
  description: string;
  contentMarkdown: string;
  codeSnippet?: {
    language: string;
    code: string;
    filename?: string;
  };
  checklist: ChecklistItem[];
  estimatedMinutes: number;
  averageTimeSeconds: number;
  dropRatePercent: number;
  stuckSignalsCount: number;
}

export interface Guide {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: GuideCategory;
  difficulty: GuideDifficulty;
  totalSteps: number;
  estimatedTotalMinutes: number;
  completionRatePercent: number;
  authorName: string;
  authorAvatarUrl: string;
  viewsCount: number;
  forksCount: number;
  steps: GuideStep[];
}

export type DemoViewMode = 'catalog' | 'player' | 'dashboard' | 'editor';

export interface DropOffMetric {
  stepId: string;
  stepOrder: number;
  stepTitle: string;
  startedCount: number;
  completedCount: number;
  dropRatePercent: number;
  averageTimeSeconds: number;
  stuckReportsCount: number;
}

export type AuthModalMode = 'login' | 'register' | null;
