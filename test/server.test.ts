import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startServer, type RunningServer } from '../src/server.js';
import { loadProject, saveProject } from '../src/io.js';
import { addChapter, createProject } from '../src/project.js';

describe('startServer', () => {
  let dir: string;
  let file: string;
  let server: RunningServer;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hlw-http-'));
    file = join(dir, 'book.json');
    const project = createProject('红楼梦', '曹雪芹');
    addChapter(project, { title: '第一回', body: '满纸荒唐言，一把辛酸泪。' });
    await saveProject(file, project);
    server = await startServer({ file, port: 0, host: '127.0.0.1' });
  });

  afterEach(async () => {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  });

  const base = () => `http://127.0.0.1:${server.port}`;

  it('首页返回 HTML', async () => {
    const res = await fetch(base());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('书架');
    expect(body).toContain('章回');
  });

  it('/api/project 返回作品、统计与体检', async () => {
    const res = await fetch(`${base()}/api/project`);
    const data = (await res.json()) as {
      project: { name: string; chapters: unknown[] };
      stats: { chapters: number; totalWords: number };
      diagnostics: unknown[];
    };
    expect(data.project.name).toBe('红楼梦');
    expect(data.stats.chapters).toBe(1);
    expect(data.stats.totalWords).toBe(10);
    expect(Array.isArray(data.diagnostics)).toBe(true);
  });

  it('新增章节并落盘', async () => {
    const res = await fetch(`${base()}/api/chapter`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '第二回', body: '贾夫人仙逝扬州城。' }),
    });
    expect(res.status).toBe(201);

    const saved = await loadProject(file);
    expect(saved.chapters).toHaveLength(2);
    expect(saved.chapters[1]?.title).toBe('第二回');
  });

  it('回目和正文都空时报 400', async () => {
    const res = await fetch(`${base()}/api/chapter`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '', body: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('修改与删除章节', async () => {
    const id = 'ch-001';
    const put = await fetch(`${base()}/api/chapter/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: '改过的正文' }),
    });
    expect(put.status).toBe(200);
    expect((await loadProject(file)).chapters[0]?.body).toBe('改过的正文');

    const del = await fetch(`${base()}/api/chapter/${id}`, { method: 'DELETE' });
    expect(del.status).toBe(200);
    expect((await loadProject(file)).chapters).toHaveLength(0);
  });

  it('人物首次出场章支持用序号', async () => {
    const res = await fetch(`${base()}/api/character`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '林黛玉', aliases: ['颦儿'], role: '贾母外孙女', debut: '1' }),
    });
    expect(res.status).toBe(201);
    const saved = await loadProject(file);
    expect(saved.characters[0]).toMatchObject({
      name: '林黛玉',
      aliases: ['颦儿'],
      firstChapterId: 'ch-001',
    });
  });

  it('埋伏笔再回收', async () => {
    const plant = await fetch(`${base()}/api/foreshadow`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '通灵宝玉', at: '1' }),
    });
    expect(plant.status).toBe(201);
    const planted = (await plant.json()) as { foreshadow: { id: string; status: string } };
    expect(planted.foreshadow.status).toBe('open');

    const pay = await fetch(`${base()}/api/pay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: planted.foreshadow.id, at: '1' }),
    });
    expect(pay.status).toBe(200);
    expect((await loadProject(file)).foreshadows[0]?.status).toBe('paid');
  });

  it('找不到的章返回 400', async () => {
    const res = await fetch(`${base()}/api/foreshadow`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'x', at: '99' }),
    });
    expect(res.status).toBe(400);
  });

  it('未知路径返回 404，坏 JSON 返回 400', async () => {
    expect((await fetch(`${base()}/nope`)).status).toBe(404);
    const bad = await fetch(`${base()}/api/chapter`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{oops',
    });
    expect(bad.status).toBe(400);
  });

  it('导出接口返回 JSON', async () => {
    const res = await fetch(`${base()}/api/export`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect((await res.json()) as { name: string }).toMatchObject({ name: '红楼梦' });
  });

  it('书架列出目录里的书', async () => {
    const res = await fetch(`${base()}/api/books`);
    const data = (await res.json()) as { dir: string; books: Array<{ file: string; name: string }> };
    expect(data.books).toHaveLength(1);
    expect(data.books[0]?.file).toBe('book.json');
    expect(data.books[0]?.name).toBe('红楼梦');
    expect(data.dir).toBe(dir);
  });

  it('新建故事后能切换过去，两者互不影响', async () => {
    const create = await fetch(`${base()}/api/books`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '第二本', author: '我' }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { file: string };
    expect(created.file).toBe('第二本.json');

    const list = (await (await fetch(`${base()}/api/books`)).json()) as {
      books: Array<{ file: string }>;
    };
    expect(list.books).toHaveLength(2);

    await fetch(`${base()}/api/chapter?book=${encodeURIComponent(created.file)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '新故事的第一回', body: '开局' }),
    });

    const first = (await (await fetch(`${base()}/api/project?book=book.json`)).json()) as {
      project: { chapters: unknown[] };
    };
    const second = (
      await (await fetch(`${base()}/api/project?book=${encodeURIComponent(created.file)}`)).json()
    ) as { project: { chapters: Array<{ title: string }> } };

    expect(first.project.chapters).toHaveLength(1);
    expect(second.project.chapters).toHaveLength(1);
    expect(second.project.chapters[0]?.title).toBe('新故事的第一回');
  });

  it('同名书不允许重复建', async () => {
    await fetch(`${base()}/api/books`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '重名' }),
    });
    const again = await fetch(`${base()}/api/books`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '重名' }),
    });
    expect(again.status).toBe(409);
  });

  it('book 参数不允许跳出书架目录', async () => {
    const res = await fetch(`${base()}/api/project?book=${encodeURIComponent('../evil.json')}`);
    expect(res.status).toBe(400);
  });

  it('目录里的非作品 json 不算成书', async () => {
    await writeFile(join(dir, 'config.json'), '{"hello":1}', 'utf8');
    const data = (await (await fetch(`${base()}/api/books`)).json()) as {
      books: Array<{ file: string }>;
    };
    expect(data.books.map((b) => b.file)).not.toContain('config.json');
  });

  it('对话能建、能存、能列、能删', async () => {
    const created = await fetch(`${base()}/api/chats`, { method: 'POST' });
    expect(created.status).toBe(201);
    const { chat } = (await created.json()) as { chat: { id: string; title: string } };
    expect(chat.title).toBe('新对话');

    const saved = await fetch(`${base()}/api/chats/${chat.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: '帮我写个开篇' }] }),
    });
    expect(saved.status).toBe(200);
    const savedBody = (await saved.json()) as { chat: { title: string; messages: unknown[] } };
    expect(savedBody.chat.title).toBe('帮我写个开篇');
    expect(savedBody.chat.messages).toHaveLength(1);

    const list = (await (await fetch(`${base()}/api/chats`)).json()) as {
      chats: Array<{ id: string; count: number }>;
    };
    expect(list.chats).toHaveLength(1);
    expect(list.chats[0]?.count).toBe(1);

    await fetch(`${base()}/api/chats/${chat.id}`, { method: 'DELETE' });
    const after = (await (await fetch(`${base()}/api/chats`)).json()) as { chats: unknown[] };
    expect(after.chats).toHaveLength(0);
  });

  it('不存在的对话返回 404', async () => {
    const res = await fetch(`${base()}/api/chats/nosuchid`);
    expect(res.status).toBe(404);
  });
});
