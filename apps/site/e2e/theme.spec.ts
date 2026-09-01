/**
 * No flash of the wrong theme.
 *
 * The light-theme work could only verify *script ordering* — that the bootstrap
 * in BaseLayout.astro is inline and sits above the stylesheet. That is the
 * mechanism, not the outcome. jsdom has no rendering pipeline, so it cannot say
 * what any frame actually looked like.
 *
 * Here every frame is sampled from a requestAnimationFrame loop installed
 * before the document's own scripts run. rAF callbacks fire after style and
 * layout and immediately before the frame is composited, so each sample is the
 * canvas that frame renders. The stored choice is deliberately set to the
 * opposite of the emulated OS scheme: with the two agreeing, a bootstrap that
 * never ran would still look correct.
 *
 * See support/theme.ts for why only scripts and the CPU are throttled.
 */

import { expect, test } from '@playwright/test';
import { waitForIsland } from './support/hydration.js';
import {
  CANVAS,
  CANVAS_UNSTYLED,
  type OsScheme,
  readPaintSamples,
  recordPaintSamples,
  seedThemeChoice,
  throttleFirstPaint,
} from './support/theme.js';

const PAGES = ['/', '/docs/overview/'] as const;

const CONFLICTS: { stored: OsScheme; os: OsScheme }[] = [
  { stored: 'light', os: 'dark' },
  { stored: 'dark', os: 'light' },
];

for (const { stored, os } of CONFLICTS) {
  for (const path of PAGES) {
    test(`stored ${stored} on a ${os} OS never paints ${os} on ${path}`, async ({
      page,
    }) => {
      await seedThemeChoice(page, stored);
      await recordPaintSamples(page);
      await page.emulateMedia({ colorScheme: os });
      await throttleFirstPaint(page);

      await page.goto(path, { waitUntil: 'load' });

      const samples = await readPaintSamples(page);
      expect(
        samples.length,
        'no frames were sampled — the rAF probe never ran',
      ).toBeGreaterThan(0);

      const wrong = samples.filter(sample => sample.background === CANVAS[os]);
      expect(
        wrong,
        `frames painted the ${os} canvas before the ${stored} choice applied`,
      ).toEqual([]);

      // Every sample is either the correct canvas or the pre-stylesheet
      // default. Anything else means a third color got in.
      for (const sample of samples) {
        expect([CANVAS[stored], CANVAS_UNSTYLED]).toContain(sample.background);
      }

      // And at least one frame actually showed the chosen canvas, so a page
      // that simply never applied any stylesheet cannot pass by default.
      expect(samples.some(sample => sample.background === CANVAS[stored])).toBe(
        true,
      );

      await expect(page.locator('html')).toHaveAttribute('data-theme', stored);
    });
  }
}

/**
 * Self-check: prove the assertion above is not vacuous.
 *
 * A "no flash" test that would pass on a broken page is worse than no test. So
 * break the page on purpose — serve the same HTML with the bootstrap's call
 * deferred — and require the sampler to see it.
 *
 * The 600ms is chosen, not arbitrary. Locally the first frame lands around
 * 150ms because CSS is render-blocking, and a bootstrap deferred by less than
 * that still wins the race. What this models is the real regression: the
 * bootstrap stops being inline and becomes a module that has to be fetched and
 * parsed. That is also why throttleFirstPaint delays scripts rather than CSS.
 */
test('the flash detector catches a deferred bootstrap', async ({ page }) => {
  await page.route('**/docs/overview/', async route => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace(
      'applyStoredTheme();\n',
      'setTimeout(applyStoredTheme, 600);\n',
    );
    expect(
      body,
      'the bootstrap no longer matches — update this mutation to match BaseLayout.astro',
    ).not.toBe(original);
    await route.fulfill({ response, body });
  });

  await seedThemeChoice(page, 'light');
  await recordPaintSamples(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await throttleFirstPaint(page);

  await page.goto('/docs/overview/', { waitUntil: 'load' });

  const samples = await readPaintSamples(page);
  expect(
    samples.filter(sample => sample.background === CANVAS.dark).length,
    'the deferred bootstrap was not detected — the no-flash specs are vacuous',
  ).toBeGreaterThan(0);
});

test('System follows the OS with no stored choice', async ({ page }) => {
  await seedThemeChoice(page, 'system');
  await recordPaintSamples(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await throttleFirstPaint(page);

  await page.goto('/', { waitUntil: 'load' });

  const samples = await readPaintSamples(page);
  expect(samples.some(sample => sample.background === CANVAS.light)).toBe(true);
  expect(samples.filter(s => s.background === CANVAS.dark)).toEqual([]);

  // System is the *absence* of the attribute — the media query in tokens.css
  // resolves it. A bootstrap that wrote data-theme="light" here would break
  // live OS changes.
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
});

test('the toggle applies a choice and it survives a reload', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', /.*/);

  // The toggle is server-rendered inert markup until its island lands; clicking
  // before then does nothing at all. See support/hydration.ts.
  await waitForIsland(page, 'ThemeToggle');
  await page.getByRole('button', { name: 'Use light theme' }).first().click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(html).toHaveCSS('background-color', CANVAS.light);

  // The reload is the point: this proves persistence, and the specs above
  // prove the persisted value lands before first paint.
  await recordPaintSamples(page);
  await page.reload({ waitUntil: 'load' });

  await expect(html).toHaveAttribute('data-theme', 'light');
  const samples = await readPaintSamples(page);
  expect(samples.filter(s => s.background === CANVAS.dark)).toEqual([]);
});

test('a ClientRouter navigation keeps the chosen theme', async ({ page }) => {
  // swapRootAttributes strips every root attribute and copies the incoming
  // document's — and static HTML never carries data-theme. BaseLayout re-applies
  // on astro:after-swap; this is the assertion for that.
  await seedThemeChoice(page, 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/docs/overview/');

  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.getByRole('link', { name: 'Quickstart' }).first().click();
  await page.waitForURL(/\/docs\/quickstart/);

  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(html).toHaveCSS('background-color', CANVAS.light);
});
