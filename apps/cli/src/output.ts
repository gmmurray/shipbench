import { shouldUseColor } from './terminal.js';

export interface CliOutputOptions {
  writeData: (line: string) => void;
  writeChrome: (line: string) => void;
  isStdoutTty: boolean;
  env: NodeJS.ProcessEnv;
}

export function formatInitNextSteps(harborConnected: boolean): string[] {
  return [
    '',
    'Next steps:',
    '  1. Create a task: shipbench task create "My first task"',
    '  2. Open the board: shipbench board',
    harborConnected
      ? '  3. Open Harbor to view this ShipBench project.'
      : '  3. Read .shipbench/README.md to learn the project workflow.',
  ];
}

export function formatBoardStatus(url: string, cwd: string): string[] {
  return [
    `Board ready at ${url}`,
    `Serving .shipbench/ from ${cwd}`,
    'Press Ctrl+C to stop the server.',
  ];
}

/**
 * Owns the CLI's public stream contract.
 *
 * Data is stable, undecorated stdout. Human-facing chrome is stderr. Brand
 * decoration is optional and only appears when ANSI output is safe.
 */
export function createCliOutput(options: CliOutputOptions) {
  const color = shouldUseColor(options.env, options.isStdoutTty);

  return {
    data: options.writeData,
    chrome: options.writeChrome,
    warning(message: string): void {
      options.writeChrome(`Warning: ${message}`);
    },
    brand(): void {
      if (!color) return;
      options.writeChrome('\x1b[1;34mSHIPBENCH CLI\x1b[0m');
    },
  };
}
