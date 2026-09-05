import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isDocVisible } from '../utils/docs';

// A docs page can be gated out of the build (SITE_CONFIG.harborEnabled is the
// first one), and the links pointing at it live in Markdown, which cannot
// branch on a flag. So the failure mode is a link that survives the page it
// pointed to and 404s in production — silently, because nothing else in the
// suite reads routes and links together.
//
// This is the source-side counterpart to internal-links.test.ts: that one holds
// the trailing-slash form of every internal link, this one holds that the route
// on the other end is actually built. Same scan, different question.
const SRC = fileURLToPath(new URL('..', import.meta.url));
const DOCS = fileURLToPath(new URL('../content/docs', import.meta.url));

const SCANNED_EXTENSIONS = ['.astro', '.svelte', '.md', '.ts'];

/** `/docs/<slug>/` in an href or a Markdown link target. */
const DOCS_ROUTE = /(?:href=(?:"|'|\{`)|\]\()(\/docs\/[^"'`)\s{}]*)/g;

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

/** Collection ids, the same way `glob()` derives them: filename, no extension. */
function docIds(): string[] {
  return readdirSync(DOCS)
    .filter(name => name.endsWith('.md'))
    .map(name => name.replace(/\.md$/, ''));
}

function docRoutesIn(source: string): string[] {
  // `/docs/${id}/` is a computed link over the already-filtered collection, so
  // it cannot name a gated page. Flatten it to a single segment rather than
  // reading `${id}` as a literal slug.
  const flattened = source.replace(/\$\{[^{}]*\}/g, 'X');
  DOCS_ROUTE.lastIndex = 0;
  return [...flattened.matchAll(DOCS_ROUTE)].map(match => match[1]);
}

/** `/docs/harbor/#anchor` -> `harbor`. `X` marks a flattened interpolation. */
function slugOf(route: string): string | null {
  const [path] = route.split('#');
  const slug = path.replace(/^\/docs\//, '').replace(/\/$/, '');
  return slug === '' || slug === 'X' ? null : slug;
}

describe('docs routes', () => {
  const files = sourceFiles(SRC);
  const ids = docIds();

  it('scans the source tree and the docs collection it claims to', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(ids).toContain('harbor');
  });

  it.each(files.map(file => [relative(SRC, file), file] as const))(
    '%s links only to docs pages this build publishes',
    (_name, file) => {
      const unbuilt = docRoutesIn(readFileSync(file, 'utf8'))
        .map(slugOf)
        .filter((slug): slug is string => slug !== null)
        .filter(slug => !ids.includes(slug) || !isDocVisible(slug));

      expect(unbuilt).toEqual([]);
    },
  );
});
