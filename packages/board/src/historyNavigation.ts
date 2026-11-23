import type { BoardNavigation } from './store/boardStore.js';

/** The query parameter that names the open task: `?task=<slug>`. */
const TASK_PARAM = 'task';

/** What the board records in each history entry it writes. */
interface BoardHistoryState {
  shipbenchTask: string | null;
  trail: string[];
}

function isBoardHistoryState(value: unknown): value is BoardHistoryState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<BoardHistoryState>;
  return (
    (state.shipbenchTask === null || typeof state.shipbenchTask === 'string') &&
    Array.isArray(state.trail) &&
    state.trail.every(slug => typeof slug === 'string')
  );
}

function taskInUrl(): string | null {
  return new URLSearchParams(window.location.search).get(TASK_PARAM) || null;
}

/** The trail stored with the current entry, when it is one the board wrote for this task. */
function trailInState(
  state: unknown,
  slug: string | null,
): string[] | undefined {
  return isBoardHistoryState(state) && state.shipbenchTask === slug
    ? state.trail
    : undefined;
}

/**
 * Keeps the open task in the page's URL and history. Only the page the CLI
 * serves uses this, because there the board is the whole page; the library
 * entry never touches history.
 */
export function historyNavigation(): BoardNavigation {
  const initialTaskSlug = taskInUrl();

  return {
    initialTaskSlug,
    // History state survives a reload, so the trail does too.
    initialTrail: trailInState(window.history.state, initialTaskSlug),
    onSelectedTaskChange(slug, { push, trail }) {
      const url = new URL(window.location.href);
      if (slug) url.searchParams.set(TASK_PARAM, slug);
      else url.searchParams.delete(TASK_PARAM);
      url.hash = '';
      const state: BoardHistoryState = {
        shipbenchTask: slug,
        trail: [...trail],
      };
      if (push) window.history.pushState(state, '', url);
      else window.history.replaceState(state, '', url);
    },
    back: steps => window.history.go(-steps),
    subscribe(select) {
      const onPopState = (event: PopStateEvent) => {
        const slug = taskInUrl();
        select(slug, trailInState(event.state, slug));
      };
      window.addEventListener('popstate', onPopState);
      return () => window.removeEventListener('popstate', onPopState);
    },
  };
}
