/**
 * Display-width arithmetic.
 *
 * The range table below is hand-rolled on purpose. `get-east-asian-width` would
 * do the same job with a generated table, and it was considered and rejected:
 * adding zero packages is the load-bearing claim behind building this renderer
 * without a TUI framework at all, and it should stay literally true of the
 * shipped CLI. The cost of keeping it is that the table is covered by tests
 * rather than by upstream maintenance.
 *
 * Everything here operates on *plain* text. Styling is applied after
 * truncation/padding so no escape sequence is ever counted as a column or cut in
 * half — see style.ts.
 */

const WIDE = /[ᄀ-ᅟ〈〉⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︐-︙︰-﹯＀-｠￠-￦]/u;

/** Combining marks and zero-width joiners occupy no cell. */
const ZERO_WIDTH = /[̀-ͯ​-‏⁠﻿]/u;

export const ELLIPSIS = '…';

export function charWidth(char: string): number {
  if (ZERO_WIDTH.test(char)) return 0;
  const code = char.codePointAt(0) ?? 0;
  // Control characters never reach the renderer; treat them as width 0 rather
  // than letting them silently shift a column.
  if (code < 0x20 || code === 0x7f) return 0;
  if (WIDE.test(char)) return 2;
  // Astral-plane symbols (emoji, most dingbats) are inconsistently sized across
  // terminals, which is exactly why the doctrine bans them from aligned layouts.
  // Count them as 2 so a stray one shrinks rather than overflows a column.
  if (code > 0xffff) return 2;
  return 1;
}

export function displayWidth(text: string): number {
  let total = 0;
  for (const char of text) total += charWidth(char);
  return total;
}

/**
 * Cut `text` to at most `limit` display columns, appending a single-cell
 * ellipsis when anything was removed.
 *
 * The cut falls at the end: task titles on real boards are front-loaded
 * ("Harbor first-run onboarding cohesion pass…"), so keeping the prefix keeps
 * the identifying words. Trailing whitespace and separator punctuation are
 * trimmed before the ellipsis so a cut never reads as "word …".
 */
export function truncate(text: string, limit: number): string {
  if (limit <= 0) return '';
  if (displayWidth(text) <= limit) return text;
  if (limit === 1) return ELLIPSIS;

  let out = '';
  let used = 0;
  for (const char of text) {
    const next = used + charWidth(char);
    if (next > limit - 1) break;
    out += char;
    used = next;
  }
  return `${out.replace(/[\s(\-–—:,.·/]+$/u, '')}${ELLIPSIS}`;
}

/** Pad to exactly `width` display columns. Truncates when over. */
export function fit(text: string, width: number): string {
  const cut = truncate(text, width);
  return cut + ' '.repeat(Math.max(0, width - displayWidth(cut)));
}

/** Left text and right text on one line of exactly `width`, gap-separated. */
export function fitBetween(
  left: string,
  right: string,
  width: number,
  minGap = 1,
): string {
  if (width <= 0) return '';
  const rightWidth = displayWidth(right);
  if (rightWidth + minGap >= width) return fit(left, width);
  const leftRoom = width - rightWidth - minGap;
  const cutLeft = truncate(left, leftRoom);
  const gap = width - displayWidth(cutLeft) - rightWidth;
  return `${cutLeft}${' '.repeat(gap)}${right}`;
}
