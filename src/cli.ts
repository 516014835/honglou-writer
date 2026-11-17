#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { checkProject, formatDiagnostics, hasErrors } from './check.js';
import {
  addChapter,
  addCharacter,
  findChapter,
  openForeshadows,
  payForeshadow,
  plantForeshadow,
  PROJECT_VERSION,
} from './project.js';
import { loadProject, ProjectFileError, saveProject } from './io.js';
import { projectStat } from './stats.js';
import { startServer } from './server.js';
import type { Chapter, Project } from './types.js';

const USAGE = `hlw — 写作辅助（honglou-writer）

用法：
  hlw <命令> <作品文件.json> [选项]

读写命令：
  init          新建一个空作品文件（--name 书名 --author 作者）
  add           追加一章（--title 回目 [--body 正文 | --body-file 文件]）
  char          加人物卡（--name 正名 [--alias 别名，可多次] [--role 身份] [--debut 首出场章]）
  plant         埋伏笔（--title 名称 --at 章号或章 id）
  pay           回收伏笔（--id 伏笔 id --at 章号或章 id）

检查命令：
  check         全书体检：重复 id、断链引用、未回收伏笔……
  stats         字数统计（全书 + 逐章）
  chars         人物表
  open          还没回收的伏笔

手机使用：
  serve         开一个网页界面，手机连同一 Wi-Fi 就能用
                （--port 端口，默认 4321；--host 监听地址，默认 0.0.0.0）

选项：
  --json        输出机器可读的 JSON
  -h, --help    显示帮助

示例：
  hlw init 红楼梦.json --name 红楼梦 --author 曹雪芹
  hlw add 红楼梦.json --title "甄士隐梦幻识通灵" --body-file 第一回.txt
  hlw char 红楼梦.json --name 林黛玉 --alias 颦儿 --role 贾母外孙女 --debut 3
  hlw plant 红楼梦.json --title 通灵宝玉 --at 1
  hlw pay 红楼梦.json --id fs-001 --at 120
  hlw check 红楼梦.json
  hlw serve 红楼梦.json --port 4321
`;

interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
}

/** 中日韩字符按 2 列宽估算，够终端对齐用 */
function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += /[\u3400-\u9FFF\uF900-\uFAFF\uFF01-\uFF60]/.test(ch) ? 2 : 1;
  return width;
}

function table(rows: string[][]): string {
  if (rows.length === 0) return '';
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => displayWidth(r[i] ?? ''))));
  return rows
    .map((r) =>
      r
        .map((cell, i) => cell + ' '.repeat(Math.max(0, (widths[i] ?? 0) - displayWidth(cell))))
        .join('  ')
        .trimEnd(),
    )
    .join('\n');
}

/** 章参数既可以是序号（3）也可以是 id（ch-003） */
function resolveChapter(project: Project, ref: string): Chapter | undefined {
  return /^\d+$/.test(ref) ? findChapter(project, Number(ref)) : findChapter(project, ref);
}

function requireFile(file: string | undefined, io: Io): string | undefined {
  if (!file) io.err('请给出作品文件路径，例如：hlw check 红楼梦.json');
  return file;
}

async function cmdInit(file: string | undefined, flags: Record<string, string | undefined>, io: Io) {
  const target = requireFile(file, io);
  if (!target) return 2;
  const project: Project = {
    name: flags.name ?? target.replace(/\.json$/i, ''),
    ...(flags.author ? { author: flags.author } : {}),
    version: PROJECT_VERSION,
    chapters: [],
    characters: [],
    timeline: [],
    foreshadows: [],
  };
  await saveProject(target, project);
  io.out(`已创建 ${target}（${project.name}）`);
  return 0;
}

async function cmdAdd(file: string | undefined, flags: Record<string, string | undefined>, io: Io) {
  const target = requireFile(file, io);
  if (!target) return 2;
  if (!flags.title) {
    io.err('请用 --title 给出回目');
    return 2;
  }
  const body = flags['body-file'] ? await readFile(flags['body-file'], 'utf8') : (flags.body ?? '');
  const project = await loadProject(target);
  const chapter = addChapter(project, { title: flags.title, body });
  await saveProject(target, project);
  io.out(`已添加第 ${chapter.order} 回「${chapter.title}」（${chapter.id}，${body.length} 字符）`);
  return 0;
}

async function cmdChar(file: string | undefined, flags: Record<string, string | undefined>, aliases: string[], io: Io) {
  const target = requireFile(file, io);
  if (!target) return 2;
  if (!flags.name) {
    io.err('请用 --name 给出人物正名');
    return 2;
  }
  const project = await loadProject(target);
  let debut: string | undefined;
  if (flags.debut) {
    const chapter = resolveChapter(project, flags.debut);
    if (!chapter) {
      io.err(`找不到首出场章：${flags.debut}`);
      return 1;
    }
    debut = chapter.id;
  }
  const card = addCharacter(project, {
    name: flags.name,
    ...(aliases.length > 0 ? { aliases } : {}),
    ...(flags.role ? { role: flags.role } : {}),
    ...(debut ? { firstChapterId: debut } : {}),
  });
  await saveProject(target, project);
  io.out(`已添加人物「${card.name}」（${card.id}）`);
  return 0;
}

async function cmdPlant(file: string | undefined, flags: Record<string, string | undefined>, io: Io) {
  const target = requireFile(file, io);
  if (!target) return 2;
  if (!flags.title || !flags.at) {
    io.err('请用 --title 给出伏笔名称、--at 给出埋设章');
    return 2;
  }
  const project = await loadProject(target);
  const chapter = resolveChapter(project, flags.at);
  if (!chapter) {
    io.err(`找不到章：${flags.at}`);
    return 1;
  }
  const item = plantForeshadow(project, { title: flags.title, plantedChapterId: chapter.id });
  await saveProject(target, project);
  io.out(`已埋下伏笔「${item.title}」（${item.id}，第 ${chapter.order} 章）`);
  return 0;
}

async function cmdPay(file: string | undefined, flags: Record<string, string | undefined>, io: Io) {
  const target = requireFile(file, io);
  if (!target) return 2;
  if (!flags.id || !flags.at) {
    io.err('请用 --id 给出伏笔 id、--at 给出回收章');
    return 2;
  }
  const project = await loadProject(target);
  const chapter = resolveChapter(project, flags.at);
  if (!chapter) {
    io.err(`找不到章：${flags.at}`);
    return 1;
  }
  const item = payForeshadow(project, flags.id, chapter.id);
  if (!item) {
    io.err(`找不到伏笔：${flags.id}`);
    return 1;
  }
  await saveProject(target, project);
  io.out(`已回收伏笔「${item.title}」（第 ${chapter.order} 章）`);
  return 0;
}

async function cmdServe(
  file: string | undefined,
  flags: Record<string, string | undefined>,
  io: Io,
): Promise<number> {
  const target = requireFile(file, io);
  if (!target) return 2;
  const port = flags.port ? Number(flags.port) : 4321;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    io.err(`端口不对：${String(flags.port)}`);
    return 2;
  }
  const server = await startServer({
    file: target,
    port,
    ...(flags.host ? { host: flags.host } : {}),
  });

  io.out(`「${target}」已开成网页：`);
  io.out('');
  for (const [index, url] of server.urls.entries()) {
    io.out(`  ${index === 0 ? '本机  ' : '手机  '} ${url}`);
  }
  io.out('');
  io.out('手机连同一个 Wi-Fi，浏览器打开上面的「手机」地址即可。');
  io.out('数据仍然写在你电脑上这个 json 文件里。按 Ctrl+C 停止。');

  return await new Promise<number>((resolve) => {
    const stop = () => {
      void server.close().then(() => resolve(0));
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}

async function cmdCheck(file: string | undefined, json: boolean, io: Io) {  const target = requireFile(file, io);
  if (!target) return 2;
  const project = await loadProject(target);
  const diagnostics = checkProject(project);
  if (json) {
    io.out(JSON.stringify({ ok: !hasErrors(diagnostics), diagnostics }, null, 2));
  } else {
    io.out(formatDiagnostics(diagnostics));
    const errors = diagnostics.filter((d) => d.level === 'error').length;
    const warnings = diagnostics.filter((d) => d.level === 'warning').length;
    io.out(`\n共 ${diagnostics.length} 条：${errors} 个错误，${warnings} 个警告`);
  }
  return hasErrors(diagnostics) ? 1 : 0;
}

async function cmdStats(file: string | undefined, json: boolean, io: Io) {
  const target = requireFile(file, io);
  if (!target) return 2;
  const project = await loadProject(target);
  const stat = projectStat(project);
  if (json) {
    io.out(JSON.stringify(stat, null, 2));
    return 0;
  }
  io.out(`${project.name}：${stat.chapters} 章，共 ${stat.totalWords} 字，平均每章 ${stat.averageWords} 字`);
  if (stat.perChapter.length > 0) {
    io.out(
      table([
        ['章', '回目', '字数'],
        ...stat.perChapter.map((c) => [String(c.order), c.title || '（无回目）', String(c.words)]),
      ]),
    );
  }
  return 0;
}

async function cmdChars(file: string | undefined, json: boolean, io: Io) {
  const target = requireFile(file, io);
  if (!target) return 2;
  const project = await loadProject(target);
  if (json) {
    io.out(JSON.stringify(project.characters, null, 2));
    return 0;
  }
  if (project.characters.length === 0) {
    io.out('还没有人物卡。');
    return 0;
  }
  io.out(
    table([
      ['id', '正名', '别名', '身份', '首出场'],
      ...project.characters.map((c) => [
        c.id,
        c.name,
        (c.aliases ?? []).join('、'),
        c.role ?? '',
        c.firstChapterId ?? '—',
      ]),
    ]),
  );
  return 0;
}

async function cmdOpen(file: string | undefined, json: boolean, io: Io) {
  const target = requireFile(file, io);
  if (!target) return 2;
  const project = await loadProject(target);
  const items = openForeshadows(project).map((f) => {
    const chapter = project.chapters.find((c) => c.id === f.plantedChapterId);
    return { ...f, plantedOrder: chapter?.order ?? null, plantedTitle: chapter?.title ?? '' };
  });
  if (json) {
    io.out(JSON.stringify(items, null, 2));
    return 0;
  }
  if (items.length === 0) {
    io.out('没有未回收的伏笔。');
    return 0;
  }
  io.out(
    table([
      ['id', '伏笔', '埋在第几章'],
      ...items.map((f) => [f.id, f.title, f.plantedOrder ? String(f.plantedOrder) : f.plantedChapterId]),
    ]),
  );
  return 0;
}

export async function main(argv: string[]): Promise<number> {
  const io: Io = {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  };

  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      name: { type: 'string' },
      author: { type: 'string' },
      title: { type: 'string' },
      body: { type: 'string' },
      'body-file': { type: 'string' },
      alias: { type: 'string', multiple: true },
      role: { type: 'string' },
      debut: { type: 'string' },
      at: { type: 'string' },
      id: { type: 'string' },
      port: { type: 'string' },
      host: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help || positionals.length === 0) {
    io.out(USAGE);
    return values.help ? 0 : 2;
  }

  const command = positionals[0]!;
  const file = positionals[1];
  const flags: Record<string, string | undefined> = {
    name: values.name,
    author: values.author,
    title: values.title,
    body: values.body,
    'body-file': values['body-file'],
    role: values.role,
    debut: values.debut,
    at: values.at,
    id: values.id,
    port: values.port,
    host: values.host,
  };
  const json = values.json ?? false;

  try {
    switch (command) {
      case 'init':
        return await cmdInit(file, flags, io);
      case 'add':
        return await cmdAdd(file, flags, io);
      case 'char':
        return await cmdChar(file, flags, values.alias ?? [], io);
      case 'plant':
        return await cmdPlant(file, flags, io);
      case 'pay':
        return await cmdPay(file, flags, io);
      case 'check':
        return await cmdCheck(file, json, io);
      case 'stats':
        return await cmdStats(file, json, io);
      case 'chars':
        return await cmdChars(file, json, io);
      case 'open':
        return await cmdOpen(file, json, io);
      case 'serve':
        return await cmdServe(file, flags, io);
      default:
        io.err(`未知命令：${command}\n`);
        io.out(USAGE);
        return 2;
    }
  } catch (error) {
    if (error instanceof ProjectFileError) {
      io.err(`✖ ${error.message}`);
      return 1;
    }
    io.err(`✖ ${(error as Error).message}`);
    return 1;
  }
}

const scriptName = process.argv[1]?.replace(/\\/g, '/').split('/').pop() ?? '';
if (scriptName && import.meta.url.endsWith(scriptName)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`✖ ${(error as Error).message}\n`);
      process.exitCode = 1;
    },
  );
}
