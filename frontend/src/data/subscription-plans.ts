import type { Plan } from '@shared/community';

export const paidPlans = [
  {
    id: 'standard',
    name: 'StepFlow Plus',
    summary: 'Для тех, кто хочет проверять инструкции и помогать авторам улучшать их.',
    features: ['Администратор может назначить тебя экспертом.', 'С ролью эксперта можно оставлять рецензии и отмечать проверенные материалы.'],
  },
  {
    id: 'business',
    name: 'Бизнес',
    summary: 'Для команд, которым нужно хранить рабочие инструкции в одном месте.',
    features: ['Закрытое пространство для участников команды.', 'Совместное редактирование инструкций.', 'Командные публикации без лимита.'],
  },
] as const satisfies ReadonlyArray<{ id: Plan; name: string; summary: string; features: readonly string[] }>;

export const plans = [
  { id: 'free', name: 'Бесплатный', summary: 'Для учёбы и личных задач.', features: ['Каталог, прохождение инструкций и PDF.'] },
  ...paidPlans,
] as const;

export const businessPrice = '1,5× от цены StepFlow Plus';
