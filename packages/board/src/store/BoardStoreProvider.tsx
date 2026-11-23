import type { BoardAPI } from '@shipbench/core';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { useStore } from 'zustand';
import {
  type BoardNavigation,
  type BoardState,
  type BoardStore,
  createBoardStore,
} from './boardStore.js';

const BoardStoreContext = createContext<BoardStore | null>(null);

export function BoardStoreProvider({
  api,
  navigation,
  children,
}: {
  api: BoardAPI;
  /** Snapshotted with the store, which is recreated only when `api` changes. */
  navigation?: BoardNavigation;
  children: ReactNode;
}) {
  const storeRef = useRef<BoardStore | null>(null);
  const apiRef = useRef<BoardAPI | null>(null);
  const navigationRef = useRef<BoardNavigation | undefined>(undefined);

  if (!storeRef.current || apiRef.current !== api) {
    storeRef.current = createBoardStore(api, navigation);
    apiRef.current = api;
    navigationRef.current = navigation;
  }

  const store = storeRef.current;

  useEffect(
    () =>
      navigationRef.current?.subscribe?.((slug, trail) =>
        store.getState().hostSelectTask(slug, trail),
      ),
    [store],
  );

  return (
    <BoardStoreContext.Provider value={store}>
      {children}
    </BoardStoreContext.Provider>
  );
}

export function useBoardStore<T>(selector: (state: BoardState) => T): T {
  const store = useContext(BoardStoreContext);

  if (!store) {
    throw new Error('useBoardStore must be used within BoardStoreProvider');
  }

  return useStore(store, selector);
}
