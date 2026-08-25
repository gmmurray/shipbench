/**
 * Reading the four theme states out of a hand-authored CSS file.
 *
 * The theming model (docs/design-doctrine.md › Theming) is three user-facing
 * states expressed as four CSS blocks, and the fourth is the one that catches
 * people out:
 *
 *   default         — dark values on the base selector
 *   media-light     — `:root:not([data-theme])` inside a light media query
 *   explicit-light  — `:root[data-theme="light"]`
 *   explicit-dark   — `:root[data-theme="dark"]`, which is NOT redundant with
 *                     the default: without it, forcing dark on a light-OS
 *                     machine loses to the media query
 *
 * A token defined in three of the four leaks the wrong value on toggle, and
 * only for users on one particular OS setting. That is close to undiscoverable
 * by hand, and it is the whole reason the parity test exists.
 */

export type ThemeState =
  | 'default'
  | 'media-light'
  | 'explicit-light'
  | 'explicit-dark';

export const THEME_STATES: readonly ThemeState[] = [
  'default',
  'media-light',
  'explicit-light',
  'explicit-dark',
];

/** Which state each block is expected to carry the values of. */
export const STATE_THEME: Record<ThemeState, 'dark' | 'light'> = {
  default: 'dark',
  'media-light': 'light',
  'explicit-light': 'light',
  'explicit-dark': 'dark',
};

/** Comments mention `:root` in prose; strip them before matching selectors. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Balanced-brace slice starting at the `{` on or after `from`. */
function blockAt(css: string, from: number): { body: string; end: number } {
  const open = css.indexOf('{', from);
  if (open === -1) throw new Error('no block found');

  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return { body: css.slice(open + 1, i), end: i };
    }
  }
  throw new Error('unbalanced braces');
}

/**
 * Every block whose header matches, concatenated. Concatenation is the correct
 * model: CSS cascades, so two `:root` blocks in one file are one effective
 * declaration set. The site relies on this — it declares the palette in one
 * `:root` and the color-mix derivations in another.
 */
function blocksMatching(css: string, header: RegExp): string[] {
  const re = new RegExp(
    header.source,
    header.flags.includes('g') ? header.flags : `${header.flags}g`,
  );
  const bodies: string[] = [];

  let match: RegExpExecArray | null = re.exec(css);
  while (match !== null) {
    const { body, end } = blockAt(css, match.index + match[0].length - 1);
    bodies.push(body);
    re.lastIndex = end;
    match = re.exec(css);
  }

  return bodies;
}

/** Custom-property declarations in a block body, name (no `--`) → raw value. */
function declarations(body: string): Map<string, string> {
  const found = new Map<string, string>();
  const re = /--([a-z0-9-]+)\s*:\s*([^;{}]+);/gi;

  let match: RegExpExecArray | null = re.exec(body);
  while (match !== null) {
    found.set(match[1].toLowerCase(), match[2].trim().toLowerCase());
    match = re.exec(body);
  }

  return found;
}

function merge(bodies: string[]): Map<string, string> {
  const merged = new Map<string, string>();
  for (const body of bodies) {
    for (const [name, value] of declarations(body)) merged.set(name, value);
  }
  return merged;
}

export interface ReadOptions {
  /**
   * Where the dark defaults live. Harbor puts them in Tailwind's `@theme`
   * at-rule; the site and Board use a plain `:root`.
   */
  defaultBlock: 'root' | 'theme';
}

export function readThemeStates(
  source: string,
  options: ReadOptions,
): Record<ThemeState, Map<string, string>> {
  const css = stripComments(source);

  // `@theme\s*\{` deliberately does not match `@theme inline {`, which holds
  // font aliases rather than palette values.
  const defaultHeader =
    options.defaultBlock === 'theme' ? /@theme\s*\{/g : /:root\s*\{/g;

  const mediaBlocks = blocksMatching(
    css,
    /@media\s*\(\s*prefers-color-scheme\s*:\s*light\s*\)\s*\{/g,
  );

  return {
    default: merge(blocksMatching(css, defaultHeader)),
    'media-light': merge(
      mediaBlocks.flatMap(body =>
        blocksMatching(body, /:root:not\(\[data-theme\]\)\s*\{/g),
      ),
    ),
    'explicit-light': merge(
      blocksMatching(css, /:root\[data-theme=["']light["']\]\s*\{/g),
    ),
    'explicit-dark': merge(
      blocksMatching(css, /:root\[data-theme=["']dark["']\]\s*\{/g),
    ),
  };
}
