import { useBoardStore } from '../store/BoardStoreProvider.js';
import { ArchiveView } from './ArchiveView.js';
import { DetailView } from './DetailView.js';
import { KanbanBoard } from './KanbanBoard.js';
import { useBoardKeydown } from './useBoardKeydown.js';

export function BoardCanvas() {
  const selectedTaskSlug = useBoardStore(state => state.selectedTaskSlug);
  const archiveViewOpen = useBoardStore(state => state.archiveViewOpen);
  const selectTask = useBoardStore(state => state.selectTask);
  const closeArchive = useBoardStore(state => state.closeArchive);

  useBoardKeydown(event => {
    if (event.key !== 'Escape') return;
    if (archiveViewOpen) closeArchive();
    else selectTask(null);
  });

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
