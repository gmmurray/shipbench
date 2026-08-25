import type { BoardAPI } from '@shipbench/core';
import { createContext, type ReactNode, useContext, useRef } from 'react';
import { useStore } from 'zustand';
import {
  type BoardState,
  type BoardStore,
  createBoardStore,
} from './boardStore.js';

const BoardStoreContext = createContext<BoardStore | null>(null);

export function BoardStoreProvider({
  api,
  children,
}: {
  api: BoardAPI;
  children: ReactNode;
}) {
  const storeRef = useRef<BoardStore | null>(null);
  const apiRef = useRef<BoardAPI | null>(null);

  if (!storeRef.current || apiRef.current !== api) {
    storeRef.current = createBoardStore(api);
    apiRef.current = api;
  }

  return (
    <BoardStoreContext.Provider value={storeRef.current}>
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
