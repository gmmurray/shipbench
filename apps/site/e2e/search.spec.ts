/**
 * Docs search, end to end against the real Pagefind index.
 *
 * src/scripts/search-controller.test.ts already covers debounce, token
 * invalidation, and state transitions against an injected fake, and
 * src/components/SearchDialog.test.ts covers ARIA and keyboard selection in
 * jsdom. Neither can reach what is here:
 *
 * - Pagefind is WebAssembly loading a build-time index from /pagefind/*. There
 *   is nothing to load under jsdom, and nothing to load under `astro dev`.
 * - The focus trap belongs to native `<dialog>` + showModal(), which jsdom 29
 *   does not implement at all (`showModal` and `close` are missing outright).
 */

import { expect, type Page, test } from '@playwright/test';
import { waitForSearchReady } from './support/hydration.js';

const DOCS_PAGE = '/docs/overview/';

/** Navigate and wait until both halves of search are live. */
async function gotoDocs(page: Page, path: string = DOCS_PAGE): Promise<void> {
  await page.goto(path);
  await waitForSearchReady(page);
}

/**
 * Where focus landed, coarsely.
 *
 * `browser-ui` is the interesting one. Chromium ends a modal dialog's tab cycle
 * by handing focus to its own chrome (the address bar), which shows up in the
 * page as `document.activeElement === document.body`. That is the modal
 * boundary working: nothing behind the dialog is reachable, and the next Tab
 * comes back in. `page` — focus on a real element outside the dialog — is the
 * failure this spec exists to catch.
 */
type FocusZone = 'dialog' | 'browser-ui' | 'page';

interface FocusProbe {
  zone: FocusZone;
  /** id, else class, else tag — enough to name the tab stop in a failure. */
  label: string;
}

async function tabCycle(
  page: Page,
  presses: number,
  options: { shift?: boolean } = {},
): Promise<FocusProbe[]> {
  const key = options.shift ? 'Shift+Tab' : 'Tab';
  const probes: FocusProbe[] = [];

  for (let i = 0; i < presses; i++) {
    await page.keyboard.press(key);
    probes.push(
      await page.evaluate((): FocusProbe => {
        const active = document.activeElement as HTMLElement | null;
        const dialog = document.getElementById('search-modal');
        const label =
          active?.id ||
          (typeof active?.className === 'string' ? active.className : '') ||
          active?.tagName ||
          'none';

        if (dialog && active && dialog.contains(active))
          return { zone: 'dialog', label };
        if (!active || active === document.body)
          return { zone: 'browser-ui', label };
        return { zone: 'page', label };
      }),
    );
  }

  return probes;
}

/**
 * A term the Workflows section is built around, so the assertions can name the
 * pages they expect rather than settling for "some result appeared".
 *
 * This used to be a single-document premise: "worktree" was the subject of two
 * headings inside one long recommended-workflows.md. That page has since been
 * split into a Workflows section, so the term is now spread across it and two
 * pages are *titled* for it — which is the stronger signal Pagefind ranks on,
 * and the reason the section is still what a search for it surfaces.
 */
const QUERY = 'worktree';

/** The two Workflows pages that carry the term in their title. */
const CONCURRENT_AGENTS = 'Concurrent Agents with Worktrees';
const WORKTREE_RECIPE = 'Recipe: Multi-Agent Worktree Rules';

test.describe('docs search', () => {
  test('returns real results from the built index and navigates to one', async ({
    page,
  }) => {
    await gotoDocs(page);

    await page.getByRole('button', { name: 'Search documentation' }).click();

    const dialog = page.locator('#search-modal');
    await expect(dialog).toBeVisible();

    const input = page.getByRole('combobox', { name: 'Search documentation' });
    await expect(input).toBeFocused();

    await input.fill(QUERY);

    // Real WASM, real index. If Pagefind failed to load, the controller emits
    // `unavailable` and this locator never resolves — which is the point.
    const results = page.getByRole('option');
    await expect(results.first()).toBeVisible();

    // Filtered on the title span, not the whole option: Pagefind excerpts
    // quote page text, so several results mention each other by name.
    const byTitle = (title: string) =>
      page.getByRole('option').filter({
        has: page.locator('.search-result-title', {
          hasText: new RegExp(
            `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          ),
        }),
      });

    // The structural assertion: one page no longer owns this term. Both
    // Workflows pages titled for it come back, which is what splitting the
    // section was supposed to produce — a query that used to resolve to one
    // document now resolves to the section, and the reader picks.
    const target = byTitle(CONCURRENT_AGENTS);
    await expect(target).toBeVisible();
    await expect(byTitle(WORKTREE_RECIPE)).toBeVisible();

    // Pagefind wraps matched terms in <mark> inside the excerpt.
    await expect(target.locator('mark').first()).toBeVisible();

    await target.click();
    await page.waitForURL(/\/docs\/concurrent-agents/);
    await expect(
      page.getByRole('heading', { level: 1, name: CONCURRENT_AGENTS }),
    ).toBeVisible();
  });

  test('reports no results for a term the index does not contain', async ({
    page,
  }) => {
    await gotoDocs(page);
    await page.getByRole('button', { name: 'Search documentation' }).click();

    await page
      .getByRole('combobox', { name: 'Search documentation' })
      .fill('zzzzqqqxnotaword');

    // #search-status specifically: docs pages carry a second role="status" for
    // the heading-link copy confirmation.
    await expect(page.locator('#search-status')).toContainText(
      'No results for',
    );
    await expect(page.getByRole('option')).toHaveCount(0);
  });

  test('keyboard selection moves through real results and Enter opens one', async ({
    page,
  }) => {
    await gotoDocs(page);
    await page.keyboard.press('ControlOrMeta+k');

    const input = page.getByRole('combobox', { name: 'Search documentation' });
    await expect(input).toBeFocused();
    await input.fill(QUERY);

    const results = page.getByRole('option');
    await expect(results.first()).toBeVisible();

    // Selection is expressed through aria-activedescendant, not focus — the
    // input keeps focus so typing continues to work.
    await expect(input).toHaveAttribute(
      'aria-activedescendant',
      'search-result-0',
    );

    const count = await results.count();
    expect(count).toBeGreaterThan(1);

    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveAttribute(
      'aria-activedescendant',
      'search-result-1',
    );

    // Wrap-around: Up twice from index 1 lands on the last result.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(input).toHaveAttribute(
      'aria-activedescendant',
      `search-result-${count - 1}`,
    );

    // Back to the top, so what Enter opens is deterministic.
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveAttribute(
      'aria-activedescendant',
      'search-result-0',
    );

    const activeTitle = await page
      .locator('.search-result.active .search-result-title')
      .innerText();

    await Promise.all([
      page.waitForURL(url => url.pathname !== DOCS_PAGE),
      page.keyboard.press('Enter'),
    ]);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      activeTitle,
    );
    await expect(page.locator('#search-modal')).toBeHidden();
  });
});

test.describe('search dialog focus trap', () => {
  test('Tab cycles within the dialog and never escapes to the page', async ({
    page,
  }) => {
    await gotoDocs(page);
    await page.getByRole('button', { name: 'Search documentation' }).click();

    const dialog = page.locator('#search-modal');
    await expect(dialog).toBeVisible();

    // Eight presses over a two-stop cycle: enough to wrap three times.
    const forward = await tabCycle(page, 8);
    expect(
      forward.filter(probe => probe.zone === 'page'),
      'focus reached an element behind the modal',
    ).toEqual([]);

    // Empty, the dialog holds exactly two focusable controls. Once results
    // render, .search-body can add a third — see the next test.
    expect(
      new Set(forward.filter(p => p.zone === 'dialog').map(p => p.label)),
    ).toEqual(new Set(['search-input', 'search-close']));

    // Backwards is a separate code path in the browser.
    const backward = await tabCycle(page, 8, { shift: true });
    expect(
      backward.filter(probe => probe.zone === 'page'),
      'Shift+Tab reached an element behind the modal',
    ).toEqual([]);
    expect(backward.some(probe => probe.zone === 'dialog')).toBe(true);
  });

  test('the trap holds once real results are rendered', async ({ page }) => {
    await gotoDocs(page);
    await page.getByRole('button', { name: 'Search documentation' }).click();

    const input = page.getByRole('combobox', { name: 'Search documentation' });
    await input.fill(QUERY);
    await expect(page.getByRole('option').first()).toBeVisible();

    // Results are announced through aria-activedescendant, so adding a list of
    // them must not add a list of tab stops.
    const probes = await tabCycle(page, 10);
    expect(
      probes.filter(probe => probe.zone === 'page'),
      'focus reached an element behind the modal once results rendered',
    ).toEqual([]);

    const stops = new Set(
      probes.filter(p => p.zone === 'dialog').map(p => p.label),
    );

    // The invariant: no individual result is ever a tab stop. Options carry
    // role="option" and no tabindex, so the only way one appears here is if
    // someone made them focusable and broke the combobox contract.
    expect(
      [...stops].filter(label => label.startsWith('search-result-')),
      'a result became a tab stop — selection belongs to aria-activedescendant',
    ).toEqual([]);

    // Both real controls stay reachable.
    expect(stops.has('search-input')).toBe(true);
    expect(stops.has('search-close')).toBe(true);

    // `search-body` is allowed, and appears once the list is long enough to
    // scroll. `.search-body` is `overflow-y: auto` with no focusable
    // descendants, and Chromium makes such a scroller focusable so a keyboard
    // user can scroll it at all. That is the feature working, not a leak — it
    // is inside the dialog, and the trap assertion above still holds.
    expect(
      [...stops].filter(
        label =>
          !['search-input', 'search-close', 'search-body'].includes(label),
      ),
      'an unexpected element inside the dialog became a tab stop',
    ).toEqual([]);
  });

  test('the page behind the dialog is inert', async ({ page }) => {
    await gotoDocs(page);
    await page.getByRole('button', { name: 'Search documentation' }).click();
    await expect(page.locator('#search-modal')).toBeVisible();

    // showModal() makes everything outside the dialog inert, so even a direct
    // programmatic focus() is refused. This is the property jsdom cannot model
    // at all — it has no showModal() to begin with.
    const focused = await page.evaluate(() => {
      const link = document.querySelector<HTMLElement>('.sidebar-link');
      link?.focus();
      return document.activeElement === link;
    });
    expect(focused, 'a link behind the modal took focus').toBe(false);
  });

  test('Esc closes and returns focus to the trigger', async ({ page }) => {
    await gotoDocs(page);

    const trigger = page.getByRole('button', { name: 'Search documentation' });
    await trigger.click();

    const dialog = page.locator('#search-modal');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('a backdrop click closes the dialog', async ({ page }) => {
    await gotoDocs(page);
    await page.getByRole('button', { name: 'Search documentation' }).click();

    const dialog = page.locator('#search-modal');
    await expect(dialog).toBeVisible();

    // showModal() stretches the dialog's own box across the viewport for
    // centering, so the backdrop is the dialog element itself — see
    // SearchDialog.svelte's onDialogClick. Only a real layout engine can
    // produce this hit test, which is why it lives here and not in jsdom.
    await dialog.click({ position: { x: 5, y: 5 } });
    await expect(dialog).toBeHidden();
  });
});
