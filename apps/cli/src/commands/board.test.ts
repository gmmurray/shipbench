import { describe, expect, it } from 'vitest';
import { createCli } from '../cli.js';
import { formatMissingBoard } from '../output.js';
import { harness, memoryAdapter } from './testing.js';

describe('shipbench board terminal', () => {
  // Both board views check for a board before touching the screen or a port,
  // so an unscaffolded project is the one path this suite can drive without a
  // terminal — which is also the path that has to agree with `board`.
  const MISSING = formatMissingBoard(`in ${process.cwd()}`);

  it('fails outside a project in the same words as the browser board', async () => {
    await expect(harness().run('board', 'terminal')).rejects.toThrow(MISSING);
    await expect(harness().run('board', '--no-open')).rejects.toThrow(MISSING);
  });

  it.each(['term', 'tui'])('resolves the %s alias', async alias => {
    const h = harness();
    await expect(h.run('board', alias)).rejects.toThrow(MISSING);
  });

  it('gives each surface its own option set', async () => {
    const program = createCli({
      adapter: memoryAdapter(),
      defaultProjectName: 'test-project',
      out: () => {},
      err: () => {},
      exitOverride: true,
    });
    const board = program.commands.find(command => command.name() === 'board');
    expect(board?.commands.map(command => command.name())).toEqual([
      'web',
      'terminal',
    ]);
    const flags = (name: string) =>
      board?.commands
        .find(command => command.name() === name)
        ?.options.map(option => option.long);
    expect(flags('web')).toEqual(['--port', '--no-open']);
    expect(flags('terminal')).toEqual([
      '--status',
      '--assignee',
      '--priority',
      '--tag',
      '--exclude-tag',
      '--flagged',
    ]);
    // The browser flags live on `web` alone; bare `board` reaches them because
    // `web` is the default subcommand, not because they are declared twice.
    expect(board?.options).toEqual([]);
  });
});
