import {
  createContext,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';

/** The board's `.sb-board-root` element, provided by `BoardShell`. */
export const BoardRootContext =
  createContext<RefObject<HTMLElement | null> | null>(null);

/**
 * Listens for `keydown` on `window` on behalf of one board.
 *
 * The listener stays on `window` because key events only reach a focused
 * element, and a freshly loaded board has focus on `<body>`. A host can mount
 * several boards and hide the inactive ones, though, so each handler first
 * checks that its own board is rendered. That check runs per event, not at
 * mount, because hosts toggle visibility without remounting.
 *
 * Events are also skipped when a text field has focus or when something else
 * already called `preventDefault`. A field decides what its own keys do, so
 * Escape there closes a suggestion list or keeps a draft instead of leaving
 * the task.
 */
export function useBoardKeydown(handler: (event: KeyboardEvent) => void) {
  const rootRef = useContext(BoardRootContext);
  const handlerRef = useRef(handler);

  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;

      const root = rootRef?.current;
      if (root && !isRendered(root)) return;

      handlerRef.current(event);
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rootRef]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]'),
  );
}

// "Hidden" means the root or an ancestor has the `hidden` attribute or a
// computed `display: none`, which is how tab-style hosts hide a board. A
// layout check such as `getClientRects().length === 0` would track rendering
// more closely, but jsdom has no layout: every board would look hidden and the
// keyboard tests would need a stub to pass. Both signals used here are visible
// to jsdom, so tests exercise the same code path browsers run.
function isRendered(root: HTMLElement): boolean {
  if (!root.isConnected) return false;

  for (
    let element: HTMLElement | null = root;
    element;
    element = element.parentElement
  ) {
    if (element.hidden || getComputedStyle(element).display === 'none') {
      return false;
    }
  }

  return true;
}
