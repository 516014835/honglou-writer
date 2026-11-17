import type { Project } from './types.js';
import { sortedChapters } from './project.js';

export type DiagnosticLevel = 'error' | 'warning' | 'info';

/** 一条检查结果 */
export interface Diagnostic {
  level: DiagnosticLevel;
  /** 稳定的机器可读代码，如 `MISSING_CHAPTER_REF` */
  code: string;
  message: string;
  /** 出问题的对象 id */
  target?: string;
}

const LEVEL_ICON: Record<DiagnosticLevel, string> = {
  error: '✖',
  warning: '▲',
  info: 'ℹ',
};

const LEVEL_LABEL: Record<DiagnosticLevel, string> = {
  error: '错误',
  warning: '警告',
  info: '提示',
};

/** 把检查结果排成人看的文本 */
export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) return '没有发现问题。';
  return diagnostics
    .map((d) => `${LEVEL_ICON[d.level]} [${LEVEL_LABEL[d.level]}] ${d.message}`)
    .join('\n');
}

function duplicates<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const dup = new Map<string, number>();
  for (const [k, n] of counts) if (n > 1) dup.set(k, n);
  return dup;
}

/**
 * 全书体检。规则：
 *
 * - id / 序号重复 → error
 * - 引用了不存在的章 id → error
 * - 伏笔回收章早于埋设章 → error
 * - 空章、无回目、未回收伏笔 → warning
 * - 人物没写首次出场章 → info
 */
export function checkProject(project: Project): Diagnostic[] {
  const out: Diagnostic[] = [];
  const chapters = sortedChapters(project);
  const chapterIds = new Set(chapters.map((c) => c.id));
  const orderById = new Map(chapters.map((c) => [c.id, c.order]));

  for (const [id, n] of duplicates(project.chapters, (c) => c.id)) {
    out.push({ level: 'error', code: 'DUPLICATE_CHAPTER_ID', message: `章 id「${id}」重复出现 ${n} 次`, target: id });
  }
  for (const [order, n] of duplicates(project.chapters, (c) => String(c.order))) {
    out.push({
      level: 'error',
      code: 'DUPLICATE_CHAPTER_ORDER',
      message: `第 ${order} 章的序号用了 ${n} 次`,
      target: order,
    });
  }
  for (const [id, n] of duplicates(project.characters, (c) => c.id)) {
    out.push({ level: 'error', code: 'DUPLICATE_CHARACTER_ID', message: `人物 id「${id}」重复出现 ${n} 次`, target: id });
  }
  for (const [id, n] of duplicates(project.foreshadows, (f) => f.id)) {
    out.push({ level: 'error', code: 'DUPLICATE_FORESHADOW_ID', message: `伏笔 id「${id}」重复出现 ${n} 次`, target: id });
  }

  if (chapters.length === 0) {
    out.push({ level: 'info', code: 'EMPTY_PROJECT', message: '这本书还没有任何章回。' });
  }

  for (const chapter of chapters) {
    if (!chapter.title.trim()) {
      out.push({
        level: 'warning',
        code: 'EMPTY_CHAPTER_TITLE',
        message: `第 ${chapter.order} 章（${chapter.id}）还没有回目`,
        target: chapter.id,
      });
    }
    if (!chapter.body.trim()) {
      out.push({
        level: 'warning',
        code: 'EMPTY_CHAPTER_BODY',
        message: `第 ${chapter.order} 章「${chapter.title || chapter.id}」正文还是空的`,
        target: chapter.id,
      });
    }
  }

  for (const card of project.characters) {
    if (card.firstChapterId && !chapterIds.has(card.firstChapterId)) {
      out.push({
        level: 'error',
        code: 'MISSING_CHAPTER_REF',
        message: `人物「${card.name}」的首次出场章「${card.firstChapterId}」不存在`,
        target: card.id,
      });
    }
    if (!card.firstChapterId) {
      out.push({
        level: 'info',
        code: 'CHARACTER_WITHOUT_DEBUT',
        message: `人物「${card.name}」还没标首出场章`,
        target: card.id,
      });
    }
    for (const rel of card.relations ?? []) {
      if (!project.characters.some((c) => c.id === rel.to)) {
        out.push({
          level: 'warning',
          code: 'DANGLING_RELATION',
          message: `人物「${card.name}」的关系「${rel.label}」指向不存在的人物「${rel.to}」`,
          target: card.id,
        });
      }
    }
  }

  for (const event of project.timeline) {
    if (!chapterIds.has(event.chapterId)) {
      out.push({
        level: 'error',
        code: 'MISSING_CHAPTER_REF',
        message: `事件「${event.title}」挂在章「${event.chapterId}」上，但该章不存在`,
        target: event.id,
      });
    }
  }

  for (const fs of project.foreshadows) {
    if (!chapterIds.has(fs.plantedChapterId)) {
      out.push({
        level: 'error',
        code: 'MISSING_CHAPTER_REF',
        message: `伏笔「${fs.title}」的埋设章「${fs.plantedChapterId}」不存在`,
        target: fs.id,
      });
    }
    if (fs.payoffChapterId && !chapterIds.has(fs.payoffChapterId)) {
      out.push({
        level: 'error',
        code: 'MISSING_CHAPTER_REF',
        message: `伏笔「${fs.title}」的回收章「${fs.payoffChapterId}」不存在`,
        target: fs.id,
      });
    }
    const plantOrder = orderById.get(fs.plantedChapterId);
    const payOrder = fs.payoffChapterId ? orderById.get(fs.payoffChapterId) : undefined;
    if (plantOrder !== undefined && payOrder !== undefined && payOrder < plantOrder) {
      out.push({
        level: 'error',
        code: 'PAYOFF_BEFORE_PLANT',
        message: `伏笔「${fs.title}」的回收章（第 ${payOrder} 章）早于埋设章（第 ${plantOrder} 章）`,
        target: fs.id,
      });
    }
    if (fs.status === 'open') {
      out.push({
        level: 'warning',
        code: 'OPEN_FORESHADOW',
        message: `伏笔「${fs.title}」还没回收（第 ${plantOrder ?? '?'} 章埋下）`,
        target: fs.id,
      });
    }
    if (fs.status === 'paid' && !fs.payoffChapterId) {
      out.push({
        level: 'warning',
        code: 'PAID_WITHOUT_CHAPTER',
        message: `伏笔「${fs.title}」标成已回收，但没写回收章`,
        target: fs.id,
      });
    }
  }

  return out;
}

/** 是否有 error 级问题 */
export function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.level === 'error');
}
