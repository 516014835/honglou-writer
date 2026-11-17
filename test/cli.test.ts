import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';
import { loadProject } from '../src/io.js';

describe('cli', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hlw-cli-'));
    file = join(dir, 'book.json');
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('init 建出空作品', async () => {
    expect(await main(['init', file, '--name', '红楼梦', '--author', '曹雪芹'])).toBe(0);
    const project = await loadProject(file);
    expect(project).toMatchObject({ name: '红楼梦', author: '曹雪芹' });
  });

  it('add 追加章节', async () => {
    await main(['init', file, '--name', 't']);
    expect(await main(['add', file, '--title', '第一回', '--body', '满纸荒唐言'])).toBe(0);

    const project = await loadProject(file);
    expect(project.chapters).toHaveLength(1);
    expect(project.chapters[0]?.title).toBe('第一回');
  });

  it('add 缺回目时报用法错误', async () => {
    await main(['init', file]);
    expect(await main(['add', file, '--body', 'x'])).toBe(2);
  });

  it('char 用章序号指定首出场章', async () => {
    await main(['init', file]);
    await main(['add', file, '--title', '第一回', '--body', 'x']);
    await main(['char', file, '--name', '林黛玉', '--alias', '颦儿', '--alias', '林妹妹', '--debut', '1']);

    const project = await loadProject(file);
    expect(project.characters[0]).toMatchObject({
      name: '林黛玉',
      aliases: ['颦儿', '林妹妹'],
      firstChapterId: 'ch-001',
    });
  });

  it('plant 与 pay 走完整流程', async () => {
    await main(['init', file]);
    await main(['add', file, '--title', '一', '--body', 'x']);
    await main(['add', file, '--title', '二', '--body', 'y']);

    expect(await main(['plant', file, '--title', '通灵宝玉', '--at', '1'])).toBe(0);
    let project = await loadProject(file);
    const id = project.foreshadows[0]!.id;
    expect(project.foreshadows[0]).toMatchObject({ status: 'open', plantedChapterId: 'ch-001' });

    expect(await main(['pay', file, '--id', id, '--at', '2'])).toBe(0);
    project = await loadProject(file);
    expect(project.foreshadows[0]).toMatchObject({ status: 'paid', payoffChapterId: 'ch-002' });
  });

  it('pay 找不到伏笔时返回非零', async () => {
    await main(['init', file]);
    await main(['add', file, '--title', '一', '--body', 'x']);
    expect(await main(['pay', file, '--id', 'fs-404', '--at', '1'])).toBe(1);
  });

  it('check 在有问题时返回 1', async () => {
    await main(['init', file]);
    await main(['add', file, '--title', '一', '--body', 'x']);
    await main(['plant', file, '--title', '未回收', '--at', '1']);

    // 只有 warning，不算错
    expect(await main(['check', file])).toBe(0);

    const project = await loadProject(file);
    project.foreshadows[0]!.plantedChapterId = 'ch-404';
    const { saveProject } = await import('../src/io.js');
    await saveProject(file, project);

    expect(await main(['check', file])).toBe(1);
  });

  it('stats / chars / open 在空书上也能跑', async () => {
    await main(['init', file]);
    expect(await main(['stats', file])).toBe(0);
    expect(await main(['chars', file])).toBe(0);
    expect(await main(['open', file])).toBe(0);
  });

  it('未知命令返回 2', async () => {
    expect(await main(['nope', file])).toBe(2);
  });

  it('读不到文件时返回 1', async () => {
    expect(await main(['check', join(dir, 'missing.json')])).toBe(1);
  });
});
