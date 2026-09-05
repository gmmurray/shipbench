import { HARBOR_ENABLED } from '../config/flags';

/**
 * Calculate estimated reading time in minutes based on 200 words per minute.
 */
export function getReadingTime(content: string): string {
  if (!content) return '1 min read';
  // Strip code blocks and markdown tags for cleaner word count
  const cleanText = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
  const words = cleanText.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

/**
 * Format a Date or date string to MM-DD-YYYY format (e.g. 07-23-2026).
 */
export function formatDate(date?: Date | string): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return String(date);

  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const year = d.getUTCFullYear();

  return `${month}-${day}-${year}`;
}

/**
 * Doc pages that only exist when a feature is live. A gated page is dropped
 * before anything reads the collection, so it leaves the routes, the sidebar,
 * pagination, the sitemap, and Pagefind's index together rather than one at a
 * time — Pagefind indexes `dist/`, so not building the page is what keeps it
 * out of search.
 *
 * Keyed by the collection id, which for `glob()` over `src/content/docs` is the
 * filename without its extension — the same string the route's `slug` param
 * takes.
 */
const GATED_DOCS: Record<string, boolean> = {
  harbor: HARBOR_ENABLED,
};

/** Whether a doc id is part of the current build. */
export function isDocVisible(id: string): boolean {
  return GATED_DOCS[id] ?? true;
}

/**
 * Filter a docs collection down to the pages this build publishes. Every read
 * of the collection goes through here, so a gated page cannot come back in
 * through a call site that forgot about it.
 */
export function visibleDocs<T extends { id: string }>(docs: T[]): T[] {
  return docs.filter(doc => isDocVisible(doc.id));
}
