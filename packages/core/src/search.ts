import type { Task } from './types.js';

export type TaskSearchField = 'title' | 'tags' | 'body';

export interface TaskSearchMatch {
  slug: string;
  title: string;
  matched_fields: TaskSearchField[];
  snippet?: string;
}

const SNIPPET_CONTEXT_BEFORE = 40;
const SNIPPET_CONTEXT_AFTER = 80;

function bodySnippet(
  normalizedBody: string,
  normalizedTerms: readonly string[],
): string | undefined {
  const lowercaseBody = normalizedBody.toLowerCase();
  let matchIndex = -1;
  let matchLength = 0;
  for (const term of normalizedTerms) {
    const termIndex = lowercaseBody.indexOf(term);
    if (
      termIndex !== -1 &&
      (matchIndex === -1 ||
        termIndex < matchIndex ||
        (termIndex === matchIndex && term.length > matchLength))
    ) {
      matchIndex = termIndex;
      matchLength = term.length;
    }
  }
  if (matchIndex === -1) return undefined;

  const start = Math.max(0, matchIndex - SNIPPET_CONTEXT_BEFORE);
  const end = Math.min(
    normalizedBody.length,
    matchIndex + matchLength + SNIPPET_CONTEXT_AFTER,
  );
  const excerpt = normalizedBody.slice(start, end).trim();
  return `${start > 0 ? '…' : ''}${excerpt}${end < normalizedBody.length ? '…' : ''}`;
}

/**
 * Splits the query on whitespace and finds tasks in which every
 * case-insensitive term occurs as a substring of a title, tag, or Markdown
 * body. Terms may occur in different fields. Input order is preserved so
 * callers can sort before search and limit the returned matches afterward.
 */
export function searchTasks(
  tasks: readonly Task[],
  query: string,
): TaskSearchMatch[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const normalizedTerms = normalizedQuery.split(/\s+/);

  const matches: TaskSearchMatch[] = [];
  for (const task of tasks) {
    const normalizedTitle = task.frontmatter.title.toLowerCase();
    const normalizedTags = (task.frontmatter.tags ?? []).map(tag =>
      tag.toLowerCase(),
    );
    const normalizedBody = task.body.replace(/\s+/g, ' ').trim();
    const lowercaseBody = normalizedBody.toLowerCase();

    const everyTermMatches = normalizedTerms.every(
      term =>
        normalizedTitle.includes(term) ||
        normalizedTags.some(tag => tag.includes(term)) ||
        lowercaseBody.includes(term),
    );
    if (!everyTermMatches) continue;

    const matchedFields: TaskSearchField[] = [];
    if (normalizedTerms.some(term => normalizedTitle.includes(term))) {
      matchedFields.push('title');
    }
    if (
      normalizedTerms.some(term =>
        normalizedTags.some(tag => tag.includes(term)),
      )
    ) {
      matchedFields.push('tags');
    }

    const snippet = bodySnippet(normalizedBody, normalizedTerms);
    if (snippet !== undefined) matchedFields.push('body');

    matches.push({
      slug: task.slug,
      title: task.frontmatter.title,
      matched_fields: matchedFields,
      ...(snippet !== undefined ? { snippet } : {}),
    });
  }

  return matches;
}
