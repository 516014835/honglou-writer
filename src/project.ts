import type {
  Chapter,
  CharacterCard,
  Foreshadow,
  Project,
  TimelineEvent,
} from './types.js';

export const PROJECT_VERSION = 1 as const;

/** 新建一个空作品 */
export function createProject(name: string, author?: string): Project {
  return {
    name,
    ...(author ? { author } : {}),
    version: PROJECT_VERSION,
    chapters: [],
    characters: [],
    timeline: [],
    foreshadows: [],
  };
}

function pad(n: number, width = 3): string {
  return String(n).padStart(width, '0');
}

/** 生成形如 `ch-001` 的章 id */
export function chapterId(order: number): string {
  return `ch-${pad(order)}`;
}

/** 在已有 id 集合里找一个不重复的备选 id */
function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export type NewChapter = Omit<Chapter, 'id' | 'order'> & {
  id?: string;
  order?: number;
};

/**
 * 追加一章。`order` 缺省时接在最后一章后面，`id` 缺省时按 order 生成。
 */
export function addChapter(project: Project, input: NewChapter): Chapter {
  const taken = new Set(project.chapters.map((c) => c.id));
  const order =
    input.order ??
    project.chapters.reduce((max, c) => Math.max(max, c.order), 0) + 1;
  const chapter: Chapter = {
    id: uniqueId(input.id ?? chapterId(order), taken),
    order,
    title: input.title,
    body: input.body,
    ...(input.status ? { status: input.status } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  };
  project.chapters.push(chapter);
  return chapter;
}

export function findChapter(project: Project, idOrOrder: string | number): Chapter | undefined {
  if (typeof idOrOrder === 'number') return project.chapters.find((c) => c.order === idOrOrder);
  return project.chapters.find((c) => c.id === idOrOrder);
}

/** 按 order 排好序的章回副本 */
export function sortedChapters(project: Project): Chapter[] {
  return [...project.chapters].sort((a, b) => a.order - b.order);
}

export type NewCharacter = Omit<CharacterCard, 'id'> & { id?: string };

export function addCharacter(project: Project, input: NewCharacter): CharacterCard {
  const taken = new Set(project.characters.map((c) => c.id));
  const card: CharacterCard = {
    ...input,
    id: uniqueId(input.id ?? `char-${pad(project.characters.length + 1)}`, taken),
  };
  project.characters.push(card);
  return card;
}

/**
 * 按正名、别名或 id 找人。返回第一个匹配项。
 */
export function findCharacter(
  project: Project,
  nameOrAlias: string,
): CharacterCard | undefined {
  return project.characters.find(
    (c) => c.id === nameOrAlias || c.name === nameOrAlias || (c.aliases ?? []).includes(nameOrAlias),
  );
}

export type NewEvent = Omit<TimelineEvent, 'id'> & { id?: string };

export function addEvent(project: Project, input: NewEvent): TimelineEvent {
  const taken = new Set(project.timeline.map((e) => e.id));
  const event: TimelineEvent = {
    ...input,
    id: uniqueId(input.id ?? `ev-${pad(project.timeline.length + 1)}`, taken),
  };
  project.timeline.push(event);
  return event;
}

/** 按书内时间顺序排好的事件副本 */
export function sortedTimeline(project: Project): TimelineEvent[] {
  return [...project.timeline].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export type NewForeshadow = Omit<Foreshadow, 'id' | 'status'> & {
  id?: string;
  status?: Foreshadow['status'];
};

/** 埋一个伏笔 */
export function plantForeshadow(project: Project, input: NewForeshadow): Foreshadow {
  const taken = new Set(project.foreshadows.map((f) => f.id));
  const item: Foreshadow = {
    ...input,
    id: uniqueId(input.id ?? `fs-${pad(project.foreshadows.length + 1)}`, taken),
    status: input.status ?? 'open',
  };
  project.foreshadows.push(item);
  return item;
}

/**
 * 回收一个伏笔：写入回收章 id 并把状态置为 `paid`。
 * 找不到该伏笔时返回 undefined。
 */
export function payForeshadow(
  project: Project,
  id: string,
  payoffChapterId: string,
): Foreshadow | undefined {
  const item = project.foreshadows.find((f) => f.id === id);
  if (!item) return undefined;
  item.payoffChapterId = payoffChapterId;
  item.status = 'paid';
  return item;
}

/** 弃用一个伏笔（不打算回收了） */
export function dropForeshadow(project: Project, id: string): Foreshadow | undefined {
  const item = project.foreshadows.find((f) => f.id === id);
  if (!item) return undefined;
  item.status = 'dropped';
  return item;
}

/** 还没回收的伏笔 */
export function openForeshadows(project: Project): Foreshadow[] {
  return project.foreshadows.filter((f) => f.status === 'open');
}

/** 某一章里埋下的伏笔 */
export function foreshadowsPlantedIn(project: Project, chapterId: string): Foreshadow[] {
  return project.foreshadows.filter((f) => f.plantedChapterId === chapterId);
}
