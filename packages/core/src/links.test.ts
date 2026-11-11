import { describe, expect, it } from 'vitest';
import { taskLinkTargets, tasksLinkingTo } from './links.js';
import type { Task } from './types.js';

function task(slug: string, body: string, updates: string[] = []): Task {
  return {
    slug,
    frontmatter: {
      title: `Title of ${slug}`,
      status: 'todo',
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-01T00:00:00Z',
    },
    body,
    comments: updates.map(text => ({
      timestamp: '2026-01-02T00:00:00Z',
      text,
    })),
  };
}

describe('taskLinkTargets', () => {
  it('reads every form that names a task file', () => {
    expect(
      taskLinkTargets(
        [
          '[a](bare.md)',
          '[b](./dotted.md)',
          '[c](archive/filed.md)',
          '[d](../from-archive.md)',
          '[e](../../.shipbench/tasks/rooted.md)',
          '[f](/.shipbench/tasks/archive/rooted-archive.md)',
          '[g](<angled.md> "title")',
          '[h](anchored.md#decision)',
        ].join('\n'),
      ),
    ).toEqual([
      'bare',
      'dotted',
      'filed',
      'from-archive',
      'rooted',
      'rooted-archive',
      'angled',
      'anchored',
    ]);
  });

  it('reads reference-style definitions', () => {
    expect(
      taskLinkTargets('See [the store][s].\n\n[s]: choose-a-store.md'),
    ).toEqual(['choose-a-store']);
  });

  it('ignores links that do not name a task file', () => {
    expect(
      taskLinkTargets(
        [
          '[spec](../../docs/spec.md)',
          '[doc](docs/guide.md)',
          '[site](https://example.com/a.md)',
          '[anchor](#a)',
          '[code](src/index.ts)',
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('skips links inside code', () => {
    expect(
      taskLinkTargets(
        [
          'Write `[x](inline.md)` like this.',
          '```md',
          '[y](fenced.md)',
          '```',
          '[z](real.md)',
        ].join('\n'),
      ),
    ).toEqual(['real']);
  });

  it('dedupes in first-seen order', () => {
    expect(taskLinkTargets('[a](b.md) [c](./b.md) [d](a.md)')).toEqual([
      'b',
      'a',
    ]);
  });
});

describe('tasksLinkingTo', () => {
  it('finds links in descriptions and Task Updates, sorted, excluding the task itself', () => {
    const tasks = [
      task('zeta', 'See [target](target.md).'),
      task('alpha', 'Nothing here.', ['Decided in [target](./target.md).']),
      task('target', 'Self [link](target.md).'),
      task('other', 'Links [elsewhere](elsewhere.md).'),
    ];

    expect(tasksLinkingTo(tasks, 'target')).toEqual(['alpha', 'zeta']);
  });
});
