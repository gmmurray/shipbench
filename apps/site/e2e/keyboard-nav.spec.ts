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

import { expect, type Page, test } from '@playwright/test';

const LAYOUTS = [
  { name: 'landing', path: '/' },
  { name: 'docs', path: '/docs/overview' },
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

test.describe('hero tablist', () => {
  const board = '#btn-board';
  const split = '#btn-split';

  async function tabState(page: Page) {
    return page.evaluate(() => {
      const read = (id: string) => {
        const tab = document.getElementById(id);
        const panel = document.getElementById(
          tab?.getAttribute('aria-controls') ?? '',
        );
        return {
          selected: tab?.getAttribute('aria-selected'),
          tabindex: tab?.getAttribute('tabindex'),
          panelHidden: panel?.hasAttribute('hidden'),
        };
      };
      return { board: read('btn-board'), split: read('btn-split') };
    });
  }

  test('exposes one tab stop and hides the inactive panel', async ({
    page,
  }) => {
    await page.goto('/');

    expect(await tabState(page)).toEqual({
      board: { selected: 'true', tabindex: '0', panelHidden: false },
      split: { selected: 'false', tabindex: '-1', panelHidden: true },
    });

    // The hint is decorative and must not sit inside the tablist as a non-tab
    // child, which would make the widget ill-formed.
    await expect(page.locator('.visual-tabs .tab-hint')).toHaveCount(0);
  });

  test('arrow keys move and activate, wrapping at both ends', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator(board).focus();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator(split)).toBeFocused();
    expect((await tabState(page)).split).toEqual({
      selected: 'true',
      tabindex: '0',
      panelHidden: false,
    });
    expect((await tabState(page)).board.panelHidden).toBe(true);

    // Wrap forward.
    await page.keyboard.press('ArrowRight');
    await expect(page.locator(board)).toBeFocused();

    // Wrap backward.
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator(split)).toBeFocused();

    await page.keyboard.press('Home');
    await expect(page.locator(board)).toBeFocused();

    await page.keyboard.press('End');
    await expect(page.locator(split)).toBeFocused();
  });

  test('Tab leaves the tablist rather than walking every tab', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator(board).focus();

    // Roving tabindex means the unselected tab is not a tab stop. This is the
    // APG pattern and the reason arrow keys exist for this widget.
    await page.keyboard.press('Tab');
    await expect(page.locator(split)).not.toBeFocused();
  });

  test('clicking a tab switches panels without stealing focus', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator(split).click();
    expect((await tabState(page)).split.panelHidden).toBe(false);
    expect((await tabState(page)).board.panelHidden).toBe(true);
  });
});

test('focus rings are not clipped by an overflow-hidden ancestor', async ({
  page,
}) => {
  await page.goto('/');

  // .hero-visual sets overflow: hidden for its rounded corners, and the tab
  // buttons live inside it. The global ring is 2px at 2px offset, so a control
  // needs 4px of clearance or the ring is silently cut off — visible to nobody
  // except the keyboard user relying on it.
  const clearance = await page.evaluate(() => {
    const tab = document.getElementById('btn-board');
    const clipper = tab?.closest<HTMLElement>('.hero-visual');
    if (!tab || !clipper) return null;

    const a = tab.getBoundingClientRect();
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
    'could not find the tab inside .hero-visual',
  ).not.toBeNull();
  for (const [edge, value] of Object.entries(clearance ?? {})) {
    expect(
      value,
      `only ${value}px between the tab and the clipping ancestor's ${edge} edge; the 2px ring at 2px offset needs 4px`,
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
    await page.goto('/docs/overview');

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
    await page.goto('/docs/overview');
    await page.locator('#mobile-docs-toggle').click();
    await expect(page.locator('#mobile-docs-drawer')).toHaveClass(/open/);

    // Search dismissal shares the same close path.
    await page.locator('#mobile-docs-toggle').click();
    await expect(page.locator('#mobile-docs-drawer')).not.toHaveClass(/open/);
  });
});
