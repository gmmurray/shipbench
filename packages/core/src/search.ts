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

/**
 * Opt-in precision controls for {@link searchTasks}. Both default off, so the
 * baseline stays "every whitespace-delimited term as a case-insensitive
 * substring". The CLI and the Board pass the same options through, so a query
 * behaves identically wherever it is run.
 */
export interface TaskSearchOptions {
  /**
   * Match each term on word boundaries instead of as a substring, so `ci` stops
   * matching `decision`. Applies to quoted phrases too — the boundary sits at
   * each end of the phrase, not between its words.
   */
  wholeWord?: boolean;
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

/**
 * One parsed query term. `text` is the lowercased, whitespace-collapsed source
 * (used only for stable tie-breaking); `pattern` is the matcher. The pattern is
 * non-global, so `test` and `exec` both start from index 0 and it is safe to
 * reuse across every task and field without resetting `lastIndex`.
 */
interface SearchTerm {
  text: string;
  pattern: RegExp;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTermPattern(text: string, wholeWord: boolean): RegExp {
  // Internal whitespace is already collapsed to single spaces; let it match any
  // whitespace run in the haystack so a phrase spanning a line break still hits.
  const core = escapeRegExp(text).replace(/ /g, '\\s+');
  const lead = wholeWord && /^\w/.test(text) ? '(?<!\\w)' : '';
  const trail = wholeWord && /\w$/.test(text) ? '(?!\\w)' : '';
  return new RegExp(`${lead}${core}${trail}`);
}

/**
 * Splits a raw query into terms. Whitespace separates terms, except inside a
 * double-quoted run, which becomes a single phrase term matched contiguously.
 * Everything is lowercased; empty quotes and a dangling quote are dropped. The
 * grammar lives here so the CLI and the Board parse a query the same way.
 */
function parseQueryTerms(query: string, wholeWord: boolean): SearchTerm[] {
  const terms: SearchTerm[] = [];
  for (const token of query.matchAll(/"([^"]*)"|([^\s"]+)/g)) {
    const raw = (token[1] ?? token[2] ?? '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
    if (!raw) continue;
    terms.push({ text: raw, pattern: buildTermPattern(raw, wholeWord) });
  }
  return terms;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Returns a bounded, whitespace-normalized excerpt of `normalizedText` centered
 * on the earliest matching term (longest match wins a tie), or `undefined` when
 * no term occurs. Used for both the body snippet and per-Update snippets.
 */
function snippetAround(
  normalizedText: string,
  terms: readonly SearchTerm[],
): string | undefined {
  const lowercase = normalizedText.toLowerCase();
  let matchIndex = -1;
  let matchLength = 0;
  for (const term of terms) {
    const found = term.pattern.exec(lowercase);
    if (
      found !== null &&
      (matchIndex === -1 ||
        found.index < matchIndex ||
        (found.index === matchIndex && found[0].length > matchLength))
    ) {
      matchIndex = found.index;
      matchLength = found[0].length;
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
 * Finds tasks in which every query term occurs somewhere in the search corpus:
 * the title, a tag, the Markdown description, or a Task Updates entry (including
 * a quarantined unreadable section). Terms may occur in different parts of the
 * corpus.
 *
 * A term is a whitespace-delimited run matched as a case-insensitive substring.
 * Two opt-in controls tighten that (see {@link TaskSearchOptions}): a
 * double-quoted run in `query` is one contiguous phrase term, and
 * `options.wholeWord` matches every term on word boundaries.
 *
 * Results come back ranked by relevance: a weighted blend of which fields
 * matched (`FIELD_WEIGHT`) and how much of the query each field covered. Ties
 * break toward the more recently updated task, then fall back to input order, so
 * the ranking stays deterministic and a caller can `slice` for `--limit` after.
 */
export function searchTasks(
  tasks: readonly Task[],
  query: string,
  options: TaskSearchOptions = {},
): TaskSearchMatch[] {
  const terms = parseQueryTerms(query, options.wholeWord ?? false);
  if (terms.length === 0) return [];

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

    const matchesTerm = (term: SearchTerm): boolean =>
      term.pattern.test(normalizedTitle) ||
      normalizedTags.some(tag => term.pattern.test(tag)) ||
      term.pattern.test(lowercaseBody) ||
      normalizedUpdateSources.some(source =>
        term.pattern.test(source.lowercase),
      );

    if (!terms.every(matchesTerm)) continue;

    // Per-field term coverage: how many distinct query terms this field
    // contains. Feeds both `matched_fields` and the relevance score.
    const titleTerms = terms.filter(term =>
      term.pattern.test(normalizedTitle),
    ).length;
    const tagTerms = terms.filter(term =>
      normalizedTags.some(tag => term.pattern.test(tag)),
    ).length;
    const bodyTerms = terms.filter(term =>
      term.pattern.test(lowercaseBody),
    ).length;
    const updateTerms = terms.filter(term =>
      normalizedUpdateSources.some(source => term.pattern.test(source.lowercase)),
    ).length;

    const matchedFields: TaskSearchField[] = [];
    if (titleTerms > 0) matchedFields.push('title');
    if (tagTerms > 0) matchedFields.push('tags');

    const snippet = snippetAround(normalizedBody, terms);
    if (snippet !== undefined) matchedFields.push('body');

    const updateMatches: TaskUpdateMatch[] = [];
    for (const source of normalizedUpdateSources) {
      if (!terms.some(term => term.pattern.test(source.lowercase))) {
        continue;
      }
      const entrySnippet =
        snippetAround(source.normalized, terms) ?? source.normalized;
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

    const termCount = terms.length;
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
