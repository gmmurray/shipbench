import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './defaults.js';
import {
  initProject,
  inspectProjectInitialization,
  ProjectInitializationError,
} from './init.js';
import type { StorageAdapter } from './types.js';

function memoryAdapter(): StorageAdapter & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    readFile: async path => {
      const v = files.get(path);
      if (v === undefined) throw new Error(`ENOENT: ${path}`);
      return v;
    },
    readFileIfExists: async path => files.get(path) ?? null,
    writeFile: async (path, content) => {
      files.set(path, content);
    },
    deleteFile: async path => {
      files.delete(path);
    },
    listFiles: async dir => {
      const prefix = dir.endsWith('/') ? dir : `${dir}/`;
      return [...files.keys()]
        .filter(p => p.startsWith(prefix))
        .map(p => p.slice(prefix.length));
    },
    readFiles: async paths => {
      const out = new Map<string, string>();
      for (const p of paths) {
        const v = files.get(p);
        if (v !== undefined) out.set(p, v);
      }
      return out;
    },
    writeFiles: async batch => {
      for (const [p, c] of batch) files.set(p, c);
    },
  };
}

describe('initProject', () => {
  it('writes the five scaffold files', async () => {
    const adapter = memoryAdapter();
    await initProject(adapter, { name: 'Test Project' });
    expect([...adapter.files.keys()].sort()).toEqual([
      '.shipbench/AGENTS.md',
      '.shipbench/README.md',
      '.shipbench/config.json',
      '.shipbench/layout.json',
      '.shipbench/tasks/welcome-to-shipbench.md',
    ]);
  });

  it('writes config without layout and scaffolds an empty layout.json', async () => {
    const adapter = memoryAdapter();
    await initProject(adapter, { name: 'Test Project' });
    const raw = adapter.files.get('.shipbench/config.json');
    expect(raw).toBeDefined();
    expect(raw?.endsWith('\n')).toBe(true);
    const { layout: _layout, ...defaultConfig } = DEFAULT_CONFIG;
    expect(JSON.parse(raw!)).toEqual({
      ...defaultConfig,
      name: 'Test Project',
    });
    expect(adapter.files.get('.shipbench/layout.json')).toBe('{}\n');
  });

  it('writes a README and AGENTS.md that reference the project name', async () => {
    const adapter = memoryAdapter();
    await initProject(adapter, { name: 'Acme Widgets' });
    const readme = adapter.files.get('.shipbench/README.md') ?? '';
    const agents = adapter.files.get('.shipbench/AGENTS.md') ?? '';
    expect(readme).toContain('Acme Widgets');
    expect(agents).toContain('Acme Widgets');
  });

  it('documents the archive directory and archived dependency semantics', async () => {
    const adapter = memoryAdapter();
    await initProject(adapter, { name: 'Test Project' });
    const readme = adapter.files.get('.shipbench/README.md') ?? '';
    const agents = adapter.files.get('.shipbench/AGENTS.md') ?? '';

    expect(readme).toContain('tasks/archive/');
    expect(readme).toContain('byte-for-byte');
    expect(agents).toContain('do not read unless asked');
    expect(agents).toContain('Archived dependencies count as satisfied');
    expect(agents).toContain('Archived slugs are never reused');
  });

  it('writes an AGENTS.md that reflects the default columns and priorities', async () => {
    const adapter = memoryAdapter();
    await initProject(adapter, { name: 'Test Project' });
    const agents = adapter.files.get('.shipbench/AGENTS.md') ?? '';
    for (const c of DEFAULT_CONFIG.columns) {
      expect(agents).toContain(c.id);
    }
    for (const p of DEFAULT_CONFIG.priority.values) {
      expect(agents).toContain(p);
    }
  });

  it('writes an AGENTS.md that prefers CLI operations for task mutations', async () => {
    const adapter = memoryAdapter();
    await initProject(adapter, { name: 'Test Project' });
    const agents = adapter.files.get('.shipbench/AGENTS.md') ?? '';
    expect(agents).toContain('Prefer the ShipBench CLI');
    expect(agents).toContain('shipbench task list');
    expect(agents).toContain(
      'shipbench task create "Task title" --status=todo',
    );
    expect(agents).toContain('shipbench task move <slug> --to=in-progress');
    expect(agents).toContain('shipbench task move <slug> --to=done');
    expect(agents).toContain('shipbench task archive <slug>');
    expect(agents).toContain('shipbench task archive --done');
    expect(agents).toContain('shipbench task list --archived');
    expect(agents).toContain('shipbench task unarchive <slug>');
    expect(agents).toContain('shipbench task delete <slug>');
    expect(agents).toContain(
      'Use direct edits only when the CLI is unavailable',
    );
  });

  it('writes an AGENTS.md that gates reordering behind an explicit request', async () => {
    const adapter = memoryAdapter();
    await initProject(adapter, { name: 'Test Project' });
    const agents = adapter.files.get('.shipbench/AGENTS.md') ?? '';

    expect(agents).toContain('## Changing Board Order');
    for (const flag of [
      '`--top`',
      '`--bottom`',
      '`--before <slug>`',
      '`--after <slug>`',
      '`--position <n>`',
    ]) {
      expect(agents).toContain(flag);
    }
    expect(agents).toContain('reorder only when the user explicitly asks');
    expect(agents).toContain(
      'Reorder tasks only when the user explicitly asks for it.',
    );
  });

  it('writes an AGENTS.md that teaches the shipped discovery commands', async () => {
    const adapter = memoryAdapter();
    await initProject(adapter, { name: 'Test Project' });
    const agents = adapter.files.get('.shipbench/AGENTS.md') ?? '';

    expect(agents).toContain('shipbench task list --available --json');
    expect(agents).toContain('shipbench task list --blocked --json');
    expect(agents).toContain(
      'shipbench task list --available --tag backend,auth --json',
    );
    expect(agents).toContain('shipbench task get <slug>');
    expect(agents).toContain('shipbench task search "<query>" --json');
    expect(agents).toContain(
      'shipbench task search "<query>" --json --include-body',
    );
    expect(agents).toContain('shipbench task search "<query>" --all --json');
    expect(agents).toContain('shipbench task graph --json');
    expect(agents).toContain('add `--archived` to resolve archived nodes');
    expect(agents).toContain('shipbench task list --json --include-body');
    expect(agents).toContain('uses AND semantics');
    expect(agents).toContain('mutually exclusive');
    expect(agents).toContain(
      'Read the narrowest thing that answers your question',
    );
    expect(agents).toContain('Prefer `task get` after narrowing');
    expect(agents).toContain(
      '`layout.json` is a partial, machine-managed index, not the visible order',
    );
    expect(agents).toContain('zero-based `position` within its column');
  });

  it('explains visible order without exposing the internal layout API', async () => {
    const adapter = memoryAdapter();
    await initProject(adapter, { name: 'Test Project' });
    const readme = adapter.files.get('.shipbench/README.md') ?? '';
    const agents = adapter.files.get('.shipbench/AGENTS.md') ?? '';

    expect(readme).toContain(
      '`layout.json` is a partial, machine-managed index of manual placements',
    );
    expect(readme).toContain(
      'Do not read `layout.json` alone to determine board order',
    );
    expect(readme).toContain(
      'Read the narrowest thing that answers the question',
    );
    expect(readme).toContain('Direct file readers must apply the rules above');
    expect(agents).toContain(
      'combine task statuses with `config.json` and the ordering rules in `README.md`',
    );
    expect(readme).not.toContain('orderedTasksForColumn');
    expect(agents).not.toContain('orderedTasksForColumn');
  });

  it('documents the time-anchored Updates heuristic and mutation commands', async () => {
    const adapter = memoryAdapter();
    await initProject(adapter, { name: 'Test Project' });
    const readme = adapter.files.get('.shipbench/README.md') ?? '';
    const agents = adapter.files.get('.shipbench/AGENTS.md') ?? '';

    expect(readme).toContain('reserved `## Task Updates` section');
    expect(readme).toContain('shipbench task comment <slug>');
    expect(readme).toContain('shipbench task comment edit <slug> <index>');
    expect(readme).toContain('shipbench task comment delete <slug> <index>');
    expect(readme).toContain("Edits preserve the entry's timestamp");
    expect(agents).toContain(
      'Would this fact still be true or relevant regardless of when it happened?',
    );
    expect(agents).toContain('guidance, not a validation rule');
    expect(agents).toContain('shipbench task comment <slug>');
    expect(agents).toContain('shipbench task comment edit <slug> <index>');
    expect(agents).toContain('shipbench task comment delete <slug> <index>');
    expect(agents).toContain("Editing never changes the entry's timestamp");
    expect(agents).toContain(
      'Do not hand-edit content below the `## Task Updates` marker',
    );
  });

  it('writes a welcome task with timestamps from the moment init is called', async () => {
    const adapter = memoryAdapter();
    const before = Date.now();
    await initProject(adapter, { name: 'Test Project' });
    const after = Date.now();

    const raw = adapter.files.get('.shipbench/tasks/welcome-to-shipbench.md');
    expect(raw).toBeDefined();
    const { data } = matter(raw!);
    // js-yaml parses unquoted ISO timestamps into Date objects; handle both.
    const toMs = (v: unknown) =>
      v instanceof Date ? v.getTime() : Date.parse(v as string);
    const created = toMs(data.created);
    const updated = toMs(data.updated);

    expect(created).toBeGreaterThanOrEqual(before);
    expect(created).toBeLessThanOrEqual(after);
    expect(updated).toBe(created);
  });

  it('writes a welcome task whose status matches the default column', async () => {
    const adapter = memoryAdapter();
    await initProject(adapter, { name: 'Test Project' });
    const { data } = matter(
      adapter.files.get('.shipbench/tasks/welcome-to-shipbench.md') ?? '',
    );
    expect(data.status).toBe(DEFAULT_CONFIG.default_column);
  });

  it('leaves every existing ShipBench file byte-for-byte unchanged', async () => {
    const adapter = memoryAdapter();
    await initProject(adapter, { name: 'Original Name' });
    adapter.files.set('.shipbench/README.md', '# Hand-written README\r\n');
    adapter.files.set(
      '.shipbench/tasks/custom.md',
      '---\r\ntitle: Custom\r\nstatus: todo\r\ncreated: 2026-01-01T00:00:00.000Z\r\nupdated: 2026-01-01T00:00:00.000Z\r\n---\r\n\r\nCustom body.\r\n',
    );
    const before = new Map(adapter.files);

    const result = await initProject(adapter, { name: 'Ignored Name' });

    expect(result.created).toBe(false);
    expect(adapter.files).toEqual(before);
  });

  it('treats a valid partial config as an initialized project', async () => {
    const adapter = memoryAdapter();
    adapter.files.set('.shipbench/config.json', '{}\n');

    const state = await inspectProjectInitialization(adapter);

    expect(state).toMatchObject({
      kind: 'initialized',
      config: { name: DEFAULT_CONFIG.name },
    });
    await expect(
      initProject(adapter, { name: 'Do Not Write' }),
    ).resolves.toMatchObject({ created: false });
    expect(adapter.files).toEqual(
      new Map([['.shipbench/config.json', '{}\n']]),
    );
  });

  it('accepts an initialized project with missing support files', async () => {
    const adapter = memoryAdapter();
    adapter.files.set(
      '.shipbench/config.json',
      `${JSON.stringify({ name: 'Minimal' })}\n`,
    );

    await expect(inspectProjectInitialization(adapter)).resolves.toMatchObject({
      kind: 'initialized',
      config: { name: 'Minimal' },
    });
  });

  it.each([
    '.shipbench/README.md',
    '.shipbench/AGENTS.md',
    '.shipbench/layout.json',
    '.shipbench/tasks/orphan.md',
  ])('rejects an incomplete project containing %s without writing', async path => {
    const adapter = memoryAdapter();
    adapter.files.set(path, path.endsWith('.json') ? '{}\n' : 'original');
    const before = new Map(adapter.files);

    await expect(
      initProject(adapter, { name: 'Unsafe' }),
    ).rejects.toMatchObject({
      name: 'ProjectInitializationError',
      state: { kind: 'incomplete' },
    });
    expect(adapter.files).toEqual(before);
  });

  it('classifies malformed config JSON without writing', async () => {
    const adapter = memoryAdapter();
    adapter.files.set('.shipbench/config.json', '{"name":');
    const before = new Map(adapter.files);

    const state = await inspectProjectInitialization(adapter);

    expect(state).toMatchObject({ kind: 'malformed' });
    await expect(
      initProject(adapter, { name: 'Unsafe' }),
    ).rejects.toBeInstanceOf(ProjectInitializationError);
    expect(adapter.files).toEqual(before);
  });

  it('ignores malformed layout JSON with a warning and without writing', async () => {
    const adapter = memoryAdapter();
    adapter.files.set('.shipbench/config.json', '{}\n');
    adapter.files.set('.shipbench/layout.json', '{"todo":');
    const before = new Map(adapter.files);

    await expect(inspectProjectInitialization(adapter)).resolves.toMatchObject({
      kind: 'initialized',
      config: { layout: {} },
      warnings: [
        expect.objectContaining({
          path: '.shipbench/layout.json',
          message: expect.stringMatching(/fallback order/i),
        }),
      ],
    });
    await expect(
      initProject(adapter, { name: 'Unsafe' }),
    ).resolves.toMatchObject({
      created: false,
      config: { layout: {} },
    });
    expect(adapter.files).toEqual(before);
  });

  it('classifies a resolved config that fails validation without writing', async () => {
    const adapter = memoryAdapter();
    adapter.files.set(
      '.shipbench/config.json',
      `${JSON.stringify({ done_column: 'missing' })}\n`,
    );
    const before = new Map(adapter.files);

    await expect(inspectProjectInitialization(adapter)).resolves.toMatchObject({
      kind: 'invalid',
      errors: [expect.stringMatching(/done_column/i)],
    });
    await expect(
      initProject(adapter, { name: 'Unsafe' }),
    ).rejects.toBeInstanceOf(ProjectInitializationError);
    expect(adapter.files).toEqual(before);
  });

  it('returns ordinary task read warnings for an initialized project', async () => {
    const adapter = memoryAdapter();
    await initProject(adapter, { name: 'Warnings' });
    adapter.files.set(
      '.shipbench/tasks/warning.md',
      `---
title: Warning
status: unknown
priority: urgent
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-01T00:00:00.000Z
---
`,
    );

    const state = await inspectProjectInitialization(adapter);

    expect(state).toMatchObject({ kind: 'initialized' });
    if (state.kind === 'initialized') {
      expect(state.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ slug: 'warning', field: 'status' }),
          expect.objectContaining({ slug: 'warning', field: 'priority' }),
        ]),
      );
    }
  });
});
