/**
 * The declared palette, parsed out of docs/design-doctrine.md.
 *
 * **Why parse the prose instead of transcribing it.** The task this suite came
 * from asks that "a doctrine edit that breaks a bar fails a test". A
 * hand-copied fixture cannot do that — it would keep asserting the old values
 * while the doctrine said something else, which is exactly the staleness this
 * suite exists to prevent. So the Markdown tables are the source of truth and
 * every other copy in the repo is checked against them.
 *
 * The cost is a parser coupled to table formatting. That is paid for by
 * `assertPaletteShape`, which fails loudly if the tables stop yielding exactly
 * the token set we expect — a reformat breaks the build rather than silently
 * reducing this suite to testing nothing.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DOCTRINE_PATH = fileURLToPath(
  new URL('../../docs/design-doctrine.md', import.meta.url),
);

export type ThemeName = 'dark' | 'light';

/**
 * Canonical token keys. The doctrine spells them exactly this way; the three
 * CSS implementations each prefix and occasionally re-kebab them (see
 * surfaces.ts), which is why this list is the vocabulary everything maps into.
 */
export const TOKENS = [
  'canvas',
  'surface',
  'surface2',
  'divider',
  'iron',
  'ironlit',
  'silver',
  'frosted',
  'accent',
  'accent-hover',
  'accent-pressed',
  'danger',
  'success',
  'warning',
] as const;

export type TokenName = (typeof TOKENS)[number];

/** The three neutral grounds every foreground is measured against. */
export const GROUNDS = [
  'canvas',
  'surface',
  'surface2',
] as const satisfies readonly TokenName[];

export type Palette = Record<TokenName, string>;

/**
 * Rows look like:
 *   | `canvas` | `#18171C` | `#ECEDF2` | Page background. |
 *
 * Rows whose value columns are not hex (`accent-soft` is "accent @ 13%") are
 * skipped on purpose: they are derived with color-mix at runtime and have no
 * fixed value to check.
 */
const ROW =
  /^\|\s*`([a-z0-9-]+)`\s*\|\s*`(#[0-9a-fA-F]{3,6})`\s*\|\s*`(#[0-9a-fA-F]{3,6})`\s*\|/gm;

export function parseDoctrinePalette(
  markdown: string = readFileSync(DOCTRINE_PATH, 'utf8'),
): Record<ThemeName, Palette> {
  const dark: Record<string, string> = {};
  const light: Record<string, string> = {};

  ROW.lastIndex = 0;
  let match: RegExpExecArray | null = ROW.exec(markdown);
  while (match !== null) {
    const [, token, darkHex, lightHex] = match;
    dark[token] = darkHex.toLowerCase();
    light[token] = lightHex.toLowerCase();
    match = ROW.exec(markdown);
  }

  return {
    dark: dark as Palette,
    light: light as Palette,
  };
}

/**
 * Guard against silent parser rot. If the doctrine's tables are reformatted,
 * renamed, or split, this is what turns that into a failure instead of an
 * empty-but-green suite.
 */
export function assertPaletteShape(palette: Record<ThemeName, Palette>): void {
  for (const theme of ['dark', 'light'] as const) {
    const found = Object.keys(palette[theme]).sort();
    const expected = [...TOKENS].sort();
    if (found.join(',') !== expected.join(',')) {
      const missing = expected.filter(name => !found.includes(name));
      const extra = found.filter(name => !expected.includes(name as TokenName));
      throw new Error(
        `The ${theme} palette parsed out of the doctrine does not match the expected token set.\n` +
          `  missing: ${missing.join(', ') || '(none)'}\n` +
          `  unexpected: ${extra.join(', ') || '(none)'}\n` +
          'Either a token was added/removed (update TOKENS in doctrine.ts) or the ' +
          'Palette tables in docs/design-doctrine.md changed shape (update ROW).',
      );
    }
  }
}
