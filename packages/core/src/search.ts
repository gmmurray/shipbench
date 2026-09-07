import type { Task } from './types.js';

export type TaskSearchField = 'title' | 'tags' | 'body' | 'updates';

/**
 * A Task Updates entry that matched the query. A readable entry carries its
 * zero-based `index` and ISO `timestamp` so a caller can retrieve the exact
 * source (`task get`, or the file). An unreadable (quarantined) section has
 * neither — only its verbatim text — so it reports `unreadable: true` instead.
 */
export type TaskUpdateMatch =
  | { index: number; timestamp: string; snippet: string }
  | { unreadable: true; snippet: string };

export interface TaskSearchMatch {
  slug: string;
  title: string;
  /**
   * The task's current column at search time. Lets a reader tell recorded
   * reasoning (an Update match) from the task's present state — search never
   * claims an old decision is still in force.
   */
  status: string;
  matched_fields: TaskSearchField[];
  snippet?: string;
  /** Present when one or more Task Updates entries matched. */
  update_matches?: TaskUpdateMatch[];
}

const SNIPPET_CONTEXT_BEFORE = 40;
const SNIPPET_CONTEXT_AFTER = 80;

/**
 * Relevance weight per corpus field. A term in the title says far more about
 * what a task is than the same term buried in an Update, so ranking leans hard
 * on where a term landed. Each field contributes `weight × (matched terms /
 * total terms)`, so covering more of the query in a strong field beats a
 * scattered match. Kept here (not in the caller) so every consumer of
 * `searchTasks` — the CLI and the Board — orders results identically.
 *
 * `title` outweighs the sum of the rest: a task whose title carries the query
 * always ranks above one that merely mentions it in several weaker fields.
 */
const FIELD_WEIGHT: Record<TaskSearchField, number> = {
  title: 12,
  tags: 6,
  body: 3,
  updates: 2,
};

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Returns a bounded, whitespace-normalized excerpt of `normalizedText` centered
 * on the earliest matching term (longest term wins a tie), or `undefined` when
 * no term occurs. Used for both the body snippet and per-Update snippets.
 */
function snippetAround(
  normalizedText: string,
  normalizedTerms: readonly string[],
): string | undefined {
  const lowercase = normalizedText.toLowerCase();
  let matchIndex = -1;
  let matchLength = 0;
  for (const term of normalizedTerms) {
    const termIndex = lowercase.indexOf(term);
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
    normalizedText.length,
    matchIndex + matchLength + SNIPPET_CONTEXT_AFTER,
  );
  const excerpt = normalizedText.slice(start, end).trim();
  return `${start > 0 ? '…' : ''}${excerpt}${end < normalizedText.length ? '…' : ''}`;
}

/**
 * Splits the query on whitespace and finds tasks in which every
 * case-insensitive term occurs as a substring of the search corpus: the title,
 * a tag, the Markdown description, or a Task Updates entry (including a
 * quarantined unreadable section). Terms may occur in different parts of the
 * corpus.
 *
 * Results come back ranked by relevance: a weighted blend of which fields
 * matched (`FIELD_WEIGHT`) and how much of the query each field covered. Ties
 * break toward the more recently updated task, then fall back to input order, so
 * the ranking stays deterministic and a caller can `slice` for `--limit` after.
 */
export function searchTasks(
  tasks: readonly Task[],
  query: string,
): TaskSearchMatch[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const normalizedTerms = normalizedQuery.split(/\s+/);

  const scored: { match: TaskSearchMatch; score: number; updated: number }[] =
    [];
  for (const task of tasks) {
    const normalizedTitle = task.frontmatter.title.toLowerCase();
    const normalizedTags = (task.frontmatter.tags ?? []).map(tag =>
      tag.toLowerCase(),
    );
    const normalizedBody = normalizeText(task.body);
    const lowercaseBody = normalizedBody.toLowerCase();

    // Readable entries first, in order; then the quarantined section, if any.
    const rawUpdateSources: (
      | { kind: 'entry'; index: number; timestamp: string; text: string }
      | { kind: 'unreadable'; text: string }
    )[] = [
      ...task.comments.map((comment, index) => ({
        kind: 'entry' as const,
        index,
        timestamp: comment.timestamp,
        text: comment.text,
      })),
      ...(task.unreadableUpdates
        ? [{ kind: 'unreadable' as const, text: task.unreadableUpdates.text }]
        : []),
    ];
    const normalizedUpdateSources = rawUpdateSources.map(source => {
      const normalized = normalizeText(source.text);
      return { ...source, normalized, lowercase: normalized.toLowerCase() };
    });

    const everyTermMatches = normalizedTerms.every(
      term =>
        normalizedTitle.includes(term) ||
        normalizedTags.some(tag => tag.includes(term)) ||
        lowercaseBody.includes(term) ||
        normalizedUpdateSources.some(source => source.lowercase.includes(term)),
    );
    if (!everyTermMatches) continue;

    // Per-field term coverage: how many distinct query terms this field
    // contains. Feeds both `matched_fields` and the relevance score.
    const titleTerms = normalizedTerms.filter(term =>
      normalizedTitle.includes(term),
    ).length;
    const tagTerms = normalizedTerms.filter(term =>
      normalizedTags.some(tag => tag.includes(term)),
    ).length;
    const bodyTerms = normalizedTerms.filter(term =>
      lowercaseBody.includes(term),
    ).length;
    const updateTerms = normalizedTerms.filter(term =>
      normalizedUpdateSources.some(source => source.lowercase.includes(term)),
    ).length;

    const matchedFields: TaskSearchField[] = [];
    if (titleTerms > 0) matchedFields.push('title');
    if (tagTerms > 0) matchedFields.push('tags');

    const snippet = snippetAround(normalizedBody, normalizedTerms);
    if (snippet !== undefined) matchedFields.push('body');

    const updateMatches: TaskUpdateMatch[] = [];
    for (const source of normalizedUpdateSources) {
      if (!normalizedTerms.some(term => source.lowercase.includes(term))) {
        continue;
      }
      const entrySnippet =
        snippetAround(source.normalized, normalizedTerms) ?? source.normalized;
      if (source.kind === 'unreadable') {
        updateMatches.push({ unreadable: true, snippet: entrySnippet });
      } else {
        updateMatches.push({
          index: source.index,
          timestamp: source.timestamp,
          snippet: entrySnippet,
        });
      }
    }
    if (updateMatches.length > 0) matchedFields.push('updates');

    const termCount = normalizedTerms.length;
    const score =
      (FIELD_WEIGHT.title * titleTerms +
        FIELD_WEIGHT.tags * tagTerms +
        FIELD_WEIGHT.body * bodyTerms +
        FIELD_WEIGHT.updates * updateTerms) /
      termCount;

    scored.push({
      match: {
        slug: task.slug,
        title: task.frontmatter.title,
        status: task.frontmatter.status,
        matched_fields: matchedFields,
        ...(snippet !== undefined ? { snippet } : {}),
        ...(updateMatches.length > 0 ? { update_matches: updateMatches } : {}),
      },
      score,
      updated: Date.parse(task.frontmatter.updated) || 0,
    });
  }

  return scored
    .map((entry, index) => ({ ...entry, index }))
    .sort(
      (a, b) =>
        b.score - a.score || b.updated - a.updated || a.index - b.index,
    )
    .map(entry => entry.match);
}
