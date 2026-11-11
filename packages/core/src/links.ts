import type { Task } from './types.js';

/**
 * Markdown links between task files.
 *
 * Task bodies link to each other by relative path, written for someone reading
 * the raw file: `[the decision](choose-a-store.md)`. Archiving moves a file
 * into `tasks/archive/` without rewriting anyone's links, so a link across the
 * live/archive line stops resolving. These helpers find those links so a host
 * can say which tasks an archive would affect. Nothing here rewrites a file.
 */

const INLINE_LINK =
  /\]\(\s*(<[^>\n]*>|[^\s)]+)(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?\s*\)/g;
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]\n]+\]:\s*(<[^>\n]*>|\S+)/gm;
const FENCED_CODE =
  /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*$|(?![\s\S]))/gm;
const INLINE_CODE = /(`+)[^`]*?\1/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * The forms that name a task file, from either `tasks/` or `tasks/archive/`.
 * Slugs are never reused across the two, so the slug alone identifies the task.
 *
 * - `<slug>.md` and `./<slug>.md`: a sibling.
 * - `archive/<slug>.md`: from a live task into the archive.
 * - `../<slug>.md`: from an archived task back to a live one.
 * - any path ending `.shipbench/tasks/[archive/]<slug>.md`.
 */
const TASK_HREF =
  /^(?:\.\/)?(?:archive\/|\.\.\/)?([^/]+)\.md$|(?:^|\/)\.shipbench\/tasks\/(?:archive\/)?([^/]+)\.md$/;

function taskSlugOfHref(raw: string): string | null {
  const href = raw.startsWith('<') ? raw.slice(1, -1).trim() : raw;
  if (!href || href.startsWith('#') || SCHEME.test(href)) return null;

  const path = href.replace(/[?#].*$/, '');
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }

  const match = TASK_HREF.exec(decoded);
  return match ? (match[1] ?? match[2]) : null;
}

/**
 * Slugs of the task files a Markdown document links to, in first-seen order.
 * Links inside code are examples, not links, so they are skipped.
 */
export function taskLinkTargets(markdown: string): string[] {
  const prose = markdown.replace(FENCED_CODE, '').replace(INLINE_CODE, '');
  const slugs = new Set<string>();

  for (const pattern of [INLINE_LINK, REFERENCE_DEFINITION]) {
    for (const match of prose.matchAll(pattern)) {
      const slug = taskSlugOfHref(match[1]);
      if (slug) slugs.add(slug);
    }
  }

  return [...slugs];
}

/**
 * Slugs of the tasks whose description or Task Updates link to `slug`, sorted.
 * The task itself is never included.
 */
export function tasksLinkingTo(tasks: readonly Task[], slug: string): string[] {
  return tasks
    .filter(
      task =>
        task.slug !== slug &&
        [task.body, ...task.comments.map(comment => comment.text)].some(text =>
          taskLinkTargets(text).includes(slug),
        ),
    )
    .map(task => task.slug)
    .sort();
}
