/**
 * ANSI styling, restricted to the 16-colour palette and SGR attributes.
 *
 * Every slot here is one the user's terminal theme remaps, so a semantic choice
 * ("warning") renders in a hue that is legible against their background by
 * construction. No hex, no truecolor, and no background colour is ever set —
 * the terminal's own ground shows through, which is what makes light-vs-dark a
 * non-question.
 *
 * Escapes are written as `\x1b`, never as a literal ESC byte in the source. The
 * first version of this file embedded real control characters; one of them was
 * lost editing an adjacent template literal, and the result was a frame that
 * printed `[1;1H` as text in Windows Terminal. An invisible byte is not
 * reviewable.
 */

export interface StyleOptions {
  /** False drops every escape sequence and returns plain text. */
  color: boolean;
}

/**
 * Three slots, and the emptiness of the rest is the design. The doctrine's
 * `accent` role is *doing* emphasis — focus, selection, the primary action — and
 * a view that takes no input has none of those; `danger` needs a destructive
 * state and `success` would colour status, which this palette does not do.
 * `reverse` is the only attribute that paints a background, so it stays out for
 * the same reason no background colour is ever set.
 */
const CODES = {
  bold: 1,
  dim: 2,
  yellow: 33,
} as const;

export type StyleName = keyof typeof CODES;

export function createStyler(options: StyleOptions) {
  return function wrap(text: string, ...names: StyleName[]): string {
    if (!options.color || names.length === 0 || text === '') return text;
    const codes = names.map(name => CODES[name]).join(';');
    return `\x1b[${codes}m${text}\x1b[0m`;
  };
}

export type Styler = ReturnType<typeof createStyler>;

/** Strip SGR sequences. Used for width arithmetic over already-styled parts. */
export function stripSgr(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching the ESC byte is the entire job of an SGR stripper.
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

export const ESC = {
  altScreenEnter: '\x1b[?1049h',
  altScreenExit: '\x1b[?1049l',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  home: '\x1b[H',
  eraseLine: '\x1b[K',
  eraseBelow: '\x1b[J',
  eraseScreen: '\x1b[2J',
  reset: '\x1b[0m',
  /**
   * DECSET 2026. Windows Terminal, iTerm2, WezTerm, Kitty and Ghostty coalesce
   * everything between these into one frame; terminals that do not know the mode
   * ignore both, so a repaint is never worse than unsynchronised.
   */
  syncStart: '\x1b[?2026h',
  syncEnd: '\x1b[?2026l',
  /** Suppress line wrap so a full-width row cannot spill a phantom blank line. */
  noWrap: '\x1b[?7l',
  wrap: '\x1b[?7h',
} as const;

/** Absolute cursor position, 1-based. */
export function cursorTo(row: number, column = 1): string {
  return `\x1b[${row};${column}H`;
}

export const BOX = {
  rule: '─',
  vertical: '│',
  /** Filled step of the priority meter — the doctrine's chevron primitive. */
  chevron: '›',
  /**
   * The meter's empty track. A *different character*, not just a dim chevron:
   * under `NO_COLOR` every attribute vanishes, and a meter drawn only in
   * attributes reads as three identical chevrons at every priority.
   */
  track: '·',
  dot: '·',
  /** Planned dependency order, deliberately distinct from the warning glyph. */
  waiting: '~',
  warn: '!',
} as const;
