import type { Chapter, Project } from './types.js';

const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g;
const CJK_TEST = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const WORD = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;

/**
 * 计字数：中日韩汉字按字计，英文/数字按词计，忽略空白与标点。
 *
 * 这样「林黛玉道：“好。”」算 5 字，「hello world」算 2 词。
 */
export function countWords(text: string): number {
  if (!text) return 0;
  const cjk = text.match(CJK)?.length ?? 0;
  const rest = cjk > 0 ? text.replace(CJK, ' ') : text;
  const words = rest.match(WORD)?.length ?? 0;
  return cjk + words;
}

/** 计非空白字符数（标点也算，用于估算排版长度） */
export function countChars(text: string): number {
  if (!text) return 0;
  return text.replace(/\s/g, '').length;
}

/** 是否含有汉字 */
export function hasCJK(text: string): boolean {
  return CJK_TEST.test(text);
}

/** 单章统计 */
export interface ChapterStat {
  id: string;
  order: number;
  title: string;
  words: number;
  chars: number;
}

/** 全书统计 */
export interface ProjectStat {
  chapters: number;
  totalWords: number;
  totalChars: number;
  /** 平均每章字数，保留一位小数 */
  averageWords: number;
  perChapter: ChapterStat[];
}

export function chapterStat(chapter: Chapter): ChapterStat {
  return {
    id: chapter.id,
    order: chapter.order,
    title: chapter.title,
    words: countWords(chapter.body),
    chars: countChars(chapter.body),
  };
}

export function projectStat(project: Project): ProjectStat {
  const perChapter = [...project.chapters]
    .sort((a, b) => a.order - b.order)
    .map(chapterStat);
  const totalWords = perChapter.reduce((sum, c) => sum + c.words, 0);
  const totalChars = perChapter.reduce((sum, c) => sum + c.chars, 0);
  return {
    chapters: perChapter.length,
    totalWords,
    totalChars,
    averageWords: perChapter.length ? Math.round((totalWords / perChapter.length) * 10) / 10 : 0,
    perChapter,
  };
}
