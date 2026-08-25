/**
 * The doctrine's contrast claims, made executable.
 *
 * Every bar here is quoted from docs/design-doctrine.md › Palette. Nothing is
 * invented and nothing is relaxed: where the doctrine records a *failing* pair
 * as a deliberate caveat, this pins the measured value rather than lowering the
 * bar, so the caveat cannot quietly get worse — or quietly get fixed without
 * the prose being updated.
 *
 * This math has been done by hand twice (the 2026-07-18 audit, then the
 * light-theme work) and gone stale once in between. That is what this replaces.
 */

import { describe, expect, it } from 'vitest';
import {
  assertPaletteShape,
  GROUNDS,
  parseDoctrinePalette,
  type ThemeName,
} from './doctrine.js';
import { ratio, relativeLuminance } from './wcag.js';

/** WCAG 1.4.3, normal-size text. */
const TEXT_BAR = 4.5;
/** WCAG 1.4.11, non-text (borders, control boundaries). */
const STRUCTURAL_BAR = 3;

const palette = parseDoctrinePalette();
const THEMES: ThemeName[] = ['dark', 'light'];

it('the doctrine palette parses to the expected token set', () => {
  // Guards every other test in this file: without it, a reformatted table
  // would leave the suite green and measuring nothing.
  expect(() => assertPaletteShape(palette)).not.toThrow();
});

describe('text contrast — WCAG 1.4.3, needs 4.5:1', () => {
  // Doctrine: silver/frosted are the text tokens; danger/success/warning "all
  // clear 4.5:1 as text/icon on canvas, surface, and surface2 in both themes".
  const TEXT_TOKENS = [
    'silver',
    'frosted',
    'danger',
    'success',
    'warning',
  ] as const;

  for (const theme of THEMES) {
    for (const token of TEXT_TOKENS) {
      for (const ground of GROUNDS) {
        it(`${theme}: ${token} on ${ground}`, () => {
          const measured = ratio(palette[theme][token], palette[theme][ground]);
          expect(
            measured,
            `${token} on ${ground} (${theme}) measured ${measured}:1, needs ${TEXT_BAR}:1`,
          ).toBeGreaterThanOrEqual(TEXT_BAR);
        });
      }
    }
  }
});

describe('structural contrast — WCAG 1.4.11, needs 3:1', () => {
  // Doctrine: iron is the structural border and clears ≥3:1 "on every ground".
  // This is the finding the 2026-07-18 audit raised as CRITICAL (iron was then
  // 1.19–1.35:1); fix-structural-contrast-token resolved it. This is the test
  // that keeps it resolved.
  for (const theme of THEMES) {
    for (const ground of GROUNDS) {
      it(`${theme}: iron border on ${ground}`, () => {
        const measured = ratio(palette[theme].iron, palette[theme][ground]);
        expect(
          measured,
          `iron on ${ground} (${theme}) measured ${measured}:1, needs ${STRUCTURAL_BAR}:1`,
        ).toBeGreaterThanOrEqual(STRUCTURAL_BAR);
      });
    }
  }

  // Doctrine: ironlit is "derived from iron — lighter in dark, darker in light,
  // since hover promotes contrast against the ground either way". A hover state
  // that *reduced* contrast would satisfy no numeric bar yet still break the
  // stated rule, so the rule is asserted relationally.
  for (const theme of THEMES) {
    for (const ground of GROUNDS) {
      it(`${theme}: ironlit hover promotes contrast over iron on ${ground}`, () => {
        const base = ratio(palette[theme].iron, palette[theme][ground]);
        const hover = ratio(palette[theme].ironlit, palette[theme][ground]);
        expect(
          hover,
          `hover border on ${ground} (${theme}) went ${base}:1 → ${hover}:1, which lowers contrast`,
        ).toBeGreaterThan(base);
      });
    }
  }
});

describe('accent as text — the documented caveat', () => {
  // Doctrine: accent as text "clears 4.5:1 on canvas and surface in both
  // themes, but on dark surface2 it measures 4.26:1".
  for (const theme of THEMES) {
    for (const ground of ['canvas', 'surface'] as const) {
      it(`${theme}: accent text on ${ground}`, () => {
        const measured = ratio(palette[theme].accent, palette[theme][ground]);
        expect(measured).toBeGreaterThanOrEqual(TEXT_BAR);
      });
    }
  }

  it('light: accent text on surface2 has no gap', () => {
    // Doctrine quotes 5.70:1 here.
    const measured = ratio(palette.light.accent, palette.light.surface2);
    expect(measured).toBeGreaterThanOrEqual(TEXT_BAR);
  });

  it('dark: accent text on surface2 stays at its recorded 4.26:1', () => {
    // Pinned, not relaxed. This pair is *below* the bar and the doctrine says
    // so out loud; the job of this assertion is to make any movement visible.
    // If it improves, that is good news — update the doctrine caveat and this
    // number together. If it degrades, the caveat understates the problem.
    const measured = ratio(palette.dark.accent, palette.dark.surface2);
    expect(
      measured,
      'the documented accent-on-dark-surface2 caveat moved; reconcile ' +
        'docs/design-doctrine.md › Palette with this measurement before changing it here',
    ).toBeCloseTo(4.26, 2);
  });
});

describe('the inversion rule — canvas text on an accent fill', () => {
  // Doctrine: "Accent fills take canvas-colored text — white fails contrast on
  // the dark accent, and canvas passes in both themes (4.82:1 dark, 5.39:1
  // light)."
  const QUOTED = { dark: 4.82, light: 5.39 } as const;

  for (const theme of THEMES) {
    it(`${theme}: canvas on accent`, () => {
      const measured = ratio(palette[theme].canvas, palette[theme].accent);
      expect(measured).toBeGreaterThanOrEqual(TEXT_BAR);
      expect(
        measured,
        `the doctrine quotes ${QUOTED[theme]}:1 for ${theme}; measured ${measured}:1`,
      ).toBeCloseTo(QUOTED[theme], 2);
    });
  }

  it('light: canvas on accent-pressed', () => {
    // Doctrine caveat 2 quotes 7.93:1 — light has no gap, so it is asserted
    // against the real bar rather than pinned.
    const measured = ratio(
      palette.light.canvas,
      palette.light['accent-pressed'],
    );
    expect(measured).toBeGreaterThanOrEqual(TEXT_BAR);
  });

  it('dark: canvas on accent-pressed stays at its recorded 3.56:1', () => {
    // Pinned, not relaxed — same posture as the accent-on-dark-surface2 caveat.
    // This pair is below the bar and the doctrine says so out loud, along with
    // why every available fix costs more than the miss. The job of this
    // assertion is to make any movement visible: if it improves, update the
    // doctrine caveat and this number together; if it degrades, the caveat
    // understates the problem.
    const measured = ratio(palette.dark.canvas, palette.dark['accent-pressed']);
    expect(
      measured,
      'the documented canvas-on-dark-accent-pressed caveat moved; reconcile ' +
        'docs/design-doctrine.md › Palette with this measurement before changing it here',
    ).toBeCloseTo(3.56, 2);
  });

  it('pressed darkens in both themes', () => {
    // Doctrine › Theming › derivation rules. Hover is ground-relative; pressed
    // is not — "a press reads as depression, and depression is darker
    // regardless of what it sits on". This is asserted separately from the
    // ratios because it is the rule the caveat above depends on: a pressed
    // value that drifted lighter than accent would *raise* the pinned 3.56:1
    // and still be wrong.
    for (const theme of THEMES) {
      const base = relativeLuminance(palette[theme].accent);
      const pressed = relativeLuminance(palette[theme]['accent-pressed']);
      expect(
        pressed,
        `${theme}: accent-pressed (${palette[theme]['accent-pressed']}) must be darker than accent (${palette[theme].accent}), not lighter`,
      ).toBeLessThan(base);
    }
  });

  it('hover promotes contrast on accent fills too', () => {
    // Same rule as ironlit, applied to the accent lane: "Lighter in dark,
    // darker in light — hover promotes contrast, not brightness."
    for (const theme of THEMES) {
      const base = ratio(palette[theme].canvas, palette[theme].accent);
      const hover = ratio(
        palette[theme]['accent-hover'],
        palette[theme].canvas,
      );
      expect(
        hover,
        `${theme}: accent-hover fill went ${base}:1 → ${hover}:1 against canvas text`,
      ).toBeGreaterThan(base);
    }
  });
});

describe('divider stays sub-perceptual on purpose', () => {
  // Doctrine: divider is "decorative hairlines only — sub-perceptual by design
  // (1.35:1 dark / 1.17:1 light); never a control boundary". Pinned for the
  // opposite reason to everything else here: if these numbers climb toward 3:1,
  // divider starts *looking* like a control boundary and the distinction the
  // doctrine draws between it and iron stops being visible to the reader.
  const QUOTED = { dark: 1.35, light: 1.17 } as const;

  for (const theme of THEMES) {
    it(`${theme}: divider on canvas`, () => {
      const measured = ratio(palette[theme].divider, palette[theme].canvas);
      expect(
        measured,
        `divider on canvas (${theme}) measured ${measured}:1; the doctrine records ${QUOTED[theme]}:1`,
      ).toBeCloseTo(QUOTED[theme], 2);
      expect(
        measured,
        'divider has drifted up to a perceptible value — it is documented as a ' +
          'decorative hairline and must not read as a control boundary (that is iron)',
      ).toBeLessThan(STRUCTURAL_BAR);
    });
  }
});
