import { readFile, writeFile } from 'node:fs/promises';
import { PROJECT_VERSION } from './project.js';
import type { Project } from './types.js';

/** 文件读取或格式不对时抛出 */
export class ProjectFileError extends Error {
  override readonly name = 'ProjectFileError';
}

function fail(message: string): never {
  throw new ProjectFileError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * 把任意 JSON 解析成 Project，形状不对就抛 `ProjectFileError`。
 * 只校验结构，不校验业务一致性（那是 `checkProject` 的事）。
 */
export function parseProject(text: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    fail(`不是合法的 JSON：${(error as Error).message}`);
  }
  if (!isRecord(raw)) fail('顶层必须是一个对象');

  if (typeof raw.name !== 'string' || !raw.name.trim()) fail('缺少 name 字段');
  if (raw.version !== PROJECT_VERSION) {
    fail(`version 必须是 ${PROJECT_VERSION}，实际是 ${String(raw.version)}`);
  }
  for (const key of ['chapters', 'characters', 'timeline', 'foreshadows'] as const) {
    if (!isArray(raw[key])) fail(`缺少 ${key} 数组`);
  }

  const chapters = raw.chapters as unknown[];
  chapters.forEach((item, i) => {
    if (!isRecord(item)) fail(`chapters[${i}] 必须是对象`);
    if (typeof item.id !== 'string') fail(`chapters[${i}].id 必须是字符串`);
    if (typeof item.order !== 'number') fail(`chapters[${i}].order 必须是数字`);
    if (typeof item.title !== 'string') fail(`chapters[${i}].title 必须是字符串`);
    if (typeof item.body !== 'string') fail(`chapters[${i}].body 必须是字符串`);
  });

  const characters = raw.characters as unknown[];
  characters.forEach((item, i) => {
    if (!isRecord(item)) fail(`characters[${i}] 必须是对象`);
    if (typeof item.id !== 'string') fail(`characters[${i}].id 必须是字符串`);
    if (typeof item.name !== 'string') fail(`characters[${i}].name 必须是字符串`);
  });

  const timeline = raw.timeline as unknown[];
  timeline.forEach((item, i) => {
    if (!isRecord(item)) fail(`timeline[${i}] 必须是对象`);
    if (typeof item.id !== 'string') fail(`timeline[${i}].id 必须是字符串`);
    if (typeof item.chapterId !== 'string') fail(`timeline[${i}].chapterId 必须是字符串`);
    if (typeof item.order !== 'number') fail(`timeline[${i}].order 必须是数字`);
    if (typeof item.title !== 'string') fail(`timeline[${i}].title 必须是字符串`);
  });

  const foreshadows = raw.foreshadows as unknown[];
  foreshadows.forEach((item, i) => {
    if (!isRecord(item)) fail(`foreshadows[${i}] 必须是对象`);
    if (typeof item.id !== 'string') fail(`foreshadows[${i}].id 必须是字符串`);
    if (typeof item.title !== 'string') fail(`foreshadows[${i}].title 必须是字符串`);
    if (typeof item.plantedChapterId !== 'string') {
      fail(`foreshadows[${i}].plantedChapterId 必须是字符串`);
    }
    if (!['open', 'paid', 'dropped'].includes(String(item.status))) {
      fail(`foreshadows[${i}].status 必须是 open/paid/dropped`);
    }
  });

  return raw as unknown as Project;
}

/** 读一个作品文件 */
export async function loadProject(path: string): Promise<Project> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') fail(`找不到文件：${path}`);
    fail(`读取失败：${(error as Error).message}`);
  }
  return parseProject(text);
}

/** 序列化成稳定的 JSON 文本（两空格缩进，末尾换行） */
export function serializeProject(project: Project): string {
  const ordered: Project = {
    name: project.name,
    ...(project.author ? { author: project.author } : {}),
    version: PROJECT_VERSION,
    chapters: [...project.chapters].sort((a, b) => a.order - b.order),
    characters: project.characters,
    timeline: [...project.timeline].sort((a, b) => a.order - b.order),
    foreshadows: project.foreshadows,
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/** 写回作品文件 */
export async function saveProject(path: string, project: Project): Promise<void> {
  await writeFile(path, serializeProject(project), 'utf8');
}
