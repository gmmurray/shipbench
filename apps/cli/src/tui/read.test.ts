/**
 * What the read layer does when the project is broken — which is the only part
 * of it that has behaviour of its own. The happy path is `loadConfig` plus
 * `listTasks` plus `buildBoardModel`, all covered where they live.
 *
 * The prefixes are the contract: `run.ts` puts these strings on the status line
 * verbatim, so an operator has to be able to tell "your config is unreadable"
 * from "one of your task files is" without leaving the pane.
 */

import { describe, expect, it } from 'vitest';
import { MISSING_CONFIG_MESSAGE, readBoard } from './read.js';
import { createMemoryProject, TEST_CONFIG, taskFile } from './testing.js';

const CONFIG = '.shipbench/config.json';

function project(files: Record<string, string> = {}) {
  return createMemoryProject({
    [CONFIG]: JSON.stringify(TEST_CONFIG),
    ...files,
  });
}

describe('readBoard', () => {
  it('builds a model from a healthy project', async () => {
    const outcome = await readBoard(
      project({
        '.shipbench/tasks/first.md': taskFile('First task'),
        '.shipbench/tasks/shipped.md': taskFile('Shipped', { status: 'done' }),
      }).adapter,
      {},
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.model.columns.map(column => column.id)).toEqual([
      'todo',
      'in-progress',
      'done',
    ]);
    expect(outcome.model.columns[0].tasks.map(task => task.slug)).toEqual([
      'first',
    ]);
    expect(outcome.config.name).toBe('memory');
  });

  it('marks unfinished dependencies but accepts archived dependencies', async () => {
    const outcome = await readBoard(
      project({
        '.shipbench/tasks/foundation.md': taskFile('Foundation'),
        '.shipbench/tasks/blocked.md': taskFile('Blocked task', {
          depends_on: '[foundation]',
        }),
        '.shipbench/tasks/archive-satisfied.md': taskFile(
          'Archive-satisfied task',
          { depends_on: '[archived-foundation]' },
        ),
        '.shipbench/tasks/archive/archived-foundation.md': taskFile(
          'Archived foundation',
          { status: 'done' },
        ),
      }).adapter,
      {},
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect([...outcome.model.blockedTaskSlugs]).toEqual(['blocked']);
    expect(outcome.model.warnings).toEqual([]);
  });

  it('accepts a malformed archived prerequisite and surfaces its warning', async () => {
    const outcome = await readBoard(
      project({
        '.shipbench/tasks/dependent.md': taskFile('Dependent task', {
          depends_on: '[foundation]',
        }),
        '.shipbench/tasks/archive/foundation.md':
          '---\ntitle: [unclosed\n---\n\nbody\n',
      }).adapter,
      {},
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.model.blockedTaskSlugs.has('dependent')).toBe(false);
    expect(outcome.model.warnings).toEqual([
      expect.objectContaining({
        slug: 'foundation',
        field: 'frontmatter',
        message: expect.stringMatching(/archive\/foundation\.md/i),
      }),
    ]);
  });

  it('does not surface malformed archive files unrelated to live dependencies', async () => {
    const outcome = await readBoard(
      project({
        '.shipbench/tasks/standalone.md': taskFile('Standalone task'),
        '.shipbench/tasks/archive/unrelated.md':
          '---\ntitle: [unclosed\n---\n\nbody\n',
      }).adapter,
      {},
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.model.warnings).toEqual([]);
  });

  it('names a missing project the way the board server does', async () => {
    // Word for word what `startBoardServer` says. Both surfaces of `board` fail
    // identically outside a project, and this is the assertion that keeps it so.
    const outcome = await readBoard(createMemoryProject().adapter, {});

    expect(outcome).toEqual({ ok: false, message: MISSING_CONFIG_MESSAGE });
    expect(MISSING_CONFIG_MESSAGE).toBe(
      'No .shipbench/config.json found. Run shipbench init first.',
    );
  });

  it('reports an unparseable config as a config problem', async () => {
    const outcome = await readBoard(
      createMemoryProject({ [CONFIG]: '{ "columns": [' }).adapter,
      {},
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toMatch(/^config: /);
  });

  it('renders with fallback ordering and a warning for malformed layout.json', async () => {
    const outcome = await readBoard(
      project({
        '.shipbench/layout.json': '{"todo": [',
        '.shipbench/tasks/first.md': taskFile('First task'),
      }).adapter,
      {},
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.config.layout).toEqual({});
    expect(outcome.model.columns[0].tasks.map(task => task.slug)).toEqual([
      'first',
    ]);
    expect(outcome.model.notice).toMatch(/layout\.json.*fallback order/i);
  });

  it('returns readable tasks and a warning when one task is caught mid-write', async () => {
    const outcome = await readBoard(
      project({
        '.shipbench/tasks/first.md': taskFile('First task'),
        '.shipbench/tasks/broken.md': '---\ntitle: [unclosed\n---\n\nbody\n',
      }).adapter,
      {},
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.model.columns[0].tasks.map(task => task.slug)).toEqual([
      'first',
    ]);
    expect(outcome.model.warnings).toEqual([
      expect.objectContaining({
        slug: 'broken',
        field: 'frontmatter',
      }),
    ]);
  });

  it('passes filters through to the model', async () => {
    const outcome = await readBoard(
      project({
        '.shipbench/tasks/tagged.md': taskFile('Tagged', { tags: '[cli]' }),
        '.shipbench/tasks/plain.md': taskFile('Plain'),
      }).adapter,
      { tags: ['cli'] },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const todo = outcome.model.columns[0];
    expect(todo.tasks.map(task => task.slug)).toEqual(['tagged']);
    expect(todo.total).toBe(2);
  });
});
