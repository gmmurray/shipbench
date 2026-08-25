/**
 * One delegated handler for both mobile drawers.
 *
 * This replaces two near-identical inline scripts — one in Header.astro for the
 * nav drawer, one in docs/[...slug].astro for the docs-nav drawer — each of
 * which had to guard itself with a `window.__site*Bound` flag because an inline
 * script re-executes on every ClientRouter swap. A bundled module does not: it
 * is evaluated once per full page load, and a listener on `document` survives
 * swaps because `document` is never replaced. Same pattern as search-triggers.ts.
 *
 * Consolidating also fixes the reason the drawers needed touching at all: a
 * drawer that stays open after an in-page jump covers the section it just
 * jumped to, which is an orientation problem rather than a cosmetic one.
 */

interface DrawerPair {
  /** The panel that slides open. */
  drawer: string;
  /** The button that opens it. */
  toggle: string;
}

const DRAWERS: readonly DrawerPair[] = [
  { drawer: 'mobile-nav-drawer', toggle: 'mobile-menu-toggle' },
  { drawer: 'mobile-docs-drawer', toggle: 'mobile-docs-toggle' },
];

function setOpen(pair: DrawerPair, open: boolean): void {
  const drawer = document.getElementById(pair.drawer);
  const toggle = document.getElementById(pair.toggle);
  if (!drawer) return;

  drawer.classList.toggle('open', open);
  toggle?.classList.toggle('active', open);
  // The button owns the state announcement; the drawer is plain markup.
  toggle?.setAttribute('aria-expanded', String(open));
}

/**
 * Close any open drawer. Exported because search does the same thing for its
 * own reason — dismissing the search dialog should not reveal a menu the user
 * never opened — and two copies of this logic is how they drift apart.
 */
export function closeDrawers(): void {
  for (const pair of DRAWERS) setOpen(pair, false);
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;

  for (const pair of DRAWERS) {
    const drawer = document.getElementById(pair.drawer);

    if (event.target.closest(`#${pair.toggle}`)) {
      setOpen(pair, !drawer?.classList.contains('open'));
      return;
    }

    // Any link inside an open drawer closes it. Covers both the in-page hash
    // case (`#start`, where no navigation happens and the drawer would
    // otherwise sit over the destination) and cross-page links, where closing
    // early avoids a frame of stale menu during a ClientRouter swap.
    if (drawer && event.target.closest(`#${pair.drawer} a`)) {
      setOpen(pair, false);
      return;
    }
  }
});

// A drawer is a mobile affordance. Growing past the breakpoint while one is
// open leaves it stuck open over the desktop layout, since only the toggle
// ever closes it.
const belowBreakpoint = window.matchMedia('(max-width: 760px)');
belowBreakpoint.addEventListener('change', event => {
  if (!event.matches) closeDrawers();
});
