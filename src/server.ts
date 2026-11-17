import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { checkProject } from './check.js';
import { loadProject, saveProject } from './io.js';
import { addChapter, addCharacter, findChapter, payForeshadow, plantForeshadow } from './project.js';
import { projectStat } from './stats.js';
import type { Chapter, Project } from './types.js';
import { renderApp } from './ui.js';

export interface ServeOptions {
  /** 作品文件路径 */
  file: string;
  /** 端口，0 表示随机（测试用） */
  port?: number;
  /** 监听地址，默认 0.0.0.0 让同一 Wi-Fi 的手机也能连 */
  host?: string;
}

export interface RunningServer {
  port: number;
  /** 可访问的地址列表，第一项是本机，其余是局域网 */
  urls: string[];
  close: () => Promise<void>;
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

/**
 * 启动手机/局域网可访问的写作界面。
 *
 * 数据仍然保存在你传入的那个 JSON 文件里，网页只是它的一个操作界面。
 */
export async function startServer(options: ServeOptions): Promise<RunningServer> {
  const project: Project = await loadProject(options.file);
  const port = options.port ?? 4321;
  const host = options.host ?? '0.0.0.0';

  const persist = () => saveProject(options.file, project);

  const server: Server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      if (error instanceof HttpError) {
        json(res, error.status, { error: error.message });
        return;
      }
      json(res, 500, { error: (error as Error).message });
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const method = req.method ?? 'GET';

    if (method === 'GET' && (path === '/' || path === '/index.html')) {
      html(res, 200, renderApp(project.name));
      return;
    }

    if (method === 'GET' && path === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }

    if (method === 'GET' && path === '/api/project') {
      json(res, 200, {
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

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
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
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
