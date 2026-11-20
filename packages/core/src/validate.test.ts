import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './defaults.js';
import type { ReadableStorageAdapter } from './types.js';
import { validateProject } from './validate.js';

const TIMESTAMP = '2026-07-01T00:00:00.000Z';

/** A read-only adapter: validation must never reach for a write method. */
function readOnlyAdapter(seed: Record<string, string>): ReadableStorageAdapter {
  const files = new Map(Object.entries(seed));
  return {
    readFile: async path => {
      const value = files.get(path);
      if (value === undefined) throw new Error(`ENOENT: ${path}`);
      return value;
    },
    readFileIfExists: async path => files.get(path) ?? null,
    listFiles: async dir => {
      const prefix = `${dir}/`;
      const entries = new Set<string>();
      for (const path of files.keys()) {
        if (!path.startsWith(prefix)) continue;
        // Directories are listed by name, as FsAdapter's readdir lists them.
        entries.add(path.slice(prefix.length).split('/')[0]!);
      }
      return [...entries];
    },
    readFiles: async paths =>
      new Map(
        paths.flatMap(path => {
          const value = files.get(path);
          return value === undefined ? [] : [[path, value] as const];
        }),
      ),
  };
}

function taskFile(fields: Record<string, string> = {}, body = ''): string {
  const frontmatter = {
    title: 'A task',
    status: 'todo',
    created: TIMESTAMP,
    updated: TIMESTAMP,
    ...fields,
  };
  const lines = Object.entries(frontmatter).map(
    ([key, value]) => `${key}: ${value}`,
  );
  return `---\n${lines.join('\n')}\n---\n\n${body}\n`;
}

const CONFIG = `${JSON.stringify({ ...DEFAULT_CONFIG, layout: undefined }, null, 2)}\n`;

function project(files: Record<string, string>): ReadableStorageAdapter {
  return readOnlyAdapter({ '.shipbench/config.json': CONFIG, ...files });
}

describe('validateProject', () => {
  it('reports a healthy project as valid, without checking the archive', async () => {
    const report = await validateProject(
      project({
        '.shipbench/layout.json': '{"todo":["a"]}\n',
        '.shipbench/tasks/a.md': taskFile(),
        '.shipbench/tasks/b.md': taskFile({ depends_on: '[a]' }),
        '.shipbench/tasks/archive/old.md': '---\ntitle: [unclosed\n---\n',
      }),
    );

    expect(report).toEqual({
      valid: true,
      errors: 0,
      warnings: 0,
      checked: { tasks: 2, archived: null },
      problems: [],
    });
  });

  it('accepts the supported partial states: a partial config, no layout file, no tasks', async () => {
    const report = await validateProject(
      readOnlyAdapter({ '.shipbench/config.json': '{"name":"Partial"}\n' }),
    );

    expect(report).toMatchObject({
      valid: true,
      checked: { tasks: 0, archived: null },
      problems: [],
    });
  });

  it('reports a preserved unknown field as a warning that leaves the project valid', async () => {
    const report = await validateProject(
      project({ '.shipbench/tasks/a.md': taskFile({ estimate: '3' }) }),
    );

    expect(report.valid).toBe(true);
    expect(report.problems).toEqual([
      {
        severity: 'warning',
        code: 'field-unknown',
        path: '.shipbench/tasks/a.md',
        slug: 'a',
        field: 'estimate',
        message: 'Unknown frontmatter field "estimate" (preserved).',
      },
    ]);
  });

  it('keeps checking the other files after one fails to parse', async () => {
    const report = await validateProject(
      project({
        '.shipbench/tasks/broken.md':
          '---\ntitle: One\ntitle: Two\nstatus: todo\n---\n',
        '.shipbench/tasks/misfiled.md': taskFile({ status: 'doing' }),
        '.shipbench/tasks/fine.md': taskFile(),
      }),
    );

    expect(report).toMatchObject({
      valid: false,
      errors: 2,
      warnings: 0,
      checked: { tasks: 3, archived: null },
    });
    expect(report.problems).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: 'frontmatter-unparseable',
        path: '.shipbench/tasks/broken.md',
        message: expect.stringContaining('Duplicated mapping key at line 3.'),
      }),
      expect.objectContaining({
        severity: 'error',
        code: 'status-unknown',
        path: '.shipbench/tasks/misfiled.md',
        field: 'status',
        message: expect.stringContaining('Valid: todo, in-progress, done'),
      }),
    ]);
  });

  it('reports missing required fields and malformed lists', async () => {
    const report = await validateProject(
      project({
        '.shipbench/tasks/bare.md': '---\nstatus: todo\ntags: urgent\n---\n',
      }),
    );

    expect(
      report.problems.map(problem => [problem.code, problem.field]),
    ).toEqual([
      ['title-invalid', 'title'],
      ['tags-invalid', 'tags'],
      ['timestamp-invalid', 'created'],
      ['timestamp-invalid', 'updated'],
    ]);
    expect(report.problems.every(p => p.severity === 'error')).toBe(true);
  });

  it('says whether a title is missing, blank, or not text', async () => {
    const report = await validateProject(
      project({
        '.shipbench/tasks/blank.md': taskFile({ title: "'   '" }),
        '.shipbench/tasks/missing.md': taskFile({ title: '' }),
        '.shipbench/tasks/number.md': taskFile({ title: '2026' }),
      }),
    );

    expect(
      report.problems.map(problem => [problem.slug, problem.message]),
    ).toEqual([
      ['blank', 'Blank title. Every task needs a non-empty `title`.'],
      ['missing', 'Missing title. Every task needs a non-empty `title`.'],
      ['number', 'Expected title to be text (got 2026).'],
    ]);
  });

  it('punctuates the config parse error as its own sentence', async () => {
    const unparseable = await validateProject(
      readOnlyAdapter({ '.shipbench/config.json': '{"name": ' }),
    );
    const notAnObject = await validateProject(
      readOnlyAdapter({ '.shipbench/config.json': '[]' }),
    );

    expect(unparseable.problems[0]!.message).toMatch(
      /[^.]\. Tasks were not checked/,
    );
    expect(notAnObject.problems[0]!.message).toBe(
      'Config must contain a JSON object. Tasks were not checked, because their statuses and priorities are checked against this file.',
    );
  });

  it('stops at an unparseable config and says why tasks were not checked', async () => {
    const report = await validateProject(
      readOnlyAdapter({
        '.shipbench/config.json': '{"name": "x",\n<<<<<<< HEAD\n',
        '.shipbench/tasks/a.md': taskFile(),
      }),
    );

    expect(report).toMatchObject({
      valid: false,
      errors: 1,
      checked: { tasks: null, archived: null },
    });
    expect(report.problems).toEqual([
      expect.objectContaining({
        code: 'config-unparseable',
        path: '.shipbench/config.json',
        message: expect.stringMatching(/Tasks were not checked/),
      }),
    ]);
  });

  it('lists each config validation error separately, beside unknown keys', async () => {
    const report = await validateProject(
      readOnlyAdapter({
        '.shipbench/config.json': JSON.stringify({
          name: 'x',
          done_column: 'finished',
          colums: [],
          priority: { valuse: ['low'] },
        }),
      }),
    );

    expect(report.checked).toEqual({ tasks: null, archived: null });
    expect(report.problems).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'config-field-unknown',
        field: 'colums',
      }),
      expect.objectContaining({
        severity: 'warning',
        code: 'config-field-unknown',
        field: 'priority.valuse',
      }),
      expect.objectContaining({
        severity: 'error',
        code: 'config-invalid',
        message: 'done_column "finished" does not match any column ID.',
      }),
    ]);
  });

  it('treats a broken layout file as an error and a stale column key as a warning', async () => {
    const broken = await validateProject(
      project({ '.shipbench/layout.json': '{"todo": ["a"' }),
    );
    expect(broken.problems).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: 'layout-unparseable',
        path: '.shipbench/layout.json',
      }),
    ]);

    const stale = await validateProject(
      project({
        '.shipbench/layout.json': '{"doing":["a"],"todo":["gone"]}\n',
      }),
    );
    // A slug for a task that no longer exists is a supported state: the next
    // layout write prunes it.
    expect(stale.valid).toBe(true);
    expect(stale.problems).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'layout-column-unknown',
        path: '.shipbench/layout.json',
      }),
    ]);
  });

  it('finds a dependency loop of any length, once', async () => {
    const report = await validateProject(
      project({
        '.shipbench/tasks/a.md': taskFile({ depends_on: '[b]' }),
        '.shipbench/tasks/b.md': taskFile({ depends_on: '[c]' }),
        '.shipbench/tasks/c.md': taskFile({ depends_on: '[a]' }),
        '.shipbench/tasks/d.md': taskFile({ depends_on: '[a, e]' }),
        '.shipbench/tasks/e.md': taskFile({ depends_on: '[d]' }),
      }),
    );

    expect(report.problems).toEqual([
      {
        severity: 'error',
        code: 'dependency-cycle',
        path: '.shipbench/tasks/a.md',
        slug: 'a',
        field: 'depends_on',
        message: expect.stringContaining('a → b → c → a'),
        cycle: ['a', 'b', 'c', 'a'],
      },
      expect.objectContaining({
        code: 'dependency-cycle',
        cycle: ['d', 'e', 'd'],
      }),
    ]);
  });

  it('counts an archived dependency as present and names a missing one', async () => {
    const report = await validateProject(
      project({
        '.shipbench/tasks/a.md': taskFile({ depends_on: '[shipped, gone]' }),
        '.shipbench/tasks/b.md': taskFile({ depends_on: '[b]' }),
        '.shipbench/tasks/archive/shipped.md': taskFile({ status: 'done' }),
      }),
    );

    expect(report.problems).toEqual([
      expect.objectContaining({
        code: 'depends-on-dangling',
        slug: 'a',
        message:
          'Dangling dependency "gone" — no live or archived task file matches that slug, so the task can never become available.',
      }),
      expect.objectContaining({ code: 'depends-on-self', slug: 'b' }),
    ]);
  });

  it('reports a slug used both live and in the archive', async () => {
    const report = await validateProject(
      project({
        '.shipbench/tasks/twin.md': taskFile(),
        '.shipbench/tasks/archive/twin.md': taskFile({ status: 'done' }),
      }),
    );

    expect(report.problems).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: 'slug-reused-in-archive',
        path: '.shipbench/tasks/twin.md',
      }),
    ]);
  });

  it('warns about files in tasks/ that no read picks up', async () => {
    const report = await validateProject(
      project({
        '.shipbench/tasks/.gitkeep': '',
        '.shipbench/tasks/Notes.MD': taskFile(),
        '.shipbench/tasks/archive/old.md': taskFile(),
      }),
    );

    expect(report.valid).toBe(true);
    expect(report.problems).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'file-ignored',
        path: '.shipbench/tasks/Notes.MD',
      }),
    ]);
  });

  it('checks the archive only when asked, and reports its files at their archive path', async () => {
    const seed = {
      '.shipbench/tasks/a.md': taskFile(),
      '.shipbench/tasks/archive/old.md': '---\ntitle: [unclosed\n---\n',
      '.shipbench/tasks/archive/older.md': taskFile({ status: 'done' }),
    };

    expect((await validateProject(project(seed))).valid).toBe(true);

    const report = await validateProject(project(seed), { archived: true });
    expect(report).toMatchObject({
      valid: false,
      checked: { tasks: 1, archived: 2 },
    });
    expect(report.problems).toEqual([
      expect.objectContaining({
        code: 'frontmatter-unparseable',
        path: '.shipbench/tasks/archive/old.md',
        slug: 'old',
      }),
    ]);
  });

  it('throws when there is no config to validate against', async () => {
    await expect(validateProject(readOnlyAdapter({}))).rejects.toThrow(
      /ENOENT/,
    );
  });
});
