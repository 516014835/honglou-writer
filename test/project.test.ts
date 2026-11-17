import { describe, expect, it } from 'vitest';
import {
  addChapter,
  addCharacter,
  addEvent,
  createProject,
  dropForeshadow,
  findChapter,
  findCharacter,
  foreshadowsPlantedIn,
  openForeshadows,
  payForeshadow,
  plantForeshadow,
  sortedChapters,
  sortedTimeline,
} from '../src/project.js';

describe('createProject', () => {
  it('给出空作品', () => {
    const project = createProject('红楼梦', '曹雪芹');
    expect(project).toMatchObject({ name: '红楼梦', author: '曹雪芹', version: 1 });
    expect(project.chapters).toEqual([]);
    expect(project.characters).toEqual([]);
  });

  it('不传作者时不写 author 字段', () => {
    expect('author' in createProject('无作者')).toBe(false);
  });
});

describe('addChapter', () => {
  it('按顺序自动编号', () => {
    const project = createProject('t');
    const a = addChapter(project, { title: '第一回', body: '' });
    const b = addChapter(project, { title: '第二回', body: '' });
    expect(a.id).toBe('ch-001');
    expect(a.order).toBe(1);
    expect(b.id).toBe('ch-002');
    expect(b.order).toBe(2);
  });

  it('id 撞车时自动去重', () => {
    const project = createProject('t');
    addChapter(project, { id: 'x', title: 'a', body: '' });
    const second = addChapter(project, { id: 'x', title: 'b', body: '' });
    expect(second.id).toBe('x-2');
  });

  it('可以插队指定 order', () => {
    const project = createProject('t');
    addChapter(project, { title: 'a', body: '' });
    const inserted = addChapter(project, { title: 'b', body: '', order: 5 });
    expect(inserted.order).toBe(5);
    expect(sortedChapters(project).map((c) => c.title)).toEqual(['a', 'b']);
  });

  it('能按 id 或序号取章', () => {
    const project = createProject('t');
    const a = addChapter(project, { title: 'a', body: '' });
    expect(findChapter(project, 1)).toBe(a);
    expect(findChapter(project, 'ch-001')).toBe(a);
    expect(findChapter(project, 99)).toBeUndefined();
  });
});

describe('人物', () => {
  it('按正名、别名、id 都能找到人', () => {
    const project = createProject('t');
    const daiyu = addCharacter(project, { name: '林黛玉', aliases: ['颦儿', '林妹妹'] });

    expect(findCharacter(project, '林黛玉')).toBe(daiyu);
    expect(findCharacter(project, '颦儿')).toBe(daiyu);
    expect(findCharacter(project, 'char-001')).toBe(daiyu);
    expect(findCharacter(project, '薛宝钗')).toBeUndefined();
  });

  it('自动生成 id', () => {
    const project = createProject('t');
    expect(addCharacter(project, { name: '甲' }).id).toBe('char-001');
    expect(addCharacter(project, { name: '乙' }).id).toBe('char-002');
  });
});

describe('时间线', () => {
  it('按书内时间排序，不用文件顺序', () => {
    const project = createProject('t');
    const chapter = addChapter(project, { title: 'a', body: '' });
    addEvent(project, { chapterId: chapter.id, order: 20, title: '后' });
    addEvent(project, { chapterId: chapter.id, order: 5, title: '前' });

    expect(sortedTimeline(project).map((e) => e.title)).toEqual(['前', '后']);
  });
});

describe('伏笔', () => {
  it('埋下时默认 open，回收后变 paid', () => {
    const project = createProject('t');
    const c1 = addChapter(project, { title: '一', body: '' });
    const c2 = addChapter(project, { title: '二', body: '' });

    const fs = plantForeshadow(project, { title: '通灵宝玉', plantedChapterId: c1.id });
    expect(fs.status).toBe('open');
    expect(openForeshadows(project)).toHaveLength(1);
    expect(foreshadowsPlantedIn(project, c1.id)).toEqual([fs]);

    const paid = payForeshadow(project, fs.id, c2.id);
    expect(paid?.status).toBe('paid');
    expect(paid?.payoffChapterId).toBe(c2.id);
    expect(openForeshadows(project)).toHaveLength(0);
  });

  it('弃用后不再算未回收', () => {
    const project = createProject('t');
    const c1 = addChapter(project, { title: '一', body: '' });
    const fs = plantForeshadow(project, { title: '写废的线', plantedChapterId: c1.id });

    dropForeshadow(project, fs.id);
    expect(openForeshadows(project)).toHaveLength(0);
  });

  it('回收不存在的伏笔返回 undefined', () => {
    const project = createProject('t');
    expect(payForeshadow(project, 'nope', 'ch-001')).toBeUndefined();
  });
});
