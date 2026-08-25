/**
 * Whether ANSI styling is safe for output associated with stdout.
 *
 * A redirected stdout is an absolute stop: FORCE_COLOR never puts control
 * sequences into a pipe. NO_COLOR also wins whenever it is present, including
 * when its value is the empty string.
 */
export function shouldUseColor(
  env: NodeJS.ProcessEnv,
  isStdoutTty: boolean,
): boolean {
  if (!isStdoutTty) return false;
  if (env.NO_COLOR !== undefined) return false;
  if (env.FORCE_COLOR !== undefined) return env.FORCE_COLOR !== '0';
  if (env.TERM === 'dumb') return false;
  return true;
}
