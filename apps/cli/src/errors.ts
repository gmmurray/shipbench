/** `1`: a check ran and found problems. `2`: the command could not run as asked. */
export type CliExitCode = 1 | 2;

export class CliExitError extends Error {
  constructor(
    message: string,
    public readonly exitCode: CliExitCode,
  ) {
    super(message);
    this.name = 'CliExitError';
  }
}
