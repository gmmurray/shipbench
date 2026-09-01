import type { BoardAPI } from '@shipbench/core';
import { useEffect, useMemo } from 'react';
import {
  BoardStoreProvider,
  useBoardStore,
} from '../store/BoardStoreProvider.js';
import { BoardCanvas } from './BoardCanvas.js';
import { BoardHeader } from './BoardHeader.js';
import { BoardToaster } from './BoardToaster.js';
import { ChevronDefs } from './Chevron.js';
import { SyncEffects } from './SyncEffects.js';
import { useDocumentTitle } from './useDocumentTitle.js';

export interface BoardProps {
  api: BoardAPI;
  /** Standalone hosts pass true to show the theme toggle; the embed omits it
   *  and inherits the host's theme. */
  themeControl?: boolean;
  /** Standalone hosts pass true to name the browser tab after the project; the
   *  embed omits it and leaves the tab title to the host's own routing. */
  documentTitle?: boolean;
}

export function Board({ api, themeControl, documentTitle }: BoardProps) {
  return (
    <BoardStoreProvider api={api}>
      <BoardShell
        api={api}
        themeControl={themeControl}
        documentTitle={documentTitle}
      />
    </BoardStoreProvider>
  );
}

function BoardShell({ api, themeControl, documentTitle }: BoardProps) {
  const refresh = useBoardStore(state => state.refresh);
  const hasLoaded = useBoardStore(state => state.hasLoaded);
  const initialLoadError = useBoardStore(state => state.initialLoadError);
  const isSyncing = useBoardStore(state => state.isSyncing);

  useDocumentTitle(documentTitle);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const retryLabel = useMemo(
    () => (isSyncing ? 'Retrying...' : 'Retry'),
    [isSyncing],
  );

  if (!hasLoaded && initialLoadError) {
    return (
      <div className="sb-canvas-grid min-h-screen p-6 font-sans text-sb-frosted">
        <ChevronDefs />
        <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sb-silver">
            ShipBench could not load
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-sb-frosted">
            Board unavailable
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-sb-silver">
            {initialLoadError}
          </p>
          <button
            className="mt-6 w-fit rounded border border-sb-iron bg-transparent px-4 py-2 text-[13px] font-medium text-sb-frosted transition-colors hover:border-sb-silver hover:bg-sb-surface2"
            type="button"
            onClick={() => void refresh()}
          >
            {retryLabel}
          </button>
        </div>
        <BoardToaster />
      </div>
    );
  }

  return (
    <div className="sb-board-root sb-canvas-grid min-h-screen font-sans text-sb-frosted">
      <ChevronDefs />
      <SyncEffects api={api} />
      <BoardHeader themeControl={themeControl} />
      <BoardCanvas />
      <BoardToaster />
    </div>
  );
}
