/**
 * Waiting for Astro islands to hydrate.
 *
 * The site is statically built, so every interactive control ships as inert
 * server-rendered markup first and only becomes live when its island's module
 * arrives. Clicking before that is a silent no-op: the button is there, it is
 * visible, it is enabled, and nothing happens. Playwright's actionability
 * checks cannot see the difference, which makes this the single largest source
 * of flake in a harness like this one.
 *
 * `<astro-island>` drops its `ssr` attribute once hydration completes, so
 * that — not a timeout, and not a retried click — is the signal to wait on.
 */

import { expect, type Page } from '@playwright/test';

/**
 * @param component Substring of the island's `component-url`. Match on the
 * component name, never the full path: the filename carries a content hash.
 */
export async function waitForIsland(
  page: Page,
  component: string,
): Promise<void> {
  await page
    .locator(`astro-island[component-url*="${component}"]:not([ssr])`)
    .first()
    .waitFor({ state: 'attached' });
}

/**
 * Search needs two independent things loaded, by design: the island owns the
 * dialog, and src/scripts/search-triggers.ts owns "something asked for the
 * dialog" (header button, Cmd/Ctrl+K, mobile drawer). The painted shortcut
 * hint is proof the second one ran — it ships `hidden` and that module is what
 * reveals it.
 */
export async function waitForSearchReady(page: Page): Promise<void> {
  await waitForIsland(page, 'SearchDialog');
  await expect(page.locator('[data-search-kbd]').first()).toBeVisible();
}
