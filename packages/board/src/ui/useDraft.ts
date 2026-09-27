import { useState } from 'react';

export interface Draft {
  /** The text in the editor. */
  value: string;
  setValue: (next: string) => void;
  /** The user has changed the text from what the editor opened with. */
  dirty: boolean;
  /**
   * The source changed after the user started changing the text. Only a dirty
   * draft can be in this state: a clean one follows the source instead.
   */
  changedOnDisk: boolean;
  /**
   * Start over from `to`, discarding the user's text. Defaults to the current
   * source, which is how the user loads the version on disk.
   */
  reset: (to?: string) => void;
  /**
   * Keep the user's text and take the current source as the new starting
   * point, so the notice clears until the source changes again.
   */
  keepDraft: () => void;
}

/**
 * Editor state that survives a refresh. The board re-reads tasks whenever they
 * change on disk, so `source` can move while the user is typing. A clean draft
 * follows it silently; a dirty one keeps the user's text and reports
 * `changedOnDisk` instead of losing it.
 */
export function useDraft(source: string): Draft {
  const [state, setState] = useState({ base: source, value: source });
  let { base, value } = state;

  // Adjusting state during render, rather than in an effect, means no frame
  // ever paints the stale draft. The guard is false once applied, so this
  // cannot loop.
  if (source !== base && (value === base || value === source)) {
    base = source;
    value = source;
    setState({ base, value });
  }

  return {
    value,
    setValue: next => setState(current => ({ ...current, value: next })),
    dirty: value !== base,
    changedOnDisk: source !== base,
    reset: (to = source) => setState({ base: to, value: to }),
    keepDraft: () => setState(current => ({ ...current, base: source })),
  };
}
