import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The site builds with Astro's `directory` format, so /docs/why is served as
// /docs/why/index.html and the real URL carries a trailing slash. BaseLayout
// normalizes the canonical tag to that form and the sitemap follows it — but
// nothing stopped a link being authored without it, and most of them were.
// A bare path costs a 307 before the 200, and ClientRouter prefetches on hover,
// so the wasted round trip was being paid site-wide for links nobody clicked.
//
// Source scan rather than a check on built HTML: this has to fail where the
// link is written, and 44 links reverting one at a time is the drift mode.
const SRC = fileURLToPath(new URL('..', import.meta.url));

const SCANNED_EXTENSIONS = ['.astro', '.svelte', '.md', '.ts'];

/** `href="/x"`, `href='/x'`, and `href={`/x`}` alike. */
const HREF = /href=(?:"|'|\{`)(\/[^"'`{}\s]*)/g;
/** Markdown `[text](/x)`. */
const MARKDOWN_LINK = /\]\((\/[^)\s]*)\)/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (entry.name.endsWith('.test.ts')) return [];
    return SCANNED_EXTENSIONS.some(ext => entry.name.endsWith(ext))
      ? [full]
      : [];
  });
}

/**
 * A route needs the slash; a file does not. Anything whose last segment has an
 * extension is an asset (/favicon.png, /sitemap-index.xml, /site.webmanifest).
 */
function isAsset(path: string): boolean {
  const last = path.split('/').pop() ?? '';
  return /\.[a-z0-9]+$/i.test(last);
}

function bareRoutesIn(source: string): string[] {
  // Collapse `${expr}` to a single segment character first. Without this the
  // capture would stop at the interpolation, so `/docs/${id}` and the correct
  // `/docs/${id}/` would both read as `/docs/` and the check would pass on the
  // one case it exists to catch.
  const flattened = source.replace(/\$\{[^{}]*\}/g, 'X');
  const found: string[] = [];

  for (const pattern of [HREF, MARKDOWN_LINK]) {
    pattern.lastIndex = 0;
    for (const match of flattened.matchAll(pattern)) {
      const href = match[1];
      const [route] = href.split('#');
      if (route === '/' || route.endsWith('/') || isAsset(route)) continue;
      found.push(href);
    }
  }

  return found;
}

describe('internal links', () => {
  const files = sourceFiles(SRC);

  it('scans the source tree it claims to', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map(file => [relative(SRC, file), file] as const))(
    '%s links to canonical trailing-slash routes',
    (_name, file) => {
      expect(bareRoutesIn(readFileSync(file, 'utf8'))).toEqual([]);
    },
  );
});
