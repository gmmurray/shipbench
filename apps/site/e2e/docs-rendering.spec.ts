import { expect, type Locator, type Page, test } from '@playwright/test';

const MOBILE = { width: 320, height: 844 };

async function expectEnhancedProse(page: Page): Promise<void> {
  const prose = page.locator('.prose');
  const tables = prose.locator('table');
  const tableRegions = prose.locator('.table-scroll');
  const headings = prose.locator('h2[id], h3[id]');
  const headingAnchors = prose.locator(
    'h2[id] > .heading-anchor, h3[id] > .heading-anchor',
  );

  const tableCount = await tables.count();
  const headingCount = await headings.count();
  expect(tableCount).toBeGreaterThan(0);
  expect(headingCount).toBeGreaterThan(0);

  await expect(tableRegions).toHaveCount(tableCount);
  await expect(prose.locator('.table-scroll > table')).toHaveCount(tableCount);
  await expect(headingAnchors).toHaveCount(headingCount);
  await expect(prose.locator('.heading-link-status')).toHaveCount(1);

  for (let index = 0; index < tableCount; index += 1) {
    const region = tableRegions.nth(index);
    await expect(region).toHaveAttribute('role', 'region');
    await expect(region).toHaveAttribute('tabindex', '0');
    await expect(region).toHaveAttribute('aria-label', /table$/);
  }

  const spacing = await tableRegions.first().evaluate(element => {
    const styles = getComputedStyle(element);
    return {
      before: Number.parseFloat(styles.marginBlockStart),
      after: Number.parseFloat(styles.marginBlockEnd),
    };
  });
  expect(spacing).toEqual({ before: 24, after: 28 });
}

async function clickDocsLink(page: Page, path: string): Promise<void> {
  await page.locator(`.sidebar a[href="${path}"]`).click();
  await expect(page).toHaveURL(new RegExp(`${path}/?$`));
}

async function overflowingCodeBlock(page: Page): Promise<Locator> {
  // Scoped to blocks that actually carry a copy control. Since the affordance
  // became an explicit per-fence signal, the first overflowing block on a page
  // is often a ```bash no-copy usage synopsis, which has no shell around it.
  const blocks = page.locator('.code-block-shell > pre');
  const count = await blocks.count();

  for (let index = 0; index < count; index += 1) {
    const block = blocks.nth(index);
    if (
      await block.evaluate(element => element.scrollWidth > element.clientWidth)
    ) {
      return block;
    }
  }

  throw new Error('No horizontally scrollable docs code block found');
}

test('table regions and section permalinks survive client navigation in both directions', async ({
  page,
}) => {
  await page.goto('/docs/cli-reference/');
  await expectEnhancedProse(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'shipbenchE2eNavigationProbe', {
      value: true,
      configurable: true,
    });
  });

  await clickDocsLink(page, '/docs/convention-spec/');
  expect(
    await page.evaluate(() => 'shipbenchE2eNavigationProbe' in document),
    'the docs link performed a full reload instead of a ClientRouter swap',
  ).toBe(true);
  await expectEnhancedProse(page);

  await clickDocsLink(page, '/docs/cli-reference/');
  expect(
    await page.evaluate(() => 'shipbenchE2eNavigationProbe' in document),
    'the return link performed a full reload instead of a ClientRouter swap',
  ).toBe(true);
  await expectEnhancedProse(page);
});

// The reason the control moved out of the code's top-right corner. Overlaid, its
// 36px band crossed the first code line's 16px band on every block and covered
// real command text on more than half of them; `.prose pre code` sets
// `min-width: max-content`, so those lines scroll rather than wrap and the
// covered text could not be read without scrolling it out from under the button.
//
// Asserted geometrically rather than by class name, so a future restyle is free
// to move the control anywhere that does not land on the code.
test('the copy control never overlaps the code it copies, at the narrowest width', async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);

  for (const route of ['/docs/quickstart/', '/docs/cli-reference/']) {
    await page.goto(route);

    const overlaps = await page.evaluate(() => {
      const offenders: string[] = [];

      for (const shell of document.querySelectorAll('.code-block-shell')) {
        const button = shell.querySelector('.code-copy-button');
        const pre = shell.querySelector('pre');
        const firstLine = pre?.querySelector('.line') ?? pre?.querySelector('code');
        if (!button || !firstLine) continue;

        const b = button.getBoundingClientRect();
        const l = firstLine.getBoundingClientRect();
        const intersects =
          b.left < l.right && b.right > l.left && b.top < l.bottom && b.bottom > l.top;

        if (intersects) {
          offenders.push((firstLine.textContent ?? '').trim().slice(0, 60));
        }
      }

      return offenders;
    });

    expect(overlaps, `${route} has copy buttons sitting on their first code line`).toEqual([]);

    // The strip exists partly to give the control room for a real touch target;
    // 44px is the minimum the site's other mobile controls are held to. See
    // keyboard-nav.spec.ts.
    const heights = await page
      .locator('.code-copy-button')
      .evaluateAll(buttons => buttons.map(b => b.getBoundingClientRect().height));

    expect(heights.length, `${route} rendered no copy buttons`).toBeGreaterThan(0);
    for (const height of heights) {
      expect(height).toBeGreaterThanOrEqual(44);
    }
  }
});

test('copy button stays pinned while its code block scrolls at the narrowest width', async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/docs/cli-reference/');

  const pre = await overflowingCodeBlock(page);
  const shell = pre.locator('..');
  const button = shell.locator('.code-copy-button');

  await expect(shell).toHaveClass(/code-block-shell/);
  await expect(button).toBeVisible();

  const before = await button.boundingBox();
  expect(before).not.toBeNull();

  const scrollLeft = await pre.evaluate(element => {
    element.scrollLeft = element.scrollWidth;
    return element.scrollLeft;
  });
  expect(scrollLeft).toBeGreaterThan(0);

  const after = await button.boundingBox();
  expect(after).not.toBeNull();
  expect(after?.x).toBeCloseTo(before?.x ?? 0, 1);
  expect(after?.y).toBeCloseTo(before?.y ?? 0, 1);
});
