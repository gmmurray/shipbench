import { expect, test } from '@playwright/test';

test.describe('landing-page interfaces and code examples', () => {
  // The home page draws the line between a specimen and an instruction. The two
  // hero panes render what a task file and a CLI session look like; the
  // quickstart block is the three commands the section's heading promises, so
  // it copies. This asserts the clipboard payload rather than the button's
  // presence, because the reason the block can copy at all is that
  // `code-copy.ts` strips the numbered `.comment` captions and the `.prompt`
  // glyphs - if that stripping regressed, a button would still be there and
  // still report success while putting unusable text on the clipboard.
  test('the home quickstart copies clean commands while its hero panes stay illustrative', async ({
    context,
    page,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');
    await expect(page.locator('pre[data-code-block]')).toHaveCount(3);
    await expect(page.locator('pre[data-copy-disabled]')).toHaveCount(2);

    const homeCopy = page.locator('.code-copy-button');
    await expect(homeCopy).toHaveCount(1);
    await homeCopy.click();
    await expect(homeCopy).toHaveAttribute('data-copy-state', 'copied');

    // Normalised because Chromium hands back CRLF on Windows and LF on the
    // Linux CI runner. The claim under test is what the numbered captions and
    // prompt glyphs leave behind, not the platform's clipboard newline.
    const copied = (
      await page.evaluate(() => navigator.clipboard.readText())
    ).replace(/\r\n/g, '\n');

    // The blank line between each command survives on purpose: code-copy.ts
    // collapses only *consecutive* blanks, so the three commands arrive spaced
    // the way they are shown rather than run together.
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
