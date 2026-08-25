/**
 * The places in this repo where the palette is implemented.
 *
 * The doctrine says "tokens are the theming seam" and each surface exposes that
 * seam in its own idiom — the site as plain custom properties, the Board as
 * `--sb-*` so it can be embedded in a host page without colliding. Two
 * prefixes, one palette.
 *
 * Testing only one of them would prove nothing about the other, which is the
 * trap this file exists to avoid: every surface is checked against the
 * doctrine, so drift between any two of them is caught transitively.
 *
 * Harbor implements the same doctrine as Tailwind `@theme` tokens, but it lives
 * in its own repository now and carries its own copy of this check. Both sides
 * are measured against `docs/design-doctrine.md`, which is the shared artifact
 * — not against each other.
 */

import { fileURLToPath } from 'node:url';
import type { ReadOptions } from './css-tokens.js';
import type { TokenName } from './doctrine.js';

export interface Surface extends ReadOptions {
  name: string;
  /** For failure messages — repo-relative reads better than an absolute path. */
  label: string;
  path: string;
  /** Canonical token → the custom-property name in this file, minus `--`. */
  cssName(token: TokenName): string;
}

function repoPath(relative: string): string {
  return fileURLToPath(new URL(`../../${relative}`, import.meta.url));
}

export const SURFACES: readonly Surface[] = [
  {
    name: 'site',
    label: 'apps/site/src/styles/tokens.css',
    path: repoPath('apps/site/src/styles/tokens.css'),
    defaultBlock: 'root',
    // The site once spelled two tokens `--surface-2` / `--iron-lit`, absorbed
    // here by a mapping table. They were renamed to match the other
    // surfaces, so the identity mapping is now the whole story — one prefix
    // per surface, one spelling. Do not re-add a per-surface alias: a mapping
    // table is what let the drift live unnoticed in the first place.
    cssName: token => token,
  },
  {
    name: 'board',
    label: 'packages/board/src/styles.css',
    path: repoPath('packages/board/src/styles.css'),
    defaultBlock: 'root',
    cssName: token => `sb-${token}`,
  },
];
