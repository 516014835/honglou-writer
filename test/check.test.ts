import { describe, expect, it } from 'vitest';
import { checkProject, formatDiagnostics, hasErrors } from '../src/check.js';
import {
  addChapter,
  addCharacter,
  createProject,
  plantForeshadow,
} from '../src/project.js';
import type { Project } from '../src/types.js';

function codes(project: Project): string[] {
  return checkProject(project).map((d) => d.code);
}

describe('checkProject', () => {
  it('健康的一本书没有 error', () => {
    const project = createProject('t');
    const c1 = addChapter(project, { title: '一', body: '一二三' });
    addCharacter(project, { name: '甲', firstChapterId: c1.id });
    expect(hasErrors(checkProject(project))).toBe(false);
  });

  it('空书给提示', () => {
    expect(codes(createProject('空'))).toContain('EMPTY_PROJECT');
  });

  it('空章与无回目会被提示', () => {
    const project = createProject('t');
    addChapter(project, { title: '', body: '' });
    const found = codes(project);
    expect(found).toContain('EMPTY_CHAPTER_TITLE');
    expect(found).toContain('EMPTY_CHAPTER_BODY');
  });

  it('重复的章 id 与序号是 error', () => {
    const project = createProject('t');
    // 绕过 addChapter 的去重，手动塞两条冲突数据
    project.chapters.push(
      { id: 'same', order: 1, title: 'a', body: 'x' },
      { id: 'same', order: 1, title: 'b', body: 'y' },
    );

    const diagnostics = checkProject(project);
    expect(hasErrors(diagnostics)).toBe(true);
    expect(diagnostics.map((d) => d.code)).toEqual(
      expect.arrayContaining(['DUPLICATE_CHAPTER_ID', 'DUPLICATE_CHAPTER_ORDER']),
    );
  });

  it('引用不存在的章是 error', () => {
    const project = createProject('t');
    addCharacter(project, { name: '甲', firstChapterId: 'ch-404' });

    const diagnostic = checkProject(project).find((d) => d.code === 'MISSING_CHAPTER_REF');
    expect(diagnostic?.level).toBe('error');
    expect(diagnostic?.message).toContain('ch-404');
  });

  it('未回收伏笔是 warning', () => {
    const project = createProject('t');
    const c1 = addChapter(project, { title: '一', body: '正文' });
    plantForeshadow(project, { title: '金锁', plantedChapterId: c1.id });

    const diagnostic = checkProject(project).find((d) => d.code === 'OPEN_FORESHADOW');
    expect(diagnostic?.level).toBe('warning');
    expect(hasErrors(checkProject(project))).toBe(false);
  });

  it('回收早于埋设是 error', () => {
    const project = createProject('t');
    const c1 = addChapter(project, { title: '一', body: 'x' });
    const c2 = addChapter(project, { title: '二', body: 'y' });
    plantForeshadow(project, {
      title: '倒着回收',
      plantedChapterId: c2.id,
      payoffChapterId: c1.id,
      status: 'paid',
    });

    expect(codes(project)).toContain('PAYOFF_BEFORE_PLANT');
    expect(hasErrors(checkProject(project))).toBe(true);
  });

  it('断掉的人物关系是 warning', () => {
    const project = createProject('t');
    addCharacter(project, { name: '甲', relations: [{ to: 'char-999', label: '表妹' }] });
    expect(codes(project)).toContain('DANGLING_RELATION');
  });
});

describe('formatDiagnostics', () => {
  it('空列表给一句人话', () => {
    expect(formatDiagnostics([])).toBe('没有发现问题。');
  });

  it('带图标和级别', () => {
    const text = formatDiagnostics([
      { level: 'error', code: 'E', message: '出错了' },
      { level: 'warning', code: 'W', message: '注意点' },
    ]);
    expect(text).toContain('✖ [错误] 出错了');
    expect(text).toContain('▲ [警告] 注意点');
  });
});
