import { useEffect, useId } from 'react';
import { useBoardStore } from '../store/BoardStoreProvider.js';
import type { UnsavedDraft } from '../store/boardStore.js';

/**
 * Reports an editor's unsaved text to the store while `dirty` is true, so
 * leaving the task asks first. The report clears when `dirty` goes false and
 * when the editor unmounts.
 */
export function useUnsavedDraft(draft: UnsavedDraft, dirty: boolean) {
  const id = useId();
  const setDraftDirty = useBoardStore(state => state.setDraftDirty);

  useEffect(() => {
    setDraftDirty(id, dirty ? draft : null);
  }, [id, draft, dirty, setDraftDirty]);

  useEffect(() => () => setDraftDirty(id, null), [id, setDraftDirty]);
}
