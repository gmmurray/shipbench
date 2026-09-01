/**
 * Automated accessibility checks (axe-core) over the landing page and one docs
 * page, in both themes.
 *
 * Both halves matter. Contrast violations are theme-specific by definition, and
 * axe needs a real layout engine for target size, overlap, and visibility — none
 * of which jsdom can supply.
 *
 * **Baseline, not gate.** axe-baseline.json records the rule IDs known to fire
 * today. A violation with a new rule ID fails; a baselined one does not. That
 * ordering is deliberate: the queued accessibility task works this list down,
 * and a suite that failed on every remaining known issue would just be turned
 * off. Fixing a baselined rule never fails — it prints a note asking for the
 * entry to be dropped.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { waitForIsland } from './support/hydration.js';
import { type OsScheme, seedThemeChoice } from './support/theme.js';

const BASELINE_URL = new URL('./axe-baseline.json', import.meta.url);

type Baseline = Record<string, string[]>;

const baseline: Baseline = JSON.parse(
  readFileSync(BASELINE_URL, 'utf8'),
) as Baseline;

const PAGES = [
  { path: '/', name: 'landing' },
  { path: '/docs/overview/', name: 'docs' },
] as const;

const THEMES: OsScheme[] = ['dark', 'light'];

for (const { path, name } of PAGES) {
  for (const theme of THEMES) {
    const key = `${name}:${theme}`;

    test(`axe: ${key}`, async ({ page }) => {
      await seedThemeChoice(page, theme);
      // Set the OS scheme to match so nothing renders against a half-applied
      // palette if the stored choice were ever ignored.
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(path);
      await expect(page.locator(`html[data-theme="${theme}"]`)).toHaveCount(1);

      // Islands hydrate after load; scanning mid-hydration reports phantom
      // issues against markup that is about to be replaced.
      await waitForIsland(page, 'ThemeToggle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();

      const found = [...new Set(results.violations.map(v => v.id))].sort();
      const known = new Set(baseline[key] ?? []);

      const regressions = results.violations.filter(v => !known.has(v.id));
      if (regressions.length > 0) {
        const detail = regressions
          .map(v => {
            const where = v.nodes
              .slice(0, 3)
              .map(node => node.target.join(' '))
              .join('\n      ');
            return `  ${v.id} (${v.impact}) — ${v.help}\n    ${v.helpUrl}\n      ${where}`;
          })
          .join('\n');
        throw new Error(
          `New accessibility violations on ${key}:\n${detail}\n\n` +
            'Fix them, or — if they are accepted for now — add the rule IDs to ' +
            'e2e/axe-baseline.json with a note in the task that accepts them.',
        );
      }

      const resolved = [...known].filter(id => !found.includes(id));
      if (resolved.length > 0) {
        test.info().annotations.push({
          type: 'axe-baseline-stale',
          description: `${key}: fixed, safe to remove from axe-baseline.json — ${resolved.join(', ')}`,
        });
      }
    });
  }
}

/**
 * Regenerate the baseline from a live run: `SITE_E2E_AXE_UPDATE=1 pnpm test:e2e`.
 * Kept as a test so it shares the harness's server and browser rather than
 * needing a second entry point. Skipped unless the flag is set.
 */
test('update the axe baseline', async ({ page }) => {
  test.skip(
    !process.env.SITE_E2E_AXE_UPDATE,
    'set SITE_E2E_AXE_UPDATE=1 to rewrite axe-baseline.json',
  );

  const next: Baseline = {};
  for (const { path, name } of PAGES) {
    for (const theme of THEMES) {
      await seedThemeChoice(page, theme);
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(path);
      await waitForIsland(page, 'ThemeToggle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();

      next[`${name}:${theme}`] = [
        ...new Set(results.violations.map(v => v.id)),
      ].sort();
    }
  }

  writeFileSync(BASELINE_URL, `${JSON.stringify(next, null, 2)}\n`);
});
