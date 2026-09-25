/**
 * Keyboard and touch affordances from the accessibility pass.
 *
 * Everything here needs a real browser for the same reason the rest of this
 * harness does: focus order is a browser behaviour, `hidden` toggling is only
 * meaningful against a real accessibility tree, and a 44px touch target is a
 * layout measurement. jsdom can assert the attributes exist; it cannot tell you
 * the skip link is reachable or that the tap target is actually 44px tall.
 *
 * axe covers the static rules — these are the interactions axe cannot drive.
 */

import { expect, test } from '@playwright/test';

const LAYOUTS = [
  { name: 'landing', path: '/' },
  { name: 'docs', path: '/docs/overview/' },
] as const;

const MOBILE = { width: 390, height: 844 };

test.describe('skip link', () => {
  for (const layout of LAYOUTS) {
    test(`is the first tab stop and moves focus to main on ${layout.name}`, async ({
      page,
    }) => {
      await page.goto(layout.path);

      // First Tab from a fresh document. The header carries roughly eight
      // controls; without this the keyboard user walks all of them on every
      // page before reaching content.
      await page.keyboard.press('Tab');
      const skip = page.locator('.skip-link');
      await expect(skip).toBeFocused();

      // Off-canvas until focused, on-canvas after — the reason it is
      // translated rather than display:none, which would drop it from the tab
      // order entirely and defeat the point.
      const box = await skip.boundingBox();
      expect(box, 'the focused skip link has no layout box').not.toBeNull();
      expect(
        box?.y ?? -1,
        'the skip link is still off-canvas while focused',
      ).toBeGreaterThanOrEqual(0);

      await page.keyboard.press('Enter');

      // The real assertion. A fragment jump alone only sets the sequential
      // focus starting point — activeElement would stay on <body> and a screen
      // reader would not be moved. tabindex="-1" on <main> is what fixes it.
      await expect(page.locator('#main-content')).toBeFocused();
    });
  }

  test('stays out of the way when not focused', async ({ page }) => {
    await page.goto('/');
    const box = await page.locator('.skip-link').boundingBox();
    expect(
      box?.y ?? 0,
      'the skip link is visible before being focused',
    ).toBeLessThan(0);
  });
});

test('focus rings are not clipped by an overflow-hidden ancestor', async ({
  page,
}) => {
  await page.goto('/');

  // .code-block-shell sets overflow: hidden, and the quickstart's copy button
  // lives inside it. The global ring is 2px at 2px offset, so the button needs
  // 4px of clearance or the ring is cut off.
  const clearance = await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>(
      '#start .code-copy-button',
    );
    const clipper = button?.closest<HTMLElement>('.code-block-shell');
    if (!button || !clipper) return null;

    const a = button.getBoundingClientRect();
    const b = clipper.getBoundingClientRect();
    return {
      top: a.top - b.top,
      left: a.left - b.left,
      right: b.right - a.right,
      bottom: b.bottom - a.bottom,
    };
  });

  expect(
    clearance,
    'could not find the copy button inside .code-block-shell',
  ).not.toBeNull();
  for (const [edge, value] of Object.entries(clearance ?? {})) {
    expect(
      value,
      `only ${value}px between the button and the clipping ancestor's ${edge} edge; the 2px ring at 2px offset needs 4px`,
    ).toBeGreaterThanOrEqual(4);
  }
});

test.describe('mobile drawers', () => {
  test.use({ viewport: MOBILE });

  test('nav drawer toggles, and its links meet the 44px touch minimum', async ({
    page,
  }) => {
    await page.goto('/');

    const drawer = page.locator('#mobile-nav-drawer');
    const toggle = page.locator('#mobile-menu-toggle');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(drawer).toHaveClass(/open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const links = drawer.locator('.mobile-nav-links a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const box = await links.nth(i).boundingBox();
      const label = await links.nth(i).innerText();
      expect(
        box?.height ?? 0,
        `drawer link "${label.trim()}" is ${box?.height}px tall, under the 44px touch minimum`,
      ).toBeGreaterThanOrEqual(44);
    }
  });

  test('nav drawer closes on an in-page link, uncovering the destination', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('#mobile-menu-toggle').click();

    const drawer = page.locator('#mobile-nav-drawer');
    await expect(drawer).toHaveClass(/open/);

    // A hash link performs no navigation, so before this fix the drawer sat
    // open directly over the section it had just jumped to.
    await drawer.locator('a[href="#start"]').click();

    await expect(drawer).not.toHaveClass(/open/);
    await expect(page.locator('#mobile-menu-toggle')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  test('docs drawer toggles and its links meet the touch minimum', async ({
    page,
  }) => {
    await page.goto('/docs/overview/');

    const toggle = page.locator('#mobile-docs-toggle');
    const drawer = page.locator('#mobile-docs-drawer');

    await toggle.click();
    await expect(drawer).toHaveClass(/open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const links = drawer.locator('.sidebar-link');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const box = await links.nth(i).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('both drawers are driven by the one delegated handler', async ({
    page,
  }) => {
    // The two guarded inline scripts are gone; scripts/nav.ts is loaded once by
    // BaseLayout. If that consolidation had missed a page, the toggle on it
    // would simply do nothing — which is what this checks on the docs layout,
    // where the removed listener used to live.
    await page.goto('/docs/overview/');
    await page.locator('#mobile-docs-toggle').click();
    await expect(page.locator('#mobile-docs-drawer')).toHaveClass(/open/);

    // Search dismissal shares the same close path.
    await page.locator('#mobile-docs-toggle').click();
    await expect(page.locator('#mobile-docs-drawer')).not.toHaveClass(/open/);
  });
});
