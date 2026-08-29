/**
 * Page-level glue for docs search. Deliberately not part of the Svelte island.
 *
 * These listeners are document-scoped and have to be registered independently
 * of the dialog's own lifecycle: the triggers live in the header (rendered by
 * Astro), the shortcut is global, and the hint has to repaint after a
 * ClientRouter swap. The island owns the dialog; this owns "something asked for
 * the dialog".
 *
 * Communication is one-way, via a document event, so the component has no
 * knowledge of triggers and the triggers have no knowledge of the component.
 */

import { closeDrawers } from './nav.js';
import { SEARCH_OPEN_EVENT } from './search-events.js';

function isMac(): boolean {
  // `userAgentData` first, `platform` as the fallback. `platform` is deprecated
  // but `userAgentData` is Chromium-only — Safari and Firefox have neither
  // shipped it nor committed to, and Safari is exactly where "is this a Mac"
  // matters most. Dropping the fallback would mean showing Ctrl to Mac Safari
  // users, so it stays until the modern API is actually universal.
  //
  // Both go through casts: `userAgentData` because lib.dom does not declare it,
  // `platform` because lib.dom marks it deprecated and `astro check` reports
  // that as a hint on every run.
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  } & { platform?: string };
  const platform = nav.userAgentData?.platform || nav.platform || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

function requestOpen(): void {
  document.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT));
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('[data-search-open]')) return;
  event.preventDefault();
  // Dismissing search should not reveal a menu the user never opened.
  closeDrawers();
  requestOpen();
});

document.addEventListener('keydown', event => {
  if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey))
    return;
  // The dialog handles its own Esc/close; this only ever asks it to open, and
  // is a no-op on pages that render no dialog (the landing page).
  if (!document.getElementById('search-modal')) return;
  event.preventDefault();
  requestOpen();
});

/**
 * The pages are statically built, so baking in either glyph would be wrong for
 * half the visitors. The hint ships hidden so that without JS no shortcut is
 * advertised for a control that needs it.
 */
function paintShortcutHints(): void {
  const label = isMac() ? '⌘K' : 'Ctrl K';
  for (const node of document.querySelectorAll<HTMLElement>(
    '[data-search-kbd]',
  )) {
    node.textContent = label;
    node.hidden = false;
  }
}

paintShortcutHints();
// This module is evaluated once; ClientRouter swaps in fresh markup.
document.addEventListener('astro:page-load', paintShortcutHints);
