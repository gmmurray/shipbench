/**
 * Umami stays out of the harness.
 *
 * playwright.config.ts maps every *.umami.is host to "not found", so the
 * tracker script never loads and no page view can leave the browser. This file
 * is the check that the block is still in place: if it goes, the tracker
 * script comes back with a response and the test below fails.
 *
 * What gets sent from production is not testable here. The `data-domains`
 * attribute that limits reporting to shipbench.dev is asserted against the
 * built HTML in built-output.spec.ts.
 */

import { expect, test } from '@playwright/test';

const UMAMI = /^https:\/\/[^/]+\.umami\.is\//;

test('no request reaches Umami across a load and a client-side navigation', async ({
  page,
}) => {
  const attempted: string[] = [];
  const answered: string[] = [];
  page.on('request', request => {
    if (UMAMI.test(request.url())) attempted.push(request.url());
  });
  page.on('response', response => {
    if (UMAMI.test(response.url())) answered.push(response.url());
  });

  await page.goto('/docs/overview/');
  await expect(page.locator('script[src*="umami.is"]')).toHaveCount(1);

  await page.locator('a[href="/docs/quickstart/"]:visible').first().click();
  await page.waitForURL('**/docs/quickstart/');
  await page.waitForLoadState('networkidle');

  // The page still tries to load the tracker. That attempt is what proves the
  // block, rather than the tag having gone missing, is why nothing answered.
  expect(attempted).toContain('https://cloud.umami.is/script.js');
  expect(answered, 'Umami answered a request from the harness').toEqual([]);
});
