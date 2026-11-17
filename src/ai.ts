import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Chapter, Project } from './types.js';

/** 大模型连接配置。走 OpenAI 兼容接口，所以 DeepSeek / Moonshot / 本地 Ollama 都能用。 */
export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const DEFAULT_AI: AiConfig = {
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKey: '',
};

/** 配置文件默认放在用户目录，跟具体哪本书无关 */
export function aiConfigPath(): string {
  return process.env.HLW_AI_CONFIG ?? join(homedir(), '.hlw-ai.json');
}

/** 读配置：文件 > 环境变量 > 默认值 */
export async function loadAiConfig(): Promise<AiConfig> {
  let raw: Partial<AiConfig> = {};
  try {
    raw = JSON.parse(await readFile(aiConfigPath(), 'utf8')) as Partial<AiConfig>;
  } catch {
    // 没有配置文件就走默认
  }
  const fromEnv = process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
  return {
    baseUrl: raw.baseUrl?.trim() || DEFAULT_AI.baseUrl,
    model: raw.model?.trim() || DEFAULT_AI.model,
    apiKey: raw.apiKey?.trim() || fromEnv,
  };
}

/** 写配置（只存本地，权限尽量收紧） */
export async function saveAiConfig(patch: Partial<AiConfig>): Promise<AiConfig> {
  const current = await loadAiConfig();
  const next: AiConfig = {
    baseUrl: (patch.baseUrl ?? current.baseUrl).trim(),
    model: (patch.model ?? current.model).trim(),
    apiKey: (patch.apiKey ?? current.apiKey).trim(),
  };
  await writeFile(aiConfigPath(), `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return next;
}

/** 只暴露给前端用的安全视图：不返回 key 本身 */
export function publicAiConfig(config: AiConfig): {
  baseUrl: string;
  model: string;
  configured: boolean;
} {
  return {
    baseUrl: config.baseUrl,
    model: config.model,
    configured: config.apiKey.length > 0,
  };
}

function tail(text: string, limit: number): string {
  const trimmed = text.trim();
  return trimmed.length <= limit ? trimmed : `…${trimmed.slice(-limit)}`;
}

/** 把这本书的设定压缩成一段提示词素材 */
export function buildBookContext(project: Project, currentChapterId?: string): string {
  const parts: string[] = [];
  const chapters = [...project.chapters].sort((a, b) => a.order - b.order);

  parts.push(`《${project.name}》${project.author ? `（作者：${project.author}）` : ''}`);

  if (chapters.length > 0) {
    const titles = chapters
      .map((c) => `第${c.order}回${c.title ? ` ${c.title}` : ''}`)
      .join('；');
    parts.push(`【章目】${titles}`);
  }

  const current = currentChapterId ? chapters.find((c) => c.id === currentChapterId) : undefined;
  if (current) {
    const text = current.body.trim();
    parts.push(
      `【当前正在写的这一章】第${current.order}回 ${current.title}\n${text ? tail(text, 1500) : '（还没写正文）'}`,
    );
  }

  const recent = chapters.filter((c) => c.body.trim() && (!current || c.order < current.order)).slice(-3);
  if (recent.length > 0) {
    parts.push(
      `【前几章的结尾】\n${recent
        .map((c) => `第${c.order}回结尾：${tail(c.body, 400)}`)
        .join('\n')}`,
    );
  }

  if (project.characters.length > 0) {
    const cards = project.characters.map((c) => {
      const alias = c.aliases?.length ? `（${c.aliases.join('、')}）` : '';
      const role = c.role ? ` ${c.role}` : '';
      return `- ${c.name}${alias}${role}`;
    });
    parts.push(`【人物】\n${cards.join('\n')}`);
  }

  if (project.foreshadows.length > 0) {
    const items = project.foreshadows.map((f) => {
      const state = f.status === 'paid' ? '已回收' : f.status === 'dropped' ? '已弃用' : '未回收';
      return `- ${f.title}（${state}）`;
    });
    parts.push(`【伏笔】\n${items.join('\n')}`);
  }

  const open = project.foreshadows.filter((f) => f.status === 'open');
  if (open.length > 0) {
    parts.push(`提醒：还有 ${open.length} 条伏笔没有回收，如果合适可以在续写里铺垫。`);
  }

  return parts.join('\n\n');
}

/** 写作助手的系统提示词 */
export function buildSystemPrompt(project: Project, currentChapterId?: string): string {
  return [
    '你是一位资深的中文小说写作助手，正在和作者一起写一本书。',
    '你是协作方，不是替代作者：你的任务是给出可直接用的正文或具体可行的建议，而不是泛泛而谈。',
    '',
    '写作要求：',
    '1. 保持与前文一致：人称、时态、语言风格、人物称呼、已发生的事实。',
    '2. 续写正文时，直接给小说正文，不要加「好的」「以下是续写」这类开场白，也不要解释你写了什么。',
    '3. 用中文，注意分寸感：不要堆砌形容词，不要用网文腔的空洞感叹。',
    '4. 除非作者要求，不要替作者做重大情节决定，可以在结尾用一个自然的悬念收住。',
    '5. 如果作者问的是情节建议，给出 2-3 个具体走向，每个一两句话说清楚怎么落地。',
    '',
    '以下是这本书目前的设定，写作时必须遵守：',
    '',
    buildBookContext(project, currentChapterId),
  ].join('\n');
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 不注入全书内容时用的轻量提示词（省 token） */
export function buildLitePrompt(project: Project): string {
  return [
    '你是一位资深的中文小说写作助手。',
    `现在在帮作者写《${project.name}》，全书 ${project.chapters.length} 章、${project.characters.length} 个人物。`,
    '回答要具体、可执行，不要泛泛而谈；涉及正文时直接给小说文字。',
  ].join('\n');
}

/** 拼出「接着写」的那条用户指令 */
export function buildContinuePrompt(chapter: Chapter | undefined, instruction?: string): string {
  const where = chapter ? `第${chapter.order}回${chapter.title ? `「${chapter.title}」` : ''}` : '这一章';
  if (!chapter || !chapter.body.trim()) {
    return [
      `请为${where}写一个开头，大约 400 字。`,
      instruction ? `额外要求：${instruction}` : '',
      '直接给正文。',
    ]
      .filter(Boolean)
      .join('\n');
  }
  return [
    `请接着${where}的正文往下写，大约 ${instruction ? '按下面要求来' : '400 字'}。`,
    '承接上文语气和节奏，不要重复已经写过的内容，不要总结。',
    instruction ? `额外要求：${instruction}` : '',
    '直接给正文。',
  ]
    .filter(Boolean)
    .join('\n');
}

export class AiError extends Error {
  override readonly name = 'AiError';
}

/**
 * 调一次流式补全，返回上游的 SSE 响应，交给调用方直接转发。
 * 出错时抛 AiError（带人话说明）。
 */
export async function requestCompletion(
  config: AiConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { maxTokens?: number; temperature?: number; signal?: AbortSignal; model?: string } = {},
): Promise<Response> {
  if (!config.apiKey) throw new AiError('还没有配置 API Key');

  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? config.model,
        messages,
        stream: true,
        temperature: options.temperature ?? 1,
        max_tokens: options.maxTokens ?? 1600,
      }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    throw new AiError(`连不上模型服务：${(error as Error).message}`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const hint =
      response.status === 401
        ? 'API Key 不对或者过期了'
        : response.status === 402
          ? '账户余额不足，去 DeepSeek 后台充点钱'
          : response.status === 429
            ? '请求太频繁，等几秒再试'
            : '模型服务返回了错误';
    throw new AiError(`${hint}（HTTP ${response.status}）${detail ? `：${detail.slice(0, 200)}` : ''}`);
  }

  return response;
}
