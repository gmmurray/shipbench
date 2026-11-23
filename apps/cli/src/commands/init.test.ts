import { describe, expect, it } from 'vitest';
import { harness } from './testing.js';

describe('shipbench init', () => {
  it('scaffolds the .shipbench/ directory using the default project name', async () => {
    const h = harness();
    await h.run('init');
    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual([
      'Initialized .shipbench/ for "test-project" in current directory.',
      '',
      'Next steps:',
      '  1. Create a task: shipbench task create "My first task"',
      '  2. Open the board: shipbench board',
      '  3. Read .shipbench/README.md to learn the project workflow.',
    ]);
    const config = JSON.parse(
      h.adapter.files.get('.shipbench/config.json') ?? '{}',
    );
    expect(config.name).toBe('test-project');
    expect(config).not.toHaveProperty('layout');
    expect(h.adapter.files.get('.shipbench/layout.json')).toBe('{}\n');
    expect(h.adapter.files.has('.shipbench/README.md')).toBe(true);
    expect(h.adapter.files.has('.shipbench/AGENTS.md')).toBe(true);
    expect(
      h.adapter.files.has('.shipbench/tasks/welcome-to-shipbench.md'),
    ).toBe(true);
  });

  it('shows the wordmark only when stdout is an interactive color terminal', async () => {
    const interactive = harness(undefined, {
      isInteractive: true,
      env: {},
    });
    await interactive.run('init');
    expect(interactive.stderr[0]).toBe('\x1b[1;34mSHIPBENCH CLI\x1b[0m');

    const noColor = harness(undefined, {
      isInteractive: true,
      env: { NO_COLOR: '' },
    });
    await noColor.run('init');
    expect(noColor.stderr[0]).toBe(
      'Initialized .shipbench/ for "test-project" in current directory.',
    );
    expect(noColor.stderr.join('\n')).not.toContain('\x1b[');
  });

  it('uses --name to override the default project name', async () => {
    const h = harness();
    await h.run('init', '--name', 'Acme Widgets');
    const config = JSON.parse(
      h.adapter.files.get('.shipbench/config.json') ?? '{}',
    );
    expect(config.name).toBe('Acme Widgets');
  });

  it('keeps an existing project readable and warns about malformed layout metadata', async () => {
    const h = harness({
      '.shipbench/config.json': '{}\n',
      '.shipbench/layout.json': '{"todo":',
    });

    await h.run('init');

    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual([
      expect.stringMatching(
        /Warning: \.shipbench\/layout\.json:.*fallback order/i,
      ),
      'ShipBench is already initialized for "Untitled Project".',
    ]);
  });

  it('reports a no-op and preserves every byte on repeated init', async () => {
    const h = harness();
    await h.run('init');
    h.adapter.files.set('.shipbench/README.md', '# Custom\r\n');
    const before = new Map(h.adapter.files);
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run('init');

    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual([
      'ShipBench is already initialized for "test-project".',
      '.shipbench/README.md records no ShipBench version.',
      'To update without losing your edits, see https://shipbench.dev/docs/upgrading/',
    ]);
    expect(h.adapter.files).toEqual(before);
  });

  it('rejects an explicit --name mismatch without writing', async () => {
    const h = harness();
    await h.run('init');
    const before = new Map(h.adapter.files);

    await expect(h.run('init', '--name=Another Name')).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('ShipBench files were not modified.'),
    });

    expect(h.adapter.files).toEqual(before);
  });

  it('rejects an incomplete project without writing', async () => {
    const h = harness({
      '.shipbench/README.md': '# Existing partial project\r\n',
    });
    const before = new Map(h.adapter.files);

    await expect(h.run('init')).rejects.toMatchObject({ exitCode: 2 });

    expect(h.adapter.files).toEqual(before);
  });

  it('stamps the scaffold with the running version', async () => {
    const h = harness(undefined, { version: '0.11.0' });
    await h.run('init');
    expect(h.adapter.files.get('.shipbench/AGENTS.md')).toMatch(
      /^<!-- shipbench-scaffold 0[.]11[.]0: /,
    );
    expect(h.adapter.files.get('.shipbench/README.md')).toMatch(
      /^<!-- shipbench-scaffold 0[.]11[.]0: /,
    );
  });

  it('names scaffold files that are behind or unstamped, without writing', async () => {
    const earlier = harness(undefined, { version: '0.4.0' });
    await earlier.run('init');
    const files = Object.fromEntries(earlier.adapter.files);
    files['.shipbench/README.md'] = '# Rewritten without the stamp\n';
    const h = harness(files, { version: '0.11.0' });
    const before = new Map(h.adapter.files);

    await h.run('init');

    expect(h.stderr).toEqual([
      'ShipBench is already initialized for "test-project".',
      '.shipbench/README.md records no ShipBench version.',
      '.shipbench/AGENTS.md was written by ShipBench 0.4.0; this is 0.11.0.',
      'To update without losing your edits, see https://shipbench.dev/docs/upgrading/',
    ]);
    expect(h.adapter.files).toEqual(before);
  });

  it('says nothing about scaffold files the running version wrote', async () => {
    const current = harness(undefined, { version: '0.11.0' });
    await current.run('init');
    const h = harness(Object.fromEntries(current.adapter.files), {
      version: '0.11.0',
    });

    await h.run('init');

    expect(h.stderr).toEqual([
      'ShipBench is already initialized for "test-project".',
    ]);
  });

  it('no longer accepts --harbor', async () => {
    const h = harness();

    await expect(
      h.run('init', '--harbor=https://example.com/connect'),
    ).rejects.toMatchObject({ code: 'commander.unknownOption' });
    expect(h.adapter.files.size).toBe(0);
  });
});
