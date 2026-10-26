export type CliExitCode = 2;

export class CliExitError extends Error {
  constructor(
    message: string,
    public readonly exitCode: CliExitCode,
  ) {
    super(message);
    this.name = 'CliExitError';
  }
}
