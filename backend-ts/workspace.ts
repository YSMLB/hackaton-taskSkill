import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { initialGuides } from '@backend/data/guide-seeds';
import { actorId, canView, isAdmin, isExpert, isOwner, type Instruction, type Profile, type StepComment, type Vote } from '@shared/community';
import { defaultRun, type ExpertReview, type GuideMetrics, type Report, type Run, type Team, type Notice, type WorkspaceSnapshot } from '@shared/workspace-data';

type State = {
  teams?: Team[];
  notices?: Record<string, Notice[]>;
  accounts: Record<string, Profile>;
  guides: Instruction[];
  runs: Record<string, Record<string, Run>>;
  votes: Record<string, Record<string, Vote>>;
  comments: StepComment[];
  reports: Report[];
  reviews: ExpertReview[];
  imports: Record<string, Record<string, string>>;
};

export const sessionCookie = 'stepflow-session';
export const sessionLifetime = 60 * 60 * 24 * 30;
const roles = ['Ученик', 'Автор', 'Администратор'];
let database: DatabaseSync | undefined;

function db() {
  if (database) return database;
  const file = resolve(/* turbopackIgnore: true */ process.env.STEPFLOW_DB_PATH || '.stepflow/stepflow.sqlite');
  mkdirSync(dirname(file), { recursive: true });
  const connection = new DatabaseSync(file);
  connection.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, account TEXT NOT NULL, expires INTEGER NOT NULL);
  `);
  const seed: State = { accounts: {}, guides: initialGuides, runs: {}, votes: {}, comments: [], reports: [], reviews: [], imports: {} };
  connection.prepare('INSERT OR IGNORE INTO workspace VALUES (1, ?)').run(JSON.stringify(seed));
  database = connection;
  return connection;
}
function state(connection: DatabaseSync): State {
  return JSON.parse(String(connection.prepare('SELECT payload FROM workspace WHERE id = 1').get()?.payload));
}
function digest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
function profileFor(connection: DatabaseSync, workspace: State, token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = connection.prepare('SELECT account FROM sessions WHERE token = ? AND expires > ?').get(digest(token), Date.now());
  return row ? workspace.accounts[String(row.account)] || null : null;
}
export class WorkspaceError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
function requireCondition(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new WorkspaceError(message, status);
}
function record(value: unknown): Record<string, unknown> {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value), 'Некорректные данные.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, required = false) {
  requireCondition(typeof value === 'string' && value.length <= max, 'Проверь длину полей.');
  const clean = value.trim();
  requireCondition(!required || clean, 'Заполни обязательные поля.');
  return clean;
}
function emailKey(email: string) { return email.trim().toLocaleLowerCase('ru'); }
function findAccount(workspace: State, email: string) {
  return Object.values(workspace.accounts).find(account => emailKey(account.email) === emailKey(email));
}
function guideId(value: unknown) {
  const id = text(value, 100, true);
  requireCondition(/^[a-zA-Z0-9-]+$/.test(id), 'Некорректный идентификатор.');
  return id;
}

function media(value: unknown) {
  if (value === undefined || value === '') return undefined;
  const url = text(value, 2000, true);
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return parsed.href;
  } catch { /* Invalid URL. */ }
  throw new WorkspaceError('Укажи ссылку на медиа с HTTPS.');
}

function myTeams(workspace: State, profile: Profile | null) {
  return (workspace.teams || []).filter(team => profile && team.memberIds.includes(actorId(profile)));
}
function visible(workspace: State, guide: Instruction, profile: Profile | null) {
  return guide.teamId ? myTeams(workspace, profile).some(team => team.id === guide.teamId) : canView(guide, profile);
}
function tell(workspace: State, recipient: string | undefined, actor: string, text: string, href: string) {
  if (!recipient || recipient === actor) return;
  const notices = (workspace.notices ||= {});
  notices[recipient] = [{ id: randomUUID(), text, href, read: false, createdAt: new Date().toISOString() }, ...(notices[recipient] || [])].slice(0, 200);
}

function parseGuide(value: unknown, profile: Profile, previous: Instruction | undefined, submit: boolean, id: string): Instruction {
  const raw = record(value);
  const cover = raw.cover === undefined ? previous?.cover : text(raw.cover, 300_000);
  requireCondition(!cover || (cover.length >= 30 && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(cover)), 'Загрузи корректное изображение для обложки.');
  requireCondition(Array.isArray(raw.steps) && raw.steps.length >= 1 && raw.steps.length <= 60, 'В инструкции должно быть от 1 до 60 шагов.');
  const steps = raw.steps.map(item => {
    const step = record(item);
    requireCondition(Array.isArray(step.checks) && step.checks.length <= 30, 'В одном шаге может быть до 30 пунктов.');
    const checks = step.checks.map(check => text(check, 500)).filter(Boolean);
    requireCondition(!submit || checks.length, 'Добавь пункт чек-листа в каждый шаг.');
    return {
      id: guideId(step.id), title: text(step.title, 200, submit), text: text(step.text, 16000, submit), checks,
      imageUrl: media(step.imageUrl), videoUrl: media(step.videoUrl),
      code: step.code === undefined ? undefined : text(step.code, 16000),
      filename: step.filename === undefined ? undefined : text(step.filename, 200),
    };
  });
  requireCondition(new Set(steps.map(step => step.id)).size === steps.length, 'Шаги должны иметь разные идентификаторы.');
  requireCondition(typeof raw.minutes === 'number' && Number.isFinite(raw.minutes), 'Укажи время прохождения.');
  return {
    id, title: text(raw.title, 250, submit) || 'Без названия', description: text(raw.description, 4000, submit),
    category: text(raw.category, 100) || 'Учёба', minutes: Math.min(1440, Math.max(1, Math.round(raw.minutes))),
    author: profile.name, ownerId: actorId(profile), owned: true, status: submit ? 'pending' : 'draft',
    source: previous?.source, cover: cover || undefined, steps, submittedAt: submit ? new Date().toISOString() : undefined,
  };
}
function metrics(workspace: State, guide: Instruction): GuideMetrics {
  const runs = Object.entries(workspace.runs[guide.id] || {}).filter(([id]) => id !== guide.ownerId).map(([, run]) => run);
  const reports = workspace.reports.filter(report => report.guideId === guide.id && report.authorId !== guide.ownerId);
  const started = runs.filter(run => guide.steps.some(step => run.visited?.includes(step.id)));
  return {
    started: started.length,
    completed: started.filter(run => guide.steps.every(step => run.completed.includes(step.id))).length,
    reports,
    steps: guide.steps.map(step => ({
      stepId: step.id,
      started: started.filter(run => run.visited?.includes(step.id)).length,
      completed: started.filter(run => run.completed.includes(step.id)).length,
      stopped: started.filter(run => run.lastStepId === step.id && !run.completed.includes(step.id)).length,
      questions: new Set(reports.filter(report => report.stepId === step.id).map(report => report.authorId)).size,
    })),
  };
}
function snapshot(workspace: State, profile: Profile | null): WorkspaceSnapshot {
  const guides = workspace.guides.filter(guide => visible(workspace, guide, profile));
  const publicIds = new Set(guides.filter(guide => guide.status === 'published').map(guide => guide.id));
  const id = profile && actorId(profile);
  const myRuns: Record<string, Run> = {};
  const analytics: Record<string, GuideMetrics> = {};
  for (const guide of guides) {
    const run = id ? workspace.runs[guide.id]?.[id] : undefined;
    if (run) {
      const current = guide.steps.findIndex(step => step.id === run.lastStepId);
      myRuns[guide.id] = { ...run, current: current < 0 ? 0 : current };
    }
    if (isOwner(guide, profile)) analytics[guide.id] = metrics(workspace, guide);
  }
  return {
    profile,
    data: {
      teams: myTeams(workspace, profile), notices: id ? workspace.notices?.[id] || [] : [],
      guides, runs: myRuns, analytics,
      comments: workspace.comments.filter(comment => publicIds.has(comment.guideId)),
      reviews: workspace.reviews.filter(review => publicIds.has(review.guideId)),
      votes: Object.fromEntries(Object.entries(workspace.votes).filter(([key]) => publicIds.has(key))),
    },
  };
}
export function readWorkspace(token?: string) {
  const connection = db();
  const workspace = state(connection);
  return snapshot(workspace, profileFor(connection, workspace, token));
}
export function getPublishedGuide(id: string) {
  return state(db()).guides.find(guide => guide.id === id && guide.status === 'published' && !guide.teamId);
}

export function changeWorkspace(token: string | undefined, input: unknown) {
  const command = record(input);
  const connection = db();
  connection.exec('BEGIN IMMEDIATE');
  try {
    const workspace = state(connection);
    const current = profileFor(connection, workspace, token);
    let profile = current;
    let nextToken: string | null | undefined;
    let id: string | undefined;
    let count: number | undefined;
    switch (command.type) {
      case 'register':
      case 'login': {
        const registering = command.type === 'register';
        const raw = registering ? record(command.profile) : command;
        const email = text(raw.email, 254);
        const existing = findAccount(workspace, email);
        requireCondition(!registering || !existing, 'Такой профиль уже есть. Нажми «Вход».', 409);
        const role = registering ? text(raw.role, 40, true) : 'Ученик';
        requireCondition(roles.includes(role), 'Выбери доступную роль.');
        profile = existing || {
          id: randomUUID(), email, role,
          name: registering ? text(raw.name, 100) || 'Участник' : 'Участник',
        };
        workspace.accounts[actorId(profile)] = profile;
        const now = Date.now();
        connection.prepare('DELETE FROM sessions WHERE expires <= ?').run(now);
        nextToken = randomBytes(32).toString('hex');
        connection.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(nextToken), actorId(profile), now + sessionLifetime * 1000);
        if (token) connection.prepare('DELETE FROM sessions WHERE token = ?').run(digest(token));
        break;
      }
      case 'logout':
        if (token) connection.prepare('DELETE FROM sessions WHERE token = ?').run(digest(token));
        profile = null;
        nextToken = null;
        break;
      default: {
        requireCondition(current, 'Войди в аккаунт, чтобы продолжить.', 401);
        const actor = actorId(current);
        if (command.type === 'plan') {
          const plan = command.plan;
          requireCondition(plan === 'free' || plan === 'standard' || plan === 'business', 'Выбери тариф.');
          profile = { ...current, plan };
          workspace.accounts[actor] = profile;
          for (const team of workspace.teams || []) {
            if (team.ownerId === actor) team.active = plan === 'business';
          }
          break;
        }
        if (command.type === 'expert') {
          requireCondition(isAdmin(current), 'Назначать экспертов может администратор.', 403);
          const target = findAccount(workspace, text(command.email, 254, true));
          requireCondition(target && !isAdmin(target), 'Профиль не найден или принадлежит администратору.', 404);
          requireCondition(typeof command.enabled === 'boolean', 'Выбери действие.');
          if (command.enabled) {
            requireCondition(target.plan === 'standard' || target.plan === 'business', 'Для назначения нужна подписка.', 409);
            target.role = 'Эксперт';
          } else if (target.role === 'Эксперт') target.role = 'Автор';
          tell(workspace, actorId(target), actor, command.enabled ? 'Тебя назначили экспертом' : 'Роль эксперта отозвана', '/profile');
          break;
        }
        if (command.type === 'team-create') {
          requireCondition(current.plan === 'business', 'Создание команды доступно на тарифе «Бизнес».', 403);
          const name = text(command.name, 100, true);
          (workspace.teams ||= []).push({ id: randomUUID(), name, ownerId: actor, memberIds: [actor], active: true });
          break;
        }
        if (command.type === 'team-member') {
          const team = myTeams(workspace, current).find(item => item.id === command.teamId);
          requireCondition(team?.ownerId === actor && team.active, 'Изменять состав может владелец команды с тарифом «Бизнес».', 403);
          const member = findAccount(workspace, text(command.email, 254, true));
          requireCondition(member && actorId(member) !== actor, 'Укажи email другого зарегистрированного участника.');
          const memberId = actorId(member);
          if (command.remove === true) team.memberIds = team.memberIds.filter(id => id !== memberId);
          else if (!team.memberIds.includes(memberId)) {
            team.memberIds.push(memberId);
            tell(workspace, memberId, actor, 'Тебя добавили в команду «' + team.name + '»', '/team');
          }
          break;
        }
        if (command.type === 'notices-read') {
          for (const notice of workspace.notices?.[actor] || []) {
            if (command.id === undefined || notice.id === command.id) notice.read = true;
          }
          break;
        }
        if (command.type === 'profile') {
          const edits = record(command.edits);
          const email = text(edits.email, 254, true);
          const existing = findAccount(workspace, email);
          requireCondition(!existing || actorId(existing) === actor, 'Этот email уже используется.', 409);
          const avatar = edits.avatar === undefined ? undefined : text(edits.avatar, 450000);
          requireCondition(!avatar || /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar), 'Не удалось сохранить это фото.');
          profile = { ...current, email, name: text(edits.name, 100, true), bio: edits.bio === undefined ? '' : text(edits.bio, 400), avatar };
          workspace.accounts[actor] = profile;
          break;
        }
        if (command.type === 'save') {
          const raw = record(command.guide);
          const requested = guideId(raw.id);
          const index = workspace.guides.findIndex(guide => guide.id === requested);
          const previous = workspace.guides[index];
          const teamId = previous ? previous.teamId : raw.teamId;
          const team = myTeams(workspace, current).find(item => item.id === teamId);
          requireCondition(teamId === undefined || team?.active, 'Редактирование доступно участникам активной команды.', 403);
          requireCondition(!previous || team || isOwner(previous, current), 'Редактировать может только автор.', 403);
          requireCondition(!previous || (raw.revision || 0) === (previous.revision || 0), 'Кто-то уже сохранил правки. Скопируй свои изменения и обнови редактор.', 409);
          id = previous ? requested : randomUUID();
          const guide = parseGuide(raw, current, previous, command.submit === true, id);
          guide.revision = (previous?.revision || 0) + 1;
          if (team) {
            guide.teamId = team.id;
            guide.status = command.submit === true ? 'published' : 'draft';
            if (previous) {
              guide.ownerId = previous.ownerId;
              guide.author = previous.author;
            }
            for (const memberId of team.memberIds) tell(workspace, memberId, actor, 'В команде обновлена инструкция «' + guide.title + '»', '/team');
          }
          if (previous) workspace.guides[index] = guide;
          else workspace.guides.unshift(guide);
          workspace.reviews = workspace.reviews.filter(review => review.guideId !== id);
          break;
        }
        if (command.type === 'import') {
          requireCondition(Array.isArray(command.guides) && command.guides.length <= 30, 'Можно перенести до 30 черновиков за раз.');
          const imported = workspace.imports[actor] ||= {};
          count = 0;
          for (const incoming of command.guides) {
            const raw = record(incoming);
            const sourceId = guideId(raw.id);
            if (Object.hasOwn(imported, sourceId)) continue;
            const id = randomUUID();
            workspace.guides.unshift(parseGuide(raw, current, undefined, false, id));
            imported[sourceId] = id;
            count++;
          }
          break;
        }
        const key = guideId(command.guideId);
        const guide = workspace.guides.find(item => item.id === key);
        requireCondition(guide && visible(workspace, guide, current), 'Инструкция недоступна.', 404);
        if (command.type === 'moderate') {
          requireCondition(isAdmin(current), 'Решение принимает администратор.', 403);
          requireCondition(guide.status === 'pending', 'Решение уже принято или инструкция отозвана.', 409);
          requireCondition(command.decision === 'approve' || command.decision === 'reject', 'Выбери решение.');
          guide.moderationNote = text(command.note, 2000, command.decision === 'reject');
          guide.status = command.decision === 'approve' ? 'published' : 'rejected';
          guide.reviewedAt = new Date().toISOString();
          guide.reviewedBy = current.name;
          tell(workspace, guide.ownerId, actor, command.decision === 'approve' ? 'Инструкция опубликована' : 'Инструкцию вернули на доработку', '/editor?id=' + key);
          break;
        }
        requireCondition(guide.status === 'published', 'Действие доступно после публикации.', 403);
        if (command.type === 'reply') {
          requireCondition(isOwner(guide, current), 'Ответить на вопрос может автор.', 403);
          const report = workspace.reports.find(item => item.guideId === key && item.id === command.reportId);
          requireCondition(report, 'Вопрос не найден.', 404);
          report.reply = text(command.text, 2000, true);
          tell(workspace, report.authorId, actor, 'Автор ответил на вопрос: ' + report.reply, '/guide?id=' + key);
          break;
        }
        if (command.type === 'fork') {
          requireCondition(!guide.teamId, 'Командная инструкция доступна внутри команды.', 403);
          id = randomUUID();
          workspace.guides.unshift({
            ...structuredClone(guide), id, title: `${guide.title.slice(0, 230)} — моя версия`,
            author: current.name, ownerId: actor, owned: true, status: 'draft',
            source: { id: guide.id, title: guide.title, author: guide.author },
            moderationNote: undefined, reviewedBy: undefined, reviewedAt: undefined, submittedAt: undefined,
            steps: guide.steps.map(step => ({ ...step, id: randomUUID() })),
          });
          break;
        }
        if (command.type === 'vote') {
          requireCondition(command.value === 'helpful' || command.value === 'unhelpful', 'Неизвестная оценка.');
          const votes = workspace.votes[key] ||= {};
          if (votes[actor] === command.value) delete votes[actor];
          else votes[actor] = command.value;
          break;
        }
        if (command.type === 'review') {
          requireCondition(isExpert(current) && !guide.teamId && !isOwner(guide, current), 'Рецензию может оставить эксперт на чужую инструкцию.', 403);
          requireCondition(typeof command.verified === 'boolean', 'Выбери результат проверки.');
          const review: ExpertReview = { guideId: key, expertId: actor, expertName: current.name, verified: command.verified, text: text(command.text, 2000, true), createdAt: new Date().toISOString() };
          tell(workspace, guide.ownerId, actor, 'Эксперт оставил рецензию', '/guide?id=' + key);
          workspace.reviews = [review, ...workspace.reviews.filter(item => item.guideId !== key || item.expertId !== actor)];
          break;
        }
        const index = guide.steps.findIndex(step => step.id === command.stepId);
        requireCondition(index !== -1, 'Шаг не найден.', 404);
        const step = guide.steps[index];
        if (command.type === 'comment' || command.type === 'help') {
          const content = text(command.text, command.type === 'help' ? 1500 : 2000, true);
          const entry = { id: randomUUID(), guideId: key, stepId: step.id, text: content, authorId: actor };
          if (command.type === 'comment') workspace.comments.push({ ...entry, authorName: current.name, createdAt: new Date().toISOString() });
          else workspace.reports.push(entry);
          tell(workspace, guide.ownerId, actor, command.type === 'help' ? 'Новый вопрос к шагу «' + step.title + '»' : 'Новый комментарий к шагу «' + step.title + '»', command.type === 'help' ? '/analytics?id=' + key : '/guide?id=' + key);
          break;
        }
        requireCondition(command.type === 'visit' || command.type === 'check' || command.type === 'complete', 'Неизвестное действие.');
        const guideRuns = workspace.runs[key] ||= {};
        const run = guideRuns[actor] ||= defaultRun();
        run.current = index;
        run.visited = [...new Set([...(run.visited || []), step.id])];
        run.lastStepId = step.id;
        run.updatedAt = Date.now();
        if (command.type === 'check') {
          const check = command.index;
          requireCondition(typeof check === 'number' && Number.isInteger(check) && check >= 0 && check < step.checks.length && typeof command.checked === 'boolean', 'Пункт чек-листа не найден.');
          const ticks = run.checked[step.id] ||= [];
          ticks[check] = command.checked;
          if (!command.checked) run.completed = run.completed.filter(completed => completed !== step.id);
        }
        if (command.type === 'complete') {
          requireCondition(step.checks.every((_, i) => run.checked[step.id]?.[i]), 'Отметь все пункты этого шага.');
          run.completed = [...new Set([...run.completed, step.id])];
          const remaining = guide.steps.findIndex(item => !run.completed.includes(item.id));
          if (remaining !== -1) {
            run.current = index + 1 < guide.steps.length ? index + 1 : remaining;
            const next = guide.steps[run.current];
            run.lastStepId = next.id;
            run.visited = [...new Set([...run.visited, next.id])];
          }
        }
      }
    }
    const result = { ...snapshot(workspace, profile), id, count };
    connection.prepare('UPDATE workspace SET payload = ? WHERE id = 1').run(JSON.stringify(workspace));
    connection.exec('COMMIT');
    return { result, nextToken };
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
}
