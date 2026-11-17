import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildBookContext,
  buildContinuePrompt,
  buildSystemPrompt,
  DEFAULT_AI,
  loadAiConfig,
  publicAiConfig,
  saveAiConfig,
} from '../src/ai.js';
import { addChapter, addCharacter, createProject, plantForeshadow } from '../src/project.js';
import type { Project } from '../src/types.js';

function sample(): { project: Project; chapterId: string } {
  const project = createProject('红楼梦', '曹雪芹');
  const first = addChapter(project, {
    title: '甄士隐梦幻识通灵',
    body: '此开卷第一回也。作者自云：因曾历过一番梦幻之后，故将真事隐去。',
  });
  addChapter(project, { title: '贾夫人仙逝扬州城', body: '诗云：一局输赢料不真。' });
  addCharacter(project, {
    name: '林黛玉',
    aliases: ['颦儿'],
    role: '贾母外孙女',
    firstChapterId: first.id,
  });
  plantForeshadow(project, { title: '通灵宝玉', plantedChapterId: first.id });
  return { project, chapterId: first.id };
}

describe('buildBookContext', () => {
  it('带上书名、章目、人物、伏笔', () => {
    const { project, chapterId } = sample();
    const text = buildBookContext(project, chapterId);

    expect(text).toContain('《红楼梦》');
    expect(text).toContain('第1回');
    expect(text).toContain('林黛玉');
    expect(text).toContain('颦儿');
    expect(text).toContain('通灵宝玉');
    expect(text).toContain('未回收');
  });

  it('提示还有几条伏笔没回收', () => {
    const { project } = sample();
    expect(buildBookContext(project)).toContain('还有 1 条伏笔没有回收');
  });

  it('空书也能用', () => {
    expect(buildBookContext(createProject('空书'))).toContain('《空书》');
  });
});

describe('buildSystemPrompt', () => {
  it('包含写作约束与书籍设定', () => {
    const { project, chapterId } = sample();
    const prompt = buildSystemPrompt(project, chapterId);
    expect(prompt).toContain('中文小说写作助手');
    expect(prompt).toContain('直接给小说正文');
    expect(prompt).toContain('通灵宝玉');
  });
});

describe('buildContinuePrompt', () => {
  it('正文为空时让它写开头', () => {
    const { project, chapterId } = sample();
    const chapter = project.chapters.find((c) => c.id === chapterId);
    if (chapter) chapter.body = '';
    const prompt = buildContinuePrompt(chapter);
    expect(prompt).toContain('开头');
    expect(prompt).toContain('直接给正文');
  });

  it('有正文时让它接着写，并带上额外要求', () => {
    const { project, chapterId } = sample();
    const chapter = project.chapters.find((c) => c.id === chapterId);
    const prompt = buildContinuePrompt(chapter, '再阴森一点');
    expect(prompt).toContain('接着');
    expect(prompt).toContain('再阴森一点');
  });
});

describe('配置读写', () => {
  let dir: string;
  const original = process.env.HLW_AI_CONFIG;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hlw-ai-'));
    process.env.HLW_AI_CONFIG = join(dir, 'config.json');
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(async () => {
    if (original === undefined) delete process.env.HLW_AI_CONFIG;
    else process.env.HLW_AI_CONFIG = original;
    await rm(dir, { recursive: true, force: true });
  });

  it('没有配置文件时用默认值', async () => {
    const config = await loadAiConfig();
    expect(config.baseUrl).toBe(DEFAULT_AI.baseUrl);
    expect(config.model).toBe(DEFAULT_AI.model);
    expect(config.apiKey).toBe('');
  });

  it('保存后能读回来', async () => {
    await saveAiConfig({ apiKey: 'sk-test', model: 'deepseek-reasoner' });
    const config = await loadAiConfig();
    expect(config.apiKey).toBe('sk-test');
    expect(config.model).toBe('deepseek-reasoner');
  });

  it('环境变量能补上 Key', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-env';
    const config = await loadAiConfig();
    expect(config.apiKey).toBe('sk-env');
  });

  it('对外的配置视图不泄露 Key', () => {
    const view = publicAiConfig({ baseUrl: 'x', model: 'm', apiKey: 'secret' });
    expect(view.configured).toBe(true);
    expect(JSON.stringify(view)).not.toContain('secret');
  });
});
