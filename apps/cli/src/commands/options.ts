import { InvalidArgumentError } from 'commander';

export function commaList(value: string): string[] {
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/** Supports both `--depends-on a,b` and a repeated `--depends-on a --depends-on b`. */
export function accumulateCommaList(
  value: string,
  previous?: string[],
): string[] {
  return [...(previous ?? []), ...commaList(value)];
}

/** Case-insensitive dedupe that keeps the first spelling of each value. */
export function dedupePreservingCase(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

export function parseNonNegativeInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidArgumentError('Value must be a non-negative integer.');
  }
  return parsed;
}
