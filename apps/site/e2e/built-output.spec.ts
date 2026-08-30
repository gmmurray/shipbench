/**
 * Built-artifact probes: assertions against `dist/` itself, no browser involved.
 *
 * This is a third technique, distinct from both the component tests and the
 * browser tests above, and it catches a class of regression neither does — one
 * where the page still *works* in a fast, unthrottled browser but has lost the
 * property that makes it work on a slow one:
 *
 * - `is:inline` quietly dropped from the theme bootstrap, so it becomes a
 *   deferred module and the theme applies after first paint.
 * - The bootstrap landing after the stylesheet instead of above it.
 * - The search controller's dynamic import getting resolved at bundle time, so
 *   `/pagefind/pagefind.js` stops being loaded from the deployed path.
 * - `data-pagefind-body` scoping changing, silently pulling the landing page
 *   into docs search results.
 *
 * These live here rather than in `apps/site`'s vitest suite for one reason:
 * they require a production build, and `pnpm test` must stay runnable without
 * one. The harness already guarantees the build (see playwright.config.ts), so
 * they cost nothing extra here.
 *
 * The technique originally ran in jsdom against the inlined bundle; jsdom was
 * never load-bearing, so it is gone. Plain text parsing says the same things.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const DIST = fileURLToPath(new URL('./../dist/client/', import.meta.url));
const CLI_VERSION = (
  JSON.parse(
    readFileSync(new URL('../../cli/package.json', import.meta.url), 'utf8'),
  ) as { version: string }
).version;

const DOC_PAGES = [
  'docs/why',
  'docs/overview',
  'docs/quickstart',
  'docs/cli-reference',
  'docs/convention-spec',
  'docs/harbor',
  'docs/workflows',
  'docs/solo-trunk-workflow',
  'docs/concurrent-agents',
  'docs/recipe-worktree-rules',
  'docs/recipe-review-gate',
  'docs/recipe-gitignore-layout',
];

const ALL_PAGES = ['', ...DOC_PAGES];

function html(route: string): string {
  return readFileSync(`${DIST}${route}${route ? '/' : ''}index.html`, 'utf8');
}

function headOf(source: string): string {
  const end = source.indexOf('</head>');
  expect(end, 'no </head> in the built page').toBeGreaterThan(0);
  return source.slice(0, end);
}

function titleOf(head: string): string {
  const match = head.match(/<title>([^<]+)<\/title>/);
  expect(match, 'no <title> in the built page').not.toBeNull();
  return match![1];
}

function descriptionOf(head: string): string {
  const match = head.match(/<meta name="description" content="([^"]+)"/);
  expect(match, 'no meta description in the built page').not.toBeNull();
  return match![1];
}

function canonicalFor(route: string): string {
  return route ? `https://shipbench.dev/${route}/` : 'https://shipbench.dev/';
}

test.describe('theme bootstrap survives the build', () => {
  for (const route of ALL_PAGES) {
    test(`inline and above the stylesheet on /${route}`, () => {
      const head = headOf(html(route));

      // Searching for the source text proves it is still *inline*: if
      // `is:inline` were dropped, Astro would hoist it into a bundled module
      // and only a <script src> would remain here.
      const bootstrap = head.indexOf("localStorage.getItem('theme')");
      expect(
        bootstrap,
        'the theme bootstrap is no longer inline in <head> — is:inline dropped?',
      ).toBeGreaterThan(-1);

      const stylesheet = head.search(/<link[^>]+rel="stylesheet"/);
      if (stylesheet > -1) {
        expect(
          bootstrap,
          'the theme bootstrap now loads after the stylesheet, so a frame can paint before it runs',
        ).toBeLessThan(stylesheet);
      }

      const externalScript = head.search(/<script[^>]+\ssrc=/);
      if (externalScript > -1) {
        expect(
          bootstrap,
          'an external script now precedes the theme bootstrap',
        ).toBeLessThan(externalScript);
      }

      // The re-apply hook. ClientRouter's swapRootAttributes wipes data-theme
      // on every navigation; without this the theme survives only the first
      // page view.
      expect(head).toContain('astro:after-swap');
    });
  }

  test('no bundled chunk carries the bootstrap instead', () => {
    // `applyStoredTheme` is unique to our bootstrap. Matching on
    // `astro:after-swap` would hit ClientRouter's own chunk, which legitimately
    // fires that event.
    const hoisted = readdirSync(`${DIST}_astro`)
      .filter(file => file.endsWith('.js'))
      .filter(file =>
        readFileSync(`${DIST}_astro/${file}`, 'utf8').includes(
          'applyStoredTheme',
        ),
      );
    expect(
      hoisted,
      'the theme bootstrap was bundled into a chunk — it must stay inline',
    ).toEqual([]);
  });

  test('both theme-color variants ship', () => {
    const head = headOf(html(''));
    expect(head).toMatch(
      /<meta name="theme-color"[^>]+media="\(prefers-color-scheme: dark\)"/,
    );
    expect(head).toMatch(
      /<meta name="theme-color"[^>]+media="\(prefers-color-scheme: light\)"/,
    );
  });
});

test('the generated platform icon set ships with the preferred SVG favicon', () => {
  const head = headOf(html(''));
  const raster = head.indexOf(
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">',
  );
  const vector = head.indexOf(
    '<link rel="icon" type="image/svg+xml" href="/logo.svg">',
  );

  expect(raster, 'the PNG favicon declaration is missing').toBeGreaterThan(-1);
  expect(vector, 'the SVG favicon declaration is missing').toBeGreaterThan(-1);
  expect(
    raster,
    'the PNG fallback must precede the preferred SVG icon',
  ).toBeLessThan(vector);
  expect(head).toContain(
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  );
  expect(head).toContain('<link rel="manifest" href="/site.webmanifest">');

  for (const asset of [
    'favicon.png',
    'logo.svg',
    'apple-touch-icon.png',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'site.webmanifest',
  ]) {
    expect(existsSync(`${DIST}${asset}`), `${asset} is missing`).toBe(true);
  }
});

test.describe('search wiring survives the build', () => {
  test('a chunk still imports the Pagefind bundle from its deployed path', () => {
    const chunks = readdirSync(`${DIST}_astro`)
      .filter(file => file.endsWith('.js'))
      .filter(file =>
        readFileSync(`${DIST}_astro/${file}`, 'utf8').includes(
          '/pagefind/pagefind.js',
        ),
      );
    expect(
      chunks.length,
      'no chunk references /pagefind/pagefind.js — the dynamic import was resolved at bundle time',
    ).toBeGreaterThan(0);
  });

  test('the Pagefind index exists and covers every docs page', () => {
    expect(existsSync(`${DIST}pagefind/pagefind.js`)).toBe(true);

    const entry = JSON.parse(
      readFileSync(`${DIST}pagefind/pagefind-entry.json`, 'utf8'),
    ) as { languages: Record<string, { page_count: number }> };

    const pages = Object.values(entry.languages).reduce(
      (total, language) => total + language.page_count,
      0,
    );
    expect(pages).toBe(DOC_PAGES.length);
  });

  test('indexing stays scoped to docs bodies', () => {
    for (const route of DOC_PAGES) {
      expect(html(route)).toContain('data-pagefind-body');
    }
    // The landing page has no data-pagefind-body, which is what keeps it out
    // of docs results — see the "Ignoring pages without this tag" line in the
    // Pagefind build output.
    expect(html('')).not.toContain('data-pagefind-body');
  });

  test('docs chrome is excluded from the index', () => {
    const page = html('docs/overview');
    // Breadcrumbs, meta line, and the prev/next cards. Without these the
    // phrase "Next →" would match a query on every page.
    expect(
      (page.match(/data-pagefind-ignore/g) ?? []).length,
    ).toBeGreaterThanOrEqual(3);
  });
});

test.describe('search and sharing metadata survives the build', () => {
  test('docs chrome displays the CLI manifest version', () => {
    const page = html('docs/overview');

    expect(page).toContain(`<span class="badge-docs">v${CLI_VERSION}</span>`);
    expect(page).toContain(`<span>shipbench v${CLI_VERSION}</span>`);
  });

  test('every page has unique titles and descriptions', () => {
    const heads = ALL_PAGES.map(route => headOf(html(route)));
    const titles = heads.map(titleOf);
    const descriptions = heads.map(descriptionOf);

    expect(new Set(titles).size).toBe(ALL_PAGES.length);
    expect(new Set(descriptions).size).toBe(ALL_PAGES.length);
  });

  for (const route of ALL_PAGES) {
    test(`canonical and social tags on /${route}`, () => {
      const head = headOf(html(route));
      const title = titleOf(head);
      const description = descriptionOf(head);
      const canonical = canonicalFor(route);

      expect(head).toContain(`rel="canonical" href="${canonical}"`);
      expect(head).toContain('rel="sitemap" href="/sitemap-index.xml"');
      expect(head).toContain('name="robots" content="index,follow"');

      expect(head).toContain('property="og:type" content="website"');
      expect(head).toContain(`property="og:title" content="${title}"`);
      expect(head).toContain(
        `property="og:description" content="${description}"`,
      );
      expect(head).toContain(`property="og:url" content="${canonical}"`);
      expect(head).toContain(
        'property="og:image" content="https://shipbench.dev/opengraph.png"',
      );
      expect(head).toContain('property="og:image:width" content="1200"');
      expect(head).toContain('property="og:image:height" content="630"');
      expect(head).toContain('property="og:image:alt"');

      expect(head).toContain(
        'name="twitter:card" content="summary_large_image"',
      );
      expect(head).toContain(`name="twitter:title" content="${title}"`);
      expect(head).toContain(
        `name="twitter:description" content="${description}"`,
      );
      expect(head).toContain(
        'name="twitter:image" content="https://shipbench.dev/opengraph.png"',
      );
    });
  }

  test('home page declares the ShipBench site name', () => {
    const homeHead = headOf(html(''));
    expect(homeHead).toContain('type="application/ld+json"');
    expect(homeHead).toContain('"@type":"WebSite"');
    expect(homeHead).toContain('"name":"ShipBench"');
    expect(homeHead).toContain('"url":"https://shipbench.dev"');
  });

  test('robots and sitemap expose every canonical page', () => {
    const robotsPath = `${DIST}robots.txt`;
    const sitemapIndexPath = `${DIST}sitemap-index.xml`;
    const sitemapPath = `${DIST}sitemap-0.xml`;

    expect(existsSync(robotsPath)).toBe(true);
    expect(existsSync(sitemapIndexPath)).toBe(true);
    expect(existsSync(sitemapPath)).toBe(true);
    expect(readFileSync(robotsPath, 'utf8')).toContain(
      'Sitemap: https://shipbench.dev/sitemap-index.xml',
    );
    expect(readFileSync(sitemapIndexPath, 'utf8')).toContain(
      'https://shipbench.dev/sitemap-0.xml',
    );

    const sitemap = readFileSync(sitemapPath, 'utf8');
    for (const route of ALL_PAGES) {
      expect(sitemap).toContain(`<loc>${canonicalFor(route)}</loc>`);
    }
  });
});

test.describe('heading hierarchy survives the build', () => {
  for (const route of ALL_PAGES) {
    test(`one h1 and no skipped levels on /${route}`, () => {
      const levels = Array.from(html(route).matchAll(/<h([1-6])\b/g), match =>
        Number(match[1]),
      );

      expect(levels.filter(level => level === 1)).toHaveLength(1);
      expect(levels[0]).toBe(1);
      for (let index = 1; index < levels.length; index += 1) {
        expect(
          levels[index] - levels[index - 1],
          `heading level jumps from h${levels[index - 1]} to h${levels[index]}`,
        ).toBeLessThanOrEqual(1);
      }
    });
  }
});

test('docs tables ship as accessible scroll regions before JavaScript runs', () => {
  const page = html('docs/cli-reference');
  const tables = page.match(/<table>/g) ?? [];
  const regions =
    page.match(
      /<div class="table-scroll" tabindex="0" role="region" aria-label="[^"]+ table">/g,
    ) ?? [];

  expect(tables.length).toBeGreaterThan(0);
  expect(regions).toHaveLength(tables.length);
});

test.describe('landing-page flow survives the build', () => {
  test('keeps repository mechanics, local interfaces, and Harbor distinct', () => {
    const home = html('');

    expect(home).toContain('How It Works');
    expect(home).toContain('Three Local Interfaces');
    expect(home).toContain('Direct Markdown');
    expect(home).toContain('Local Board');
    expect(home).toContain('ShipBench CLI');
    expect(home).toContain('ShipBench Harbor is the optional hosted client');
    expect(home).not.toContain('One System, Multiple Clients');
    expect(home).not.toContain('Dual Control Model');
  });

  test('marks every illustrative home-page code block as non-copyable', () => {
    const home = html('');
    const codeBlocks = home.match(/<pre[^>]+data-code-block[^>]*>/g) ?? [];

    expect(codeBlocks).toHaveLength(3);
    for (const block of codeBlocks) {
      expect(block).toContain('data-copy-disabled');
    }

    expect(html('docs/quickstart')).not.toContain('data-copy-disabled');
  });
});
