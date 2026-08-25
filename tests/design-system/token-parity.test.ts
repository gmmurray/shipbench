/**
 * Token parity and drift.
 *
 * Two failure modes, neither of which shows up in normal use:
 *
 * 1. **A token defined in some theme states but not others.** The missing state
 *    silently inherits the wrong value, and only for users whose OS setting and
 *    explicit choice disagree. Nobody finds this by clicking around.
 *
 * 2. **A palette copy drifting from the doctrine.** Three surfaces implement
 *    the same palette under three prefixes. Checking one proves nothing about
 *    the other two — so all three are checked against the parsed doctrine,
 *    which catches drift between any pair of them transitively.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  readThemeStates,
  STATE_THEME,
  THEME_STATES,
  type ThemeState,
} from './css-tokens.js';
import {
  assertPaletteShape,
  parseDoctrinePalette,
  TOKENS,
} from './doctrine.js';
import { SURFACES } from './surfaces.js';

const doctrine = parseDoctrinePalette();
assertPaletteShape(doctrine);

for (const surface of SURFACES) {
  describe(surface.name, () => {
    const states = readThemeStates(readFileSync(surface.path, 'utf8'), {
      defaultBlock: surface.defaultBlock,
    });

    it('declares all four theme states', () => {
      const empty = THEME_STATES.filter(state => states[state].size === 0);
      expect(
        empty,
        `${surface.label} has no declarations for: ${empty.join(', ')}. ` +
          'Either the block is missing or css-tokens.ts can no longer find it.',
      ).toEqual([]);
    });

    it('defines an identical token set in every state', () => {
      const perState = new Map<ThemeState, string[]>();

      for (const state of THEME_STATES) {
        perState.set(
          state,
          TOKENS.filter(token => states[state].has(surface.cssName(token))),
        );
      }

      // Report the whole matrix at once. Fixing these one failure at a time is
      // how you end up doing four rebuilds for one omission.
      const gaps: string[] = [];
      for (const token of TOKENS) {
        const present = THEME_STATES.filter(state =>
          states[state].has(surface.cssName(token)),
        );
        if (present.length !== 0 && present.length !== THEME_STATES.length) {
          const missing = THEME_STATES.filter(
            state => !present.includes(state),
          );
          gaps.push(
            `  --${surface.cssName(token)} missing from: ${missing.join(', ')}`,
          );
        }
      }

      expect(
        gaps,
        `${surface.label} defines tokens in some theme states but not others.\n${gaps.join('\n')}\n` +
          'A state that omits a token inherits the wrong value on toggle.',
      ).toEqual([]);

      // And every token has to be there at all.
      const absent = TOKENS.filter(
        token => (perState.get('default') ?? []).indexOf(token) === -1,
      );
      expect(
        absent,
        `${surface.label} never defines: ${absent.map(t => `--${surface.cssName(t)}`).join(', ')}`,
      ).toEqual([]);
    });

    for (const state of THEME_STATES) {
      it(`matches the doctrine in the ${state} state`, () => {
        const expectedTheme = STATE_THEME[state];
        const mismatches: string[] = [];

        for (const token of TOKENS) {
          const actual = states[state].get(surface.cssName(token));
          const expected = doctrine[expectedTheme][token];
          if (actual !== undefined && actual !== expected) {
            mismatches.push(
              `  --${surface.cssName(token)}: ${actual} (doctrine ${expectedTheme}: ${expected})`,
            );
          }
        }

        expect(
          mismatches,
          `${surface.label} › ${state} disagrees with docs/design-doctrine.md.\n${mismatches.join('\n')}\n` +
            'One of the two is wrong. Reconcile them — a palette copy that has ' +
            'drifted is exactly what this test exists to catch.',
        ).toEqual([]);
      });
    }

    it('restates the dark values under explicit-dark', () => {
      // Not redundant with the default block: without an explicit-dark block, a
      // user forcing dark on a light-OS machine gets the media query's light
      // values. The values therefore have to be repeated, and repeated
      // correctly — which is precisely the kind of thing that rots.
      const drift: string[] = [];
      for (const token of TOKENS) {
        const name = surface.cssName(token);
        const base = states.default.get(name);
        const explicit = states['explicit-dark'].get(name);
        if (base !== undefined && explicit !== undefined && base !== explicit) {
          drift.push(
            `  --${name}: default ${base} vs explicit-dark ${explicit}`,
          );
        }
      }

      expect(
        drift,
        `${surface.label} › explicit-dark no longer mirrors the default block.\n${drift.join('\n')}`,
      ).toEqual([]);
    });
  });
}
