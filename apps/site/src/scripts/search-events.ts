/**
 * The contract between the search triggers and the search dialog.
 *
 * Its own module on purpose: `search-triggers.ts` registers document listeners
 * at import time, so importing it for a constant would execute those listeners
 * during SSR, where `document` does not exist.
 */
export const SEARCH_OPEN_EVENT = 'sb:search-open';
