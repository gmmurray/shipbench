/**
 * Theme helpers shared by the flash, screenshot, and axe specs.
 *
 * The three-state model lives in src/styles/tokens.css and is applied before
 * first paint by the inline bootstrap in BaseLayout.astro. These helpers drive
 * both halves of that model independently: the *stored choice* (localStorage)
 * and the *OS preference* (emulated media). Setting them to opposite values is
 * what makes the no-flash assertion meaningful.
 */

import type { Page } from '@playwright/test';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type OsScheme = 'light' | 'dark';

/** `--canvas` per theme, as Chromium reports computed `background-color`. */
export const CANVAS = {
  dark: 'rgb(24, 23, 28)',
  light: 'rgb(236, 237, 242)',
} as const satisfies Record<OsScheme, string>;

/** What `getComputedStyle` reports before any stylesheet has applied. */
export const CANVAS_UNSTYLED = 'rgba(0, 0, 0, 0)';

export interface PaintSample {
  /** ms since navigation start. */
  t: number;
  /** Computed `background-color` of <html> for the frame about to be painted. */
  background: string;
  /** `data-theme` on <html>, or null for System. */
  theme: string | null;
}

declare global {
  interface Window {
    __paintSamples?: PaintSample[];
  }
}

/**
 * Seed the stored theme choice before any page script runs.
 *
 * Init scripts execute in registration order and ahead of the document's own
 * scripts, so this lands before BaseLayout's inline bootstrap reads it — which
 * is exactly the ordering a returning visitor experiences.
 */
export async function seedThemeChoice(
  page: Page,
  choice: ThemeChoice,
): Promise<void> {
  await page.addInitScript(stored => {
    try {
      if (stored === 'system') localStorage.removeItem('theme');
      else localStorage.setItem('theme', stored);
    } catch {
      /* Storage unavailable; the test asserting a stored choice will fail. */
    }
  }, choice);
}

/**
 * Record the root background for every frame the browser is about to paint.
 *
 * rAF callbacks run after style/layout and immediately before the frame is
 * composited, so each sample is what that frame renders. A theme applied late
 * shows up here as one or more frames on the wrong canvas — the assertion the
 * light-theme task could only make about script *ordering*.
 */
export async function recordPaintSamples(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const samples: PaintSample[] = [];
    window.__paintSamples = samples;

    const tick = () => {
      const root = document.documentElement;
      if (root) {
        samples.push({
          t: Math.round(performance.now()),
          background: getComputedStyle(root).backgroundColor,
          theme: root.getAttribute('data-theme'),
        });
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

export async function readPaintSamples(page: Page): Promise<PaintSample[]> {
  return page.evaluate(() => window.__paintSamples ?? []);
}

/**
 * Widen the window in which a mis-ordered theme bootstrap would be visible.
 *
 * Two levers, and only two on purpose:
 *
 * - **Slow scripts.** Every external script gets a delay, so a bootstrap that
 *   stopped being inline (`is:inline` dropped, moved into an island, deferred
 *   behind a bundle) loses the race to first paint by a wide margin.
 * - **Slow the CPU**, which stretches parse and execute for the same reason.
 *
 * Stylesheets are deliberately *not* delayed. CSS is render-blocking, so
 * slowing it postpones first paint and hands a late script extra time to sneak
 * in — that would hide a flash, not expose one.
 */
export async function throttleFirstPaint(page: Page): Promise<void> {
  await page.route('**/*.js', async route => {
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.continue();
  });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 });
}
