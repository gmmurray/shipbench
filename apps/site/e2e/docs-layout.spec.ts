import { expect, test } from '@playwright/test';

const WIDE_VIEWPORTS = [1440, 1920, 2560] as const;

for (const width of WIDE_VIEWPORTS) {
  test(`docs shell keeps the article and table of contents together at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/docs/overview/');

    const shell = page.locator('.docs-shell');
    const header = page.locator('.docs-header-inner');
    const article = page.locator('.doc-content');
    const toc = page.locator('.toc-sidebar');

    await expect(shell).toBeVisible();
    await expect(header).toBeVisible();
    await expect(article).toBeVisible();
    await expect(toc).toBeVisible();

    const boxes = await Promise.all([
      shell.boundingBox(),
      header.boundingBox(),
      article.boundingBox(),
      toc.boundingBox(),
    ]);
    const [shellBox, headerBox, articleBox, tocBox] = boxes;

    expect(shellBox).not.toBeNull();
    expect(headerBox).not.toBeNull();
    expect(articleBox).not.toBeNull();
    expect(tocBox).not.toBeNull();

    if (!shellBox || !headerBox || !articleBox || !tocBox) return;

    expect(shellBox.width).toBeCloseTo(1300, 0);
    expect(shellBox.x).toBeCloseTo((width - shellBox.width) / 2, 0);
    expect(headerBox.width).toBeCloseTo(shellBox.width, 0);
    expect(headerBox.x).toBeCloseTo(shellBox.x, 0);
    expect(articleBox.width).toBeCloseTo(820, 0);
    expect(tocBox.x - (articleBox.x + articleBox.width)).toBeCloseTo(0, 0);
  });
}

test('sticky docs navigation sits flush with the rendered header', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/docs/overview/');

  await page.evaluate(() => window.scrollTo(0, 400));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);

  const edges = await page.evaluate(() => ({
    headerBottom: document
      .querySelector<HTMLElement>('.header')!
      .getBoundingClientRect().bottom,
    sidebarTop: document
      .querySelector<HTMLElement>('.sidebar-inner')!
      .getBoundingClientRect().top,
    tocTop: document
      .querySelector<HTMLElement>('.toc-inner')!
      .getBoundingClientRect().top,
  }));

  expect(edges.sidebarTop - edges.headerBottom).toBeCloseTo(0, 1);
  expect(edges.tocTop - edges.headerBottom).toBeCloseTo(0, 1);
});

test('docs table of contents still drops out at 1120px', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 900 });
  await page.goto('/docs/overview/');

  await expect(page.locator('.toc-sidebar')).toBeHidden();
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.mobile-docs-bar')).toBeHidden();
});

test('docs sidebar still becomes the mobile drawer at 760px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 760, height: 900 });
  await page.goto('/docs/overview/');

  await expect(page.locator('.toc-sidebar')).toBeHidden();
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.mobile-docs-bar')).toBeVisible();
});
