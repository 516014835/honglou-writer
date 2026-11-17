import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadProject,
  ProjectFileError,
  parseProject,
  saveProject,
  serializeProject,
} from '../src/io.js';
import { addChapter, createProject } from '../src/project.js';

describe('parseProject', () => {
  it('接受合法结构', () => {
    const project = createProject('红楼梦');
    expect(parseProject(JSON.stringify(project)).name).toBe('红楼梦');
  });

  it('坏 JSON 报错', () => {
    expect(() => parseProject('{oops')).toThrow(ProjectFileError);
  });

  it('缺字段报错', () => {
    expect(() => parseProject(JSON.stringify({ name: 'x' }))).toThrow(/version/);
  });

  it('版本不对报错', () => {
    const bad = { ...createProject('t'), version: 2 };
    expect(() => parseProject(JSON.stringify(bad))).toThrow(/version/);
  });

  it('章字段类型不对报错', () => {
    const bad = {
      ...createProject('t'),
      chapters: [{ id: 'ch-001', order: '1', title: 'a', body: '' }],
    };
    expect(() => parseProject(JSON.stringify(bad))).toThrow(/order/);
  });
});

describe('loadProject / saveProject', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hlw-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('存取往返后内容一致', async () => {
    const file = join(dir, 'book.json');
    const project = createProject('红楼梦', '曹雪芹');
    addChapter(project, { title: '甄士隐梦幻识通灵', body: '此开卷第一回也。' });

    await saveProject(file, project);
    const loaded = await loadProject(file);

    expect(loaded.name).toBe('红楼梦');
    expect(loaded.author).toBe('曹雪芹');
    expect(loaded.chapters[0]?.title).toBe('甄士隐梦幻识通灵');
  });

  it('文件不存在时报人话', async () => {
    await expect(loadProject(join(dir, 'nope.json'))).rejects.toThrow(/找不到文件/);
  });

  it('序列化按章序输出并以换行结尾', () => {
    const project = createProject('t');
    addChapter(project, { title: '二', body: '', order: 2 });
    addChapter(project, { title: '一', body: '', order: 1 });

    const text = serializeProject(project);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.indexOf('"一"')).toBeLessThan(text.indexOf('"二"'));
    expect(JSON.parse(text).chapters).toHaveLength(2);
  });
});
