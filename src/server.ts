import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { readdir } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { checkProject } from './check.js';
import {
  AiError,
  buildContinuePrompt,
  buildSystemPrompt,
  loadAiConfig,
  publicAiConfig,
  requestCompletion,
  saveAiConfig,
} from './ai.js';
import { loadProject, ProjectFileError, saveProject } from './io.js';
import { addChapter, addCharacter, createProject, findChapter, payForeshadow, plantForeshadow } from './project.js';
import { projectStat } from './stats.js';
import type { Chapter, Project } from './types.js';
import { renderApp } from './ui.js';

export interface ServeOptions {
  /** 只开这一本书（可选） */
  file?: string;
  /** 书架目录，默认取 file 所在目录，否则当前目录 */
  dir?: string;
  /** 端口，0 表示随机（测试用） */
  port?: number;
  /** 监听地址，默认 0.0.0.0 让同一 Wi-Fi 的手机也能连 */
  host?: string;
}

export interface RunningServer {
  port: number;
  /** 可访问的地址列表，第一项是本机，其余是局域网 */
  urls: string[];
  /** 书架目录 */
  dir: string;
  close: () => Promise<void>;
}

/** 书架里的一本书 */
export interface BookSummary {
  file: string;
  name: string;
  author?: string;
  chapters: number;
  words: number;
  foreshadowsOpen: number;
}

const MAX_BODY = 8 * 1024 * 1024;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function html(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY) throw new HttpError(413, '提交的内容太大了');
    chunks.push(buf);
  }
  if (size === 0) return {};
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new HttpError(400, '请求体必须是对象');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, '请求体不是合法 JSON');
  }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** 章参数既可以是序号（3）也可以是 id（ch-003） */
function resolveChapter(project: Project, ref: string): Chapter | undefined {
  const trimmed = ref.trim();
  if (!trimmed) return undefined;
  return /^\d+$/.test(trimmed) ? findChapter(project, Number(trimmed)) : findChapter(project, trimmed);
}

/** 列出本机的局域网 IPv4 地址 */
export function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

/** 把书名变成安全的文件名 */
export function bookFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 40);
  return `${cleaned || '未命名'}.json`;
}

/**
 * 启动手机/局域网可访问的写作界面。
 *
 * 目录里的每个 `.json` 都是一本书，网页上可以在书架里切换、新建。
 */
export async function startServer(options: ServeOptions): Promise<RunningServer> {
  const booksDir = resolve(
    options.dir ?? (options.file ? dirname(resolve(options.file)) : process.cwd()),
  );
  const defaultBook = options.file ? basename(resolve(options.file)) : undefined;
  const port = options.port ?? 4321;
  const host = options.host ?? '0.0.0.0';

  const cache = new Map<string, Project>();

  /** 把文件名收敛到书架目录内，防止 ../ 穿越 */
  function resolveBookFile(name: string | null): string {
    const target = (name ?? defaultBook ?? '').trim();
    if (!target) throw new HttpError(400, '没指定是哪本书');
    const abs = resolve(booksDir, target);
    if (dirname(abs) !== booksDir || extname(abs).toLowerCase() !== '.json') {
      throw new HttpError(400, `书的名字不对：${target}`);
    }
    return basename(abs);
  }

  async function getBook(file: string): Promise<Project> {
    const cached = cache.get(file);
    if (cached) return cached;
    try {
      const loaded = await loadProject(join(booksDir, file));
      cache.set(file, loaded);
      return loaded;
    } catch (error) {
      if (error instanceof ProjectFileError) throw new HttpError(400, error.message);
      throw new HttpError(500, (error as Error).message);
    }
  }

  async function listBooks(): Promise<BookSummary[]> {
    let entries: string[];
    try {
      entries = await readdir(booksDir);
    } catch {
      throw new HttpError(500, `读不了书架目录：${booksDir}`);
    }
    const books: BookSummary[] = [];
    for (const entry of entries) {
      if (extname(entry).toLowerCase() !== '.json') continue;
      try {
        const project = await getBook(entry);
        const stat = projectStat(project);
        books.push({
          file: entry,
          name: project.name,
          ...(project.author ? { author: project.author } : {}),
          chapters: stat.chapters,
          words: stat.totalWords,
          foreshadowsOpen: project.foreshadows.filter((f) => f.status === 'open').length,
        });
      } catch {
        // 不是作品文件的 json 直接跳过（比如配置文件）
      }
    }
    books.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    return books;
  }

  const server: Server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      if (error instanceof HttpError) {
        json(res, error.status, { error: error.message });
        return;
      }
      json(res, 500, { error: (error as Error).message });
    });
  });

  /** 把上游模型的 SSE 原样转给浏览器；浏览器断开时顺手中断上游 */
  async function streamChat(
    req: IncomingMessage,
    res: ServerResponse,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  ): Promise<void> {
    const config = await loadAiConfig();
    if (!config.apiKey) throw new HttpError(400, '还没配置 API Key');

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    let upstream: Response;
    try {
      upstream = await requestCompletion(config, messages, { signal: controller.signal });
    } catch (error) {
      if (error instanceof AiError) throw new HttpError(502, error.message);
      throw error;
    }

    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });

    const body = upstream.body;
    if (!body) {
      res.end();
      return;
    }
    const reader = body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
    } catch {
      // 客户端断开或上游中断，直接收尾
    }
    res.end();
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const method = req.method ?? 'GET';
    const bookParam = url.searchParams.get('book');

    if (method === 'GET' && (path === '/' || path === '/index.html')) {
      html(res, 200, renderApp('书架'));
      return;
    }

    if (method === 'GET' && path === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }

    if (method === 'GET' && path === '/api/books') {
      json(res, 200, { dir: booksDir, books: await listBooks() });
      return;
    }

    if (method === 'POST' && path === '/api/books') {
      const body = await readJson(req);
      const name = str(body.name).trim() || '未命名';
      const author = str(body.author).trim();
      const file = bookFileName(name);
      const abs = join(booksDir, file);
      if (dirname(abs) !== booksDir) throw new HttpError(400, '书名不合法');

      let exists = true;
      try {
        await loadProject(abs);
      } catch {
        exists = false;
      }
      if (exists) throw new HttpError(409, `已经有叫「${name}」的书了`);

      const project = createProject(name, author || undefined);
      await saveProject(abs, project);
      cache.set(file, project);
      json(res, 201, { file, name: project.name });
      return;
    }

    const file = resolveBookFile(bookParam);
    const project = await getBook(file);
    const persist = () => saveProject(join(booksDir, file), project);

    if (method === 'GET' && path === '/api/project') {
      json(res, 200, {
        file,
        project,
        stats: projectStat(project),
        diagnostics: checkProject(project),
      });
      return;
    }

    if (method === 'POST' && path === '/api/chapter') {
      const body = await readJson(req);
      const title = str(body.title).trim();
      const text = str(body.body);
      if (!title && !text) throw new HttpError(400, '回目和正文至少写一样');
      const chapter = addChapter(project, { title, body: text });
      await persist();
      json(res, 201, { chapter });
      return;
    }

    const chapterMatch = /^\/api\/chapter\/([^/]+)$/.exec(path);
    if (chapterMatch) {
      const id = decodeURIComponent(chapterMatch[1]!);
      const chapter = findChapter(project, id);
      if (!chapter) throw new HttpError(404, `找不到章：${id}`);

      if (method === 'PUT') {
        const body = await readJson(req);
        if (typeof body.title === 'string') chapter.title = body.title;
        if (typeof body.body === 'string') chapter.body = body.body;
        if (body.status === 'draft' || body.status === 'revised' || body.status === 'done') {
          chapter.status = body.status;
        }
        await persist();
        json(res, 200, { chapter });
        return;
      }

      if (method === 'DELETE') {
        const index = project.chapters.indexOf(chapter);
        project.chapters.splice(index, 1);
        await persist();
        json(res, 200, { ok: true });
        return;
      }
    }

    if (method === 'POST' && path === '/api/character') {
      const body = await readJson(req);
      const name = str(body.name).trim();
      if (!name) throw new HttpError(400, '人物正名不能为空');
      const aliases = Array.isArray(body.aliases)
        ? body.aliases.filter((a): a is string => typeof a === 'string' && a.trim() !== '')
        : [];
      const role = str(body.role).trim();
      const debutRaw = str(body.debut).trim();
      let firstChapterId: string | undefined;
      if (debutRaw) {
        const chapter = resolveChapter(project, debutRaw);
        if (!chapter) throw new HttpError(400, `找不到章：${debutRaw}`);
        firstChapterId = chapter.id;
      }
      const card = addCharacter(project, {
        name,
        ...(aliases.length ? { aliases } : {}),
        ...(role ? { role } : {}),
        ...(firstChapterId ? { firstChapterId } : {}),
      });
      await persist();
      json(res, 201, { character: card });
      return;
    }

    if (method === 'POST' && path === '/api/foreshadow') {
      const body = await readJson(req);
      const title = str(body.title).trim();
      const at = str(body.at).trim();
      if (!title) throw new HttpError(400, '伏笔名称不能为空');
      const chapter = resolveChapter(project, at);
      if (!chapter) throw new HttpError(400, `找不到章：${at}`);
      const item = plantForeshadow(project, { title, plantedChapterId: chapter.id });
      await persist();
      json(res, 201, { foreshadow: item });
      return;
    }

    if (method === 'POST' && path === '/api/pay') {
      const body = await readJson(req);
      const id = str(body.id).trim();
      const at = str(body.at).trim();
      const chapter = resolveChapter(project, at);
      if (!chapter) throw new HttpError(400, `找不到章：${at}`);
      const item = payForeshadow(project, id, chapter.id);
      if (!item) throw new HttpError(404, `找不到伏笔：${id}`);
      await persist();
      json(res, 200, { foreshadow: item });
      return;
    }

    if (method === 'GET' && path === '/api/ai/config') {
      json(res, 200, publicAiConfig(await loadAiConfig()));
      return;
    }

    if (method === 'POST' && path === '/api/ai/config') {
      const body = await readJson(req);
      const patch: { baseUrl?: string; model?: string; apiKey?: string } = {};
      if (typeof body.baseUrl === 'string') patch.baseUrl = body.baseUrl;
      if (typeof body.model === 'string') patch.model = body.model;
      if (typeof body.apiKey === 'string') patch.apiKey = body.apiKey;
      const saved = await saveAiConfig(patch);
      json(res, 200, publicAiConfig(saved));
      return;
    }

    if (method === 'POST' && path === '/api/ai/chat') {
      const body = await readJson(req);
      const history = Array.isArray(body.messages) ? body.messages : [];
      const chapterId = typeof body.chapterId === 'string' ? body.chapterId : undefined;
      const system = buildSystemPrompt(project, chapterId);
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: system },
        ...history
          .filter(
            (m): m is { role: 'user' | 'assistant'; content: string } =>
              typeof m === 'object' &&
              m !== null &&
              ((m as { role?: unknown }).role === 'user' ||
                (m as { role?: unknown }).role === 'assistant') &&
              typeof (m as { content?: unknown }).content === 'string',
          )
          .slice(-16)
          .map((m) => ({ role: m.role, content: m.content })),
      ];
      if (messages.length === 1) throw new HttpError(400, '没有可发送的内容');
      await streamChat(req, res, messages);
      return;
    }

    if (method === 'POST' && path === '/api/ai/continue') {
      const body = await readJson(req);
      const chapterId = typeof body.chapterId === 'string' ? body.chapterId : '';
      const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
      const chapter = chapterId ? findChapter(project, chapterId) : undefined;
      const messages = [
        { role: 'system' as const, content: buildSystemPrompt(project, chapter?.id) },
        {
          role: 'user' as const,
          content: buildContinuePrompt(chapter, instruction || undefined),
        },
      ];
      await streamChat(req, res, messages);
      return;
    }

    if (method === 'GET' && path === '/api/export') {
      const stamp = new Date().toISOString().slice(0, 10);
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${encodeURIComponent(project.name)}-${stamp}.json"`,
      });
      res.end(JSON.stringify(project, null, 2));
      return;
    }

    throw new HttpError(404, '页面不存在');
  }

  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolveListen());
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  const urls = [
    `http://127.0.0.1:${actualPort}`,
    ...lanAddresses().map((ip) => `http://${ip}:${actualPort}`),
  ];

  return {
    port: actualPort,
    urls,
    dir: booksDir,
    close: () =>
      new Promise<void>((resolveClose, reject) => {
        server.close((error) => (error ? reject(error) : resolveClose()));
      }),
  };
}
