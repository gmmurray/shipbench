import type { BoardAPI } from '@shipbench/core';
import { useEffect } from 'react';
import { useBoardStore } from '../store/BoardStoreProvider.js';

const POLL_INTERVAL_MS = 60_000;

export function SyncEffects({ api }: { api: BoardAPI }) {
  const refresh = useBoardStore(state => state.refresh);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };

    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (api.onTasksChanged) {
      return api.onTasksChanged(() => void refresh());
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [api, refresh]);

  return null;
}
