import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isDocVisible } from '../utils/docs';

// A docs page can be gated out of the build (SITE_CONFIG.harborEnabled is the
// first one), and the links pointing at it live in Markdown, which cannot
// branch on a flag. So the two failure modes are symmetric, and both are
// silent:
//
//   flag off, link kept    -> the link 404s in production.
//   flag on, link missing  -> the page ships unreachable, and the launch step
//                             that was meant to restore the link is forgotten.
//
// The first is the damaging one; the second is the one a person has to
// remember, which is why it is worth a test rather than a comment. Together
// they make flipping a flag a mechanical change: run the suite, and it names
// whatever prose still has to follow.
//
// This is the routing counterpart to internal-links.test.ts. That one holds the
// trailing-slash *form* of every internal link; this one holds that the route
// on the other end is actually built, and that everything built is reachable.
const SRC = fileURLToPath(new URL('..', import.meta.url));
const DOCS = fileURLToPath(new URL('../content/docs', import.meta.url));

// The repository README is the project's other front door, and it links into
// the docs site by absolute URL. A dead link there is as broken as one on the
// site, and it is outside every other scan in this suite.
const README = fileURLToPath(new URL('../../../../README.md', import.meta.url));

const SCANNED_EXTENSIONS = ['.astro', '.svelte', '.md', '.ts'];

/**
 * A docs route in an href or a Markdown link target, root-relative as the site
 * writes them or absolute as the README does.
 */
const DOCS_ROUTE =
  /(?:href=(?:"|'|\{`)|\]\()(?:https:\/\/shipbench\.dev)?(\/docs\/[^"'`)\s{}]*)/g;

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

function slugsLinkedIn(file: string): string[] {
  return docRoutesIn(readFileSync(file, 'utf8'))
    .map(slugOf)
    .filter((slug): slug is string => slug !== null);
}

describe('docs routes', () => {
  const files = [...sourceFiles(SRC), README];
  const ids = docIds();

  it('scans the source tree, the README, and the docs collection', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(existsSync(README)).toBe(true);
    expect(ids).toContain('harbor');
  });

  it.each(files.map(file => [relative(SRC, file), file] as const))(
    '%s links only to docs pages this build publishes',
    (_name, file) => {
      const unbuilt = slugsLinkedIn(file).filter(
        slug => !ids.includes(slug) || !isDocVisible(slug),
      );

      expect(unbuilt).toEqual([]);
    },
  );

  // The other direction. A page nobody links to is unreachable except through
  // search, and the sidebar does not count: it is generated from the same
  // filtered collection, so it would call every page reachable by construction
  // and prove nothing. Computed `/docs/${id}/` links are flattened away for
  // exactly that reason, which leaves only hand-authored links standing here.
  it('links to every docs page this build publishes', () => {
    const linked = new Set(files.flatMap(slugsLinkedIn));
    const orphans = ids.filter(id => isDocVisible(id) && !linked.has(id));

    expect(orphans).toEqual([]);
  });
});
