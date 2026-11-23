import type { KeyboardEvent } from 'react';

/**
 * A form `onKeyDown` handler: Ctrl+Enter (Cmd+Enter on macOS) submits the form
 * through `requestSubmit()`, so the form's own `onSubmit` guards still decide
 * whether anything is saved. Plain Enter is left alone.
 */
export function submitOnModEnter(event: KeyboardEvent<HTMLFormElement>): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }
}
