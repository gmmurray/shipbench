import { describe, expect, it } from 'vitest';
import { isTaskFlagged, taskFlag } from './flag.js';
import type { TaskFrontmatter } from './types.js';

function withFlag(flag: unknown) {
  return {
    frontmatter: {
      title: 'Task',
      status: 'todo',
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-01T00:00:00Z',
      flag,
    } as TaskFrontmatter,
  };
}

describe('taskFlag', () => {
  it('reads a reason, trimmed', () => {
    expect(taskFlag(withFlag('  Needs a decision '))).toEqual({
      reason: 'Needs a decision',
    });
  });

  it('reads `true` as a flag with no reason', () => {
    expect(taskFlag(withFlag(true))).toEqual({ reason: null });
  });

  it.each([
    ['absent', undefined],
    ['null', null],
    ['false', false],
    ['blank', '  '],
    ['a list', ['x']],
    ['a number', 1],
  ])('reads %s as unflagged', (_name, flag) => {
    expect(taskFlag(withFlag(flag))).toBeNull();
    expect(isTaskFlagged(withFlag(flag))).toBe(false);
  });
});
