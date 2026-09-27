import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef } from 'react';
import { useBoardStore } from '../store/BoardStoreProvider.js';
import type { UnsavedDraft } from '../store/boardStore.js';

const DRAFT_NAMES: Record<UnsavedDraft, string> = {
  description: 'the description',
  'new-update': 'a new task update',
  'edited-update': 'an edited task update',
};

/**
 * Asks before a navigation that would discard unsaved text, and arms the
 * browser's leave prompt while any text is unsaved.
 */
export function UnsavedChangesDialog() {
  const pendingNavigation = useBoardStore(state => state.pendingNavigation);
  const dirtyDrafts = useBoardStore(state => state.dirtyDrafts);
  const discardAndNavigate = useBoardStore(state => state.discardAndNavigate);
  const keepEditing = useBoardStore(state => state.keepEditing);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const hasUnsaved = Object.keys(dirtyDrafts).length > 0;

  // Registered only while something is unsaved, so an embedding page's own
  // unload behavior is untouched the rest of the time. Browsers show their
  // own text here and ignore ours.
  useEffect(() => {
    if (!hasUnsaved) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers need returnValue set to show the prompt.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsaved]);

  const present = new Set(Object.values(dirtyDrafts));
  const unsaved = (Object.keys(DRAFT_NAMES) as UnsavedDraft[])
    .filter(draft => present.has(draft))
    .map(draft => DRAFT_NAMES[draft]);

  return (
    <Dialog.Root
      open={pendingNavigation !== null}
      onOpenChange={open => {
        if (!open) keepEditing();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-sb-iron bg-sb-surface p-5 outline-none"
          onOpenAutoFocus={event => {
            event.preventDefault();
            keepEditingRef.current?.focus();
          }}
        >
          <Dialog.Title className="text-base font-semibold text-sb-frosted">
            Discard unsaved changes?
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-[13px] leading-relaxed text-sb-silver">
            You have unsaved changes to {joinNames(unsaved)}. Leaving this task
            discards them.
          </Dialog.Description>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                ref={keepEditingRef}
                className="h-9 rounded border border-sb-iron bg-transparent px-3 text-[13px] font-medium text-sb-frosted transition-colors hover:border-sb-ironlit hover:bg-sb-surface2"
                type="button"
              >
                Keep editing
              </button>
            </Dialog.Close>
            <button
              className="h-9 rounded bg-sb-danger px-4 text-[13px] font-semibold text-sb-canvas transition-colors hover:bg-sb-danger/90"
              type="button"
              onClick={discardAndNavigate}
            >
              Discard
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'this task';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
