import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { type Harness, harness } from './testing.js';

describe('shipbench validate', () => {
  const TIMESTAMP = '2026-07-01T00:00:00.000Z';
  const taskFile = (fields: string) =>
    `---\ntitle: A task\nstatus: todo\ncreated: ${TIMESTAMP}\nupdated: ${TIMESTAMP}\n${fields}---\n`;

  async function initialized(): Promise<Harness> {
    const h = harness();
    await h.run('init');
    h.stdout.length = 0;
    h.stderr.length = 0;
    return h;
  }

  it('prints nothing to stdout and a summary to stderr for a healthy project', async () => {
    const h = await initialized();

    await h.run('validate');

    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual([
      'No problems found in 1 task file. Archive not checked.',
    ]);
  });

  it('passes on warnings alone', async () => {
    const h = await initialized();
    h.adapter.files.set('.shipbench/tasks/extra.md', taskFile('estimate: 3\n'));

    await h.run('validate');

    expect(h.stdout).toEqual([
      '.shipbench/tasks/extra.md',
      '  warning field-unknown: Unknown frontmatter field "estimate" (preserved).',
    ]);
    expect(h.stderr).toEqual([
      '1 warning in 2 task files. Archive not checked.',
    ]);
  });

  it('groups problems by file, with a repair command where one exists, and exits 1', async () => {
    const h = await initialized();
    h.adapter.files.set(
      '.shipbench/tasks/misfiled.md',
      taskFile('').replace('status: todo', 'status: doing'),
    );
    h.adapter.files.set(
      '.shipbench/tasks/broken.md',
      '---\ntitle: One\ntitle: Two\nstatus: todo\n---\n',
    );

    await expect(h.run('validate')).rejects.toMatchObject({
      exitCode: 1,
      message: '2 errors in 3 task files. Archive not checked.',
    });
    expect(h.stdout).toEqual([
      '.shipbench/tasks/broken.md',
      '  error   frontmatter-unparseable: Could not parse frontmatter in ".shipbench/tasks/broken.md": Duplicated mapping key at line 3.',
      '',
      '.shipbench/tasks/misfiled.md',
      '  error   status-unknown: Unknown status "doing". Valid: todo, in-progress, done',
      '          fix: shipbench task move misfiled --to=<status>',
    ]);
  });

  it('keeps stdout to the JSON report, with config warnings in it rather than on stderr', async () => {
    const h = await initialized();
    h.adapter.files.set('.shipbench/layout.json', '{"todo": [');

    await expect(h.run('validate', '--json')).rejects.toMatchObject({
      exitCode: 1,
    });

    expect(h.stdout).toHaveLength(1);
    const report = JSON.parse(h.stdout[0]!);
    expect(report).toMatchObject({
      valid: false,
      errors: 1,
      warnings: 0,
      checked: { tasks: 1, archived: null },
      problems: [
        {
          severity: 'error',
          code: 'layout-unparseable',
          path: '.shipbench/layout.json',
        },
      ],
    });
    expect(h.stderr.join('\n')).not.toContain('Warning:');
  });

  it('adds each repair hint to the JSON report', async () => {
    const h = await initialized();
    h.adapter.files.set(
      '.shipbench/tasks/waits.md',
      taskFile('depends_on: [gone]\n'),
    );

    await expect(h.run('validate', '--json')).rejects.toMatchObject({
      exitCode: 1,
    });

    expect(JSON.parse(h.stdout[0]!).problems).toEqual([
      expect.objectContaining({
        code: 'depends-on-dangling',
        hint: 'shipbench task edit waits --remove-depends-on=<slug>',
      }),
    ]);
  });

  it('passes once the suggested repair is applied', async () => {
    const h = await initialized();
    h.adapter.files.set(
      '.shipbench/tasks/waits.md',
      taskFile('depends_on: [gone]\npriority: urgent\n'),
    );
    await expect(h.run('validate')).rejects.toMatchObject({ exitCode: 1 });

    await h.run(
      'task',
      'edit',
      'waits',
      '--remove-depends-on=gone',
      '--priority=high',
    );
    h.stdout.length = 0;
    h.stderr.length = 0;
    await h.run('validate');

    expect(h.stdout).toEqual([]);
  });

  it('checks the archive only with --archived', async () => {
    const h = await initialized();
    h.adapter.files.set(
      '.shipbench/tasks/archive/old.md',
      '---\ntitle: [unclosed\n---\n',
    );

    await h.run('validate');
    expect(h.stdout).toEqual([]);

    await expect(h.run('validate', '--archived')).rejects.toMatchObject({
      exitCode: 1,
      message: '1 error in 1 task file and 1 archived task file.',
    });
    expect(h.stdout[0]).toBe('.shipbench/tasks/archive/old.md');
  });

  it('says task files were not checked when the config is invalid', async () => {
    const h = await initialized();
    h.adapter.files.set(
      '.shipbench/config.json',
      '{"name": "x", "done_column": "finished"}\n',
    );

    await expect(h.run('validate')).rejects.toMatchObject({
      exitCode: 1,
      message: '1 error. Task files were not checked.',
    });
    expect(h.stdout).toEqual([
      '.shipbench/config.json',
      '  error   config-invalid: done_column "finished" does not match any column ID.',
    ]);
  });

  it('leaves every file unchanged, even when the layout needs a rewrite', async () => {
    const h = await initialized();
    h.adapter.files.set('.shipbench/layout.json', '{"gone":["x"]}\n');
    h.adapter.files.set(
      '.shipbench/tasks/broken.md',
      '---\ntitle: [unclosed\n---\n',
    );
    const before = new Map(h.adapter.files);

    await expect(h.run('validate', '--archived')).rejects.toMatchObject({
      exitCode: 1,
    });
    await expect(
      h.run('validate', '--archived', '--json'),
    ).rejects.toMatchObject({ exitCode: 1 });

    expect(h.adapter.files).toEqual(before);
  });

  describe('the repair each hint suggests', () => {
    async function codesFor(h: Harness, slug: string): Promise<string[]> {
      h.stdout.length = 0;
      try {
        await h.run('validate', '--json');
      } catch (error) {
        if ((error as { exitCode?: number }).exitCode !== 1) throw error;
      }
      const report = JSON.parse(h.stdout.at(-1)!);
      h.stdout.length = 0;
      return report.problems
        .filter((problem: { slug?: string }) => problem.slug === slug)
        .map((problem: { code: string }) => problem.code);
    }

    async function hintFor(h: Harness, slug: string, code: string) {
      h.stdout.length = 0;
      await h.run('validate', '--json').catch(() => undefined);
      const report = JSON.parse(h.stdout.at(-1)!);
      h.stdout.length = 0;
      return report.problems.find(
        (problem: { slug?: string; code: string }) =>
          problem.slug === slug && problem.code === code,
      )?.hint as string;
    }

    async function repair(
      fields: string,
      code: string,
      hintFlag: string,
      args: string[],
    ): Promise<Harness> {
      const h = await initialized();
      h.adapter.files.set('.shipbench/tasks/other.md', taskFile(''));
      h.adapter.files.set('.shipbench/tasks/broken.md', taskFile(fields));
      expect(await codesFor(h, 'broken')).toContain(code);
      expect(await hintFor(h, 'broken', code)).toContain(hintFlag);

      h.stderr.length = 0;
      await h.run('task', 'edit', 'broken', ...args);

      expect(await codesFor(h, 'broken')).not.toContain(code);
      return h;
    }

    const frontmatter = (h: Harness) =>
      matter(h.adapter.files.get('.shipbench/tasks/broken.md')!).data;

    it('repairs tags that are not a list with --tags', async () => {
      const h = await repair('tags: notalist\n', 'tags-invalid', '--tags=', [
        '--tags=x',
      ]);
      expect(frontmatter(h).tags).toEqual(['x']);
      expect(h.stderr.join('\n')).toContain('tags (invalid: "notalist") → [x]');
    });

    it('repairs tags that are not a list with --clear-tags', async () => {
      const h = await repair(
        'tags: notalist\n',
        'tags-invalid',
        '--clear-tags',
        ['--clear-tags'],
      );
      expect(frontmatter(h)).not.toHaveProperty('tags');
    });

    it('repairs an empty depends_on with --clear-depends-on', async () => {
      const h = await repair(
        'depends_on:\n',
        'depends-on-invalid',
        '--clear-depends-on',
        ['--clear-depends-on'],
      );
      expect(frontmatter(h)).not.toHaveProperty('depends_on');
      expect(h.stderr.join('\n')).toContain(
        'depends_on (invalid: null) → (none)',
      );
    });

    it('repairs a depends_on entry that is not a slug with --depends-on', async () => {
      const h = await repair(
        'depends_on: [other, 3]\n',
        'depends-on-invalid',
        '--depends-on=',
        ['--depends-on=other'],
      );
      expect(frontmatter(h).depends_on).toEqual(['other']);
    });

    it('repairs a depends_on entry that is not a slug with --clear-depends-on', async () => {
      const h = await repair(
        'depends_on: [other, 3]\n',
        'depends-on-invalid',
        '--clear-depends-on',
        ['--clear-depends-on'],
      );
      expect(frontmatter(h)).not.toHaveProperty('depends_on');
    });

    it('repairs related that is not a list with --clear-related', async () => {
      const h = await repair(
        'related: oops\n',
        'related-invalid',
        '--clear-related',
        ['--clear-related'],
      );
      expect(frontmatter(h)).not.toHaveProperty('related');
    });

    it('repairs related that is not a list with --related', async () => {
      const h = await repair(
        'related: oops\n',
        'related-invalid',
        '--related=',
        ['--related=other'],
      );
      expect(frontmatter(h).related).toEqual(['other']);
    });
  });

  it('exits 2 when there is no board to check', async () => {
    const h = harness();

    await expect(h.run('validate')).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('No .shipbench/config.json found'),
    });
    expect(h.stdout).toEqual([]);
  });
});
