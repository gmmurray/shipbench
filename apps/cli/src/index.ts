#!/usr/bin/env node

import { CliExitError } from './harborConnect.js';
import { createProcessCli } from './processCli.js';

async function main(): Promise<void> {
  await createProcessCli({
    argv: process.argv,
    shellCwd: process.cwd(),
    exitOverride: true,
  }).parseAsync(process.argv);
}

main().catch(error => {
  const code =
    typeof error === 'object' &&
    error !== null &&
    typeof error.code === 'string'
      ? error.code
      : null;
  const isCommanderSignal = code?.startsWith('commander.') === true;
  if (!isCommanderSignal) {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode =
    error instanceof CliExitError
      ? error.exitCode
      : isCommanderSignal
        ? error.exitCode === 0
          ? 0
          : 2
        : 1;
});
