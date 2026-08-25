/**
 * WCAG 2.x relative luminance and contrast ratio.
 *
 * Deliberately dependency-free and ~30 lines: the whole point of this suite is
 * that the doctrine's numeric claims are checkable, and a claim checked by a
 * black box you did not read is not much better than a claim checked by hand.
 *
 * - Relative luminance: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
 * - Contrast ratio:     https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb {
  const raw = hex.trim().replace(/^#/, '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map(char => char + char)
          .join('')
      : raw;

  if (!/^[0-9a-f]{6}$/i.test(full)) {
    throw new Error(`not a 6-digit hex color: ${JSON.stringify(hex)}`);
  }

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

/**
 * sRGB → linear light. The 0.04045 knee is the WCAG 2.1/2.2 value; WCAG 2.0
 * printed 0.03928. No color in this palette lands between the two, so the
 * choice is immaterial here — but it is the current one.
 */
function linearize(component: number): number {
  const c = component / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Two decimal places — the precision the doctrine and the audit quote. */
export function ratio(a: string, b: string): number {
  return Math.round(contrastRatio(a, b) * 100) / 100;
}
