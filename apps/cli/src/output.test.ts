import { describe, expect, it } from 'vitest';
import {
  createCliOutput,
  formatBoardStatus,
  formatInitNextSteps,
} from './output.js';

function harness(
  options: { isStdoutTty?: boolean; env?: NodeJS.ProcessEnv } = {},
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const output = createCliOutput({
    writeData: line => stdout.push(line),
    writeChrome: line => stderr.push(line),
    isStdoutTty: options.isStdoutTty ?? false,
    env: options.env ?? {},
  });
  return { output, stdout, stderr };
}

describe('createCliOutput', () => {
  it('keeps data on stdout and chrome on stderr', () => {
    const h = harness();

    h.output.data('{"tasks":[]}');
    h.output.chrome('Created task: example');
    h.output.warning('example.md: invalid status');

    expect(h.stdout).toEqual(['{"tasks":[]}']);
    expect(h.stderr).toEqual([
      'Created task: example',
      'Warning: example.md: invalid status',
    ]);
  });

  it('emits the wordmark only when color is safe', () => {
    const interactive = harness({ isStdoutTty: true });
    interactive.output.brand();
    expect(interactive.stderr).toEqual(['\x1b[1;34mSHIPBENCH CLI\x1b[0m']);

    const redirected = harness({
      isStdoutTty: false,
      env: { FORCE_COLOR: '1' },
    });
    redirected.output.brand();
    expect(redirected.stderr).toEqual([]);

    const noColor = harness({ isStdoutTty: true, env: { NO_COLOR: '' } });
    noColor.output.brand();
    expect(noColor.stderr).toEqual([]);
  });
});

describe('ceremonial command copy', () => {
  it('gives a new local project three concrete next steps', () => {
    expect(formatInitNextSteps(false)).toEqual([
      '',
      'Next steps:',
      '  1. Create a task: shipbench task create "My first task"',
      '  2. Open the board: shipbench board',
      '  3. Read .shipbench/README.md to learn the project workflow.',
    ]);
  });

  it('closes Harbor initialization with a Harbor-specific step', () => {
    expect(formatInitNextSteps(true).at(-1)).toBe(
      '  3. Open Harbor to view this ShipBench project.',
    );
  });

  it('ends board startup output with the shutdown action', () => {
    expect(formatBoardStatus('http://127.0.0.1:4321/', '/repo')).toEqual([
      'Board ready at http://127.0.0.1:4321/',
      'Serving .shipbench/ from /repo',
      'Press Ctrl+C to stop the server.',
    ]);
  });
});
