import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** 一条对话消息。`reasoning` 是「深度思考」模型的思考过程。 */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  /** 这条回复是针对哪一章生成的（用于「插入正文」） */
  chapterId?: string;
  createdAt?: number;
}

/** 一段对话 */
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatTurn[];
}

/** 列表里用的精简信息 */
export interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: number;
  count: number;
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,40}$/i;

export function newConversationId(now = Date.now()): string {
  return `c${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** 对话存在书架目录下的 .hlw/chats/<书>/ 里，不进书架扫描 */
export function chatsRoot(booksDir: string): string {
  return join(booksDir, '.hlw', 'chats');
}

function bookDir(booksDir: string, bookFile: string): string {
  return join(chatsRoot(booksDir), encodeURIComponent(bookFile));
}

function conversationPath(booksDir: string, bookFile: string, id: string): string {
  if (!ID_PATTERN.test(id)) throw new Error(`对话 id 不合法：${id}`);
  return join(bookDir(booksDir, bookFile), `${id}.json`);
}

function normalize(raw: unknown): Conversation | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) return null;
  const messages: ChatTurn[] = Array.isArray(value.messages)
    ? value.messages
        .filter(
          (m): m is ChatTurn =>
            typeof m === 'object' &&
            m !== null &&
            ((m as ChatTurn).role === 'user' || (m as ChatTurn).role === 'assistant') &&
            typeof (m as ChatTurn).content === 'string',
        )
        .map((m) => ({
          role: m.role,
          content: m.content,
          ...(typeof m.reasoning === 'string' && m.reasoning ? { reasoning: m.reasoning } : {}),
          ...(typeof m.chapterId === 'string' ? { chapterId: m.chapterId } : {}),
        }))
    : [];
  return {
    id: value.id,
    title: typeof value.title === 'string' && value.title.trim() ? value.title : '新对话',
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
    messages,
  };
}

export async function listConversations(
  booksDir: string,
  bookFile: string,
): Promise<ConversationMeta[]> {
  const dir = bookDir(booksDir, bookFile);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const out: ConversationMeta[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    try {
      const parsed = normalize(JSON.parse(await readFile(join(dir, entry), 'utf8')));
      if (!parsed) continue;
      out.push({
        id: parsed.id,
        title: parsed.title,
        updatedAt: parsed.updatedAt,
        count: parsed.messages.length,
      });
    } catch {
      // 坏文件跳过
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id));
}

export async function getConversation(
  booksDir: string,
  bookFile: string,
  id: string,
): Promise<Conversation | null> {
  try {
    const text = await readFile(conversationPath(booksDir, bookFile, id), 'utf8');
    return normalize(JSON.parse(text));
  } catch {
    return null;
  }
}

export async function saveConversation(
  booksDir: string,
  bookFile: string,
  conversation: Conversation,
): Promise<Conversation> {
  const dir = bookDir(booksDir, bookFile);
  await mkdir(dir, { recursive: true });
  const saved: Conversation = {
    ...conversation,
    updatedAt: Date.now(),
    title: conversation.title.trim() || '新对话',
  };
  await writeFile(
    conversationPath(booksDir, bookFile, saved.id),
    `${JSON.stringify(saved, null, 2)}\n`,
    'utf8',
  );
  return saved;
}

export async function deleteConversation(
  booksDir: string,
  bookFile: string,
  id: string,
): Promise<boolean> {
  try {
    await rm(conversationPath(booksDir, bookFile, id));
    return true;
  } catch {
    return false;
  }
}

/** 用第一条用户消息自动起标题 */
export function titleFromMessages(messages: ChatTurn[]): string {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return '新对话';
  const text = first.content.replace(/\s+/g, ' ').trim();
  return text.length > 18 ? `${text.slice(0, 18)}…` : text || '新对话';
}
