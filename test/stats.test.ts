import { describe, expect, it } from 'vitest';
import { countChars, countWords, hasCJK, projectStat } from '../src/stats.js';
import { addChapter, createProject } from '../src/project.js';

describe('countWords', () => {
  it('汉字按字计', () => {
    expect(countWords('满纸荒唐言')).toBe(5);
  });

  it('忽略标点和空白', () => {
    expect(countWords('满纸荒唐言，一把辛酸泪。')).toBe(10);
    expect(countWords('  空格   不算  ')).toBe(4);
  });

  it('英文按词计', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords("it's a well-known fact")).toBe(4);
  });

  it('中英混排分别计数', () => {
    expect(countWords('黛玉说 hello')).toBe(4);
  });

  it('空文本是 0', () => {
    expect(countWords('')).toBe(0);
  });
});

describe('countChars', () => {
  it('标点也算，但不算空白', () => {
    expect(countChars('一，二。\n三')).toBe(5);
  });
});

describe('hasCJK', () => {
  it('能认出汉字', () => {
    expect(hasCJK('黛玉')).toBe(true);
    expect(hasCJK('daiyu')).toBe(false);
  });
});

describe('projectStat', () => {
  it('统计全书与每章字数', () => {
    const project = createProject('测试');
    addChapter(project, { title: '一', body: '一二三四五' });
    addChapter(project, { title: '二', body: '甲乙丙' });

    const stat = projectStat(project);
    expect(stat.chapters).toBe(2);
    expect(stat.totalWords).toBe(8);
    expect(stat.averageWords).toBe(4);
    expect(stat.perChapter.map((c) => c.words)).toEqual([5, 3]);
  });

  it('空书不会除以零', () => {
    expect(projectStat(createProject('空')).averageWords).toBe(0);
  });
});
