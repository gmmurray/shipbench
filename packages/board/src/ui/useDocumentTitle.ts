import { useEffect } from 'react';
import { useBoardStore } from '../store/BoardStoreProvider.js';

/** Matches the static title in the standalone HTML, so the tab reads the same
 *  before the first config load resolves and after a config without a name. */
const FALLBACK_TITLE = 'ShipBench Board';

/**
 * Names the browser tab after the project, so a developer running boards for
 * several repos can tell them apart.
 *
 * The name is `config.name` — the same value the header breadcrumb renders, so
 * the tab and the breadcrumb cannot disagree. It is deliberately not a host-
 * supplied option: a second source would let the CLI report the checkout
 * directory while Harbor reported the repository name, for one project.
 *
 * `DEFAULT_CONFIG.name` ("Untitled Project") is rendered as-is rather than
 * special-cased back to the fallback — comparing against a default value is
 * coupling, and the placeholder is honest.
 */
export function useDocumentTitle(enabled: boolean | undefined) {
  const projectName = useBoardStore(state => state.config?.name);

  useEffect(() => {
    if (!enabled) return;

    const previousTitle = document.title;
    const trimmed = projectName?.trim();
    document.title = trimmed
      ? `${trimmed} — ${FALLBACK_TITLE}`
      : FALLBACK_TITLE;

    return () => {
      document.title = previousTitle;
    };
  }, [enabled, projectName]);
}
