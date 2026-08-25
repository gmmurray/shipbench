import { expect, test } from '@playwright/test';

test.describe('landing-page interfaces and code examples', () => {
  test('home snippets stay illustrative while docs keep copy feedback', async ({
    context,
    page,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');
    await expect(page.locator('.code-copy-button')).toHaveCount(0);
    await expect(page.locator('pre[data-code-block]')).toHaveCount(3);
    expect(
      await page
        .locator('pre[data-code-block]')
        .evaluateAll(blocks =>
          blocks.every(block => block.hasAttribute('data-copy-disabled')),
        ),
    ).toBe(true);

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

  test('local interface cards stack without mobile overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const cards = page.locator('.local-interface-card');
    await expect(cards).toHaveCount(3);

    const boxes = await cards.evaluateAll(elements =>
      elements.map(element => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width };
      }),
    );

    expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y);
    expect(boxes[2]!.y).toBeGreaterThan(boxes[1]!.y);
    expect(
      Math.max(...boxes.map(box => box.x)) -
        Math.min(...boxes.map(box => box.x)),
    ).toBeLessThan(1);
    expect(Math.max(...boxes.map(box => box.width))).toBeLessThanOrEqual(390);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});
