/**
 * Classification of a Markdown link found in a task body or update.
 *
 * Task bodies overwhelmingly link to files in the same repo — relative paths
 * written for someone reading the raw Markdown next to a checkout. Rendered in
 * the Board, those hrefs resolve against the board's own origin and 404. This
 * module turns an href into what it actually means, so the renderer can send it
 * somewhere real.
 */
export type BoardLink =
  /** In-page anchors, `mailto:`, and anything else the default renderer already handles correctly. */
  | { kind: 'default' }
  /** Absolute `http(s)` — leaves the board, so it wants a new tab. */
  | { kind: 'external' }
  /**
   * A path inside the repo, resolved to repo-root-relative form. `suffix` holds
   * any query/hash to re-append after the host names a destination. `taskSlug`
   * is set when the path names a live task file, which the Board can open
   * in-place instead of navigating away.
   */
  | {
      kind: 'repo';
      path: string;
      suffix: string;
      taskSlug: string | null;
    };

/**
 * Task files live at `.shipbench/tasks/<slug>.md`. The convention fixes that
 * directory, so resolving a relative href from a task body is arithmetic, not a
 * guess.
 */
const TASK_DIR = '.shipbench/tasks/';

/** Parsing-only origin. Nothing is ever fetched from it; it exists so `new URL` can do path arithmetic. */
const BASE_ORIGIN = 'https://board.shipbench.invalid';

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const TASK_FILE = /^\.shipbench\/tasks\/([^/]+)\.md$/;

function decodePath(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    // Malformed percent-encoding — not a path we can hand to a host.
    return null;
  }
}

export function classifyLink(href: string): BoardLink {
  const value = href.trim();

  // An in-page anchor already works, and `react-markdown`'s `defaultUrlTransform`
  // has blanked anything with an unsafe scheme before we see it.
  if (!value || value.startsWith('#')) return { kind: 'default' };

  // Protocol-relative (`//example.com/x`) is absolute in every way that matters.
  if (value.startsWith('//')) return { kind: 'external' };

  const scheme = SCHEME.exec(value);
  if (scheme) {
    return /^https?$/i.test(scheme[1])
      ? { kind: 'external' }
      : { kind: 'default' };
  }

  // Markdown resolves a relative href against the file containing it. Explicit
  // `./` and `../` honour that — task files sit in `.shipbench/tasks/`. A bare
  // path (`apps/site/foo.ts`) means the same thing by the spec, which would make
  // it `.shipbench/tasks/apps/site/foo.ts` — never what an author intended. Bare
  // paths resolve against the repo root instead. Anything genuinely adjacent to
  // a task file is another task, and those are matched below by slug anyway.
  const base =
    value.startsWith('./') || value.startsWith('../')
      ? `${BASE_ORIGIN}/${TASK_DIR}`
      : `${BASE_ORIGIN}/`;

  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return { kind: 'default' };
  }

  if (url.origin !== BASE_ORIGIN) return { kind: 'external' };

  const path = decodePath(url.pathname);
  if (!path) return { kind: 'default' };

  const taskFile = TASK_FILE.exec(path);

  return {
    kind: 'repo',
    path,
    suffix: `${url.search}${url.hash}`,
    taskSlug: taskFile ? taskFile[1] : null,
  };
}
