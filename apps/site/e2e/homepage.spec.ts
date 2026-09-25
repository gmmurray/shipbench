import { expect, type Page, test } from '@playwright/test';

test.describe('home page', () => {
  // Asserts the clipboard payload rather than the button's presence:
  // `code-copy.ts` strips the numbered `.comment` captions and the `.prompt`
  // glyphs, and if that regressed the button would still report success while
  // copying unusable text.
  test('the quickstart copies clean commands', async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');
    await expect(page.locator('pre[data-code-block]')).toHaveCount(1);
    await expect(page.locator('pre[data-copy-disabled]')).toHaveCount(0);

    const homeCopy = page.locator('.code-copy-button');
    await expect(homeCopy).toHaveCount(1);
    await homeCopy.click();
    await expect(homeCopy).toHaveAttribute('data-copy-state', 'copied');

    // Chromium returns CRLF on Windows and LF on Linux.
    const copied = (
      await page.evaluate(() => navigator.clipboard.readText())
    ).replace(/\r\n/g, '\n');

    expect(copied).toBe(
      [
        'npx shipbench init',
        '',
        'npx shipbench task create "Build landing page" --priority=high',
        '',
        'npx shipbench board',
      ].join('\n'),
    );

    await page.goto('/docs/quickstart/');
    const copyButton = page.locator('.code-copy-button').first();
    await expect(copyButton).toBeVisible();
    await copyButton.click();
    await expect(copyButton).toHaveAttribute('data-copy-state', 'copied');
    await expect(copyButton).toHaveAttribute(
      'aria-label',
      'Code copied to clipboard',
    );
  });

  test('use cases stack in one column without mobile overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const cards = page.locator('.use');
    await expect(cards).toHaveCount(8);

    const boxes = await cards.evaluateAll(elements =>
      elements.map(element => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width };
      }),
    );

    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y);
    }
    expect(
      Math.max(...boxes.map(box => box.x)) -
        Math.min(...boxes.map(box => box.x)),
    ).toBeLessThan(1);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});

test.describe('hero animation', () => {
  const positions = (page: Page) =>
    page.$$eval('.lane-mark', marks =>
      marks.map(mark => mark.getAttribute('style')).join('|'),
    );

  test('is hidden from assistive technology', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-lanes]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  test('moves marks when motion is allowed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    const before = await positions(page);
    await expect.poll(() => positions(page), { timeout: 6000 }).not.toBe(before);
  });

  test('holds a static frame under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const before = await positions(page);
    await page.waitForTimeout(4500);
    expect(await positions(page)).toBe(before);
  });
});
