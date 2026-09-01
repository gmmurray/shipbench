/**
 * Screenshot capture, for a human (or an agent that can read images) to look at.
 *
 * **Nothing here asserts on pixels.** Playwright's `toHaveScreenshot()` baseline
 * comparison is deliberately out of scope: baselines churn on every intentional
 * design change, and this project changes design intentionally and often. The
 * output is evidence, not a gate. Revisit only if some specific regression keeps
 * coming back.
 *
 * Both palettes at both widths, because until now neither light nor dark had
 * actually been looked at.
 */

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { waitForSearchReady } from './support/hydration.js';
import { CANVAS, type OsScheme, seedThemeChoice } from './support/theme.js';

const OUT_DIR = fileURLToPath(new URL('./screenshots/', import.meta.url));

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  // 390x844 — below the 760px breakpoint, so this is the drawer/compact layout.
  { name: 'mobile', width: 390, height: 844 },
] as const;

const PAGES = [
  { path: '/', name: 'landing' },
  { path: '/docs/overview/', name: 'docs-overview' },
  { path: '/docs/cli-reference/', name: 'docs-cli-reference' },
] as const;

const THEMES: OsScheme[] = ['dark', 'light'];

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true });
});

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test(`screenshots: ${viewport.name} ${theme}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await seedThemeChoice(page, theme);
      await page.emulateMedia({ colorScheme: theme });

      for (const { path, name } of PAGES) {
        await page.goto(path);
        await expect(page.locator('html')).toHaveCSS(
          'background-color',
          CANVAS[theme],
        );
        // Web fonts shift metrics; capturing before they settle produces
        // screenshots that misrepresent the typography.
        await page.evaluate(() => document.fonts.ready);

        await page.screenshot({
          path: `${OUT_DIR}${name}-${viewport.name}-${theme}.png`,
          fullPage: true,
          animations: 'disabled',
        });
      }
    });
  }
}

test('screenshots: open search dialog, both themes', async ({ page }) => {
  for (const theme of THEMES) {
    await seedThemeChoice(page, theme);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/docs/overview/');
    await waitForSearchReady(page);

    await page.getByRole('button', { name: 'Search documentation' }).click();
    await page
      .getByRole('combobox', { name: 'Search documentation' })
      .fill('worktree');
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    await page.screenshot({
      path: `${OUT_DIR}search-dialog-desktop-${theme}.png`,
      animations: 'disabled',
    });
  }
});
