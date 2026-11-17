import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteConversation,
  getConversation,
  listConversations,
  newConversationId,
  saveConversation,
  titleFromMessages,
  type Conversation,
} from '../src/chats.js';

describe('chats', () => {
  let dir: string;
  const book = '我的小说.json';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hlw-chats-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function blank(id = newConversationId()): Conversation {
    return { id, title: '新对话', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
  }

  it('保存后能读回来', async () => {
    const chat = blank();
    chat.messages.push({ role: 'user', content: '怎么写开头？' });
    await saveConversation(dir, book, chat);

    const loaded = await getConversation(dir, book, chat.id);
    expect(loaded?.messages).toHaveLength(1);
    expect(loaded?.messages[0]?.content).toBe('怎么写开头？');
  });

  it('列表按更新时间倒序', async () => {
    const a = blank('c1');
    a.title = '第一条';
    a.updatedAt = 1000;
    const b = blank('c2');
    b.title = '第二条';
    b.updatedAt = 2000;
    await saveConversation(dir, book, a);
    await saveConversation(dir, book, b);

    const list = await listConversations(dir, book);
    expect(list.map((c) => c.id)).toEqual(['c2', 'c1']);
    expect(list[0]?.title).toBe('第二条');
  });

  it('不存在的对话返回 null', async () => {
    expect(await getConversation(dir, book, 'nope1')).toBeNull();
  });

  it('删除后读不到', async () => {
    const chat = blank('c9');
    await saveConversation(dir, book, chat);
    expect(await deleteConversation(dir, book, 'c9')).toBe(true);
    expect(await getConversation(dir, book, 'c9')).toBeNull();
  });

  it('不同书之间的对话互不干扰', async () => {
    await saveConversation(dir, book, blank('c1'));
    expect(await listConversations(dir, '另一本.json')).toHaveLength(0);
  });

  it('id 不合法时拒绝写入', async () => {
    const chat = blank('../evil');
    await expect(saveConversation(dir, book, chat)).rejects.toThrow(/不合法/);
  });

  it('空标题存盘时变成「新对话」', async () => {
    const chat = blank('c3');
    chat.title = '   ';
    const saved = await saveConversation(dir, book, chat);
    expect(saved.title).toBe('新对话');
  });

  it('用第一条用户消息当标题', () => {
    expect(titleFromMessages([{ role: 'assistant', content: '你好' }, { role: 'user', content: '帮我写个开篇' }])).toBe(
      '帮我写个开篇',
    );
    expect(titleFromMessages([{ role: 'user', content: '很'.repeat(40) }])).toHaveLength(19);
    expect(titleFromMessages([])).toBe('新对话');
  });
});
