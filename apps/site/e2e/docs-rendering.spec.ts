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
  const blocks = page.locator('.prose pre');
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
