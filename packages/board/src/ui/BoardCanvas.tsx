import { useEffect } from 'react';
import { useBoardStore } from '../store/BoardStoreProvider.js';
import { ArchiveView } from './ArchiveView.js';
import { DetailView } from './DetailView.js';
import { KanbanBoard } from './KanbanBoard.js';

export function BoardCanvas() {
  const selectedTaskSlug = useBoardStore(state => state.selectedTaskSlug);
  const archiveViewOpen = useBoardStore(state => state.archiveViewOpen);
  const selectTask = useBoardStore(state => state.selectTask);
  const closeArchive = useBoardStore(state => state.closeArchive);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (archiveViewOpen) closeArchive();
        else selectTask(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [archiveViewOpen, closeArchive, selectTask]);

  return (
    <main className="min-h-[calc(100vh-var(--sb-header-h))] px-5 py-5">
      {archiveViewOpen ? (
        <ArchiveView />
      ) : selectedTaskSlug ? (
        <DetailView slug={selectedTaskSlug} />
      ) : (
        <KanbanBoard />
      )}
    </main>
  );
}
