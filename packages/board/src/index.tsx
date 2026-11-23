import type { BoardAPI } from '@shipbench/core';
import { createRoot, type Root } from 'react-dom/client';
import type { BoardNavigation } from './store/boardStore.js';
import { Board } from './ui/Board.js';
import './styles.css';

export interface CreateBoardOptions {
  api: BoardAPI;
  /** Show the standalone theme toggle (System/Light/Dark). Hosts that own their
   *  own theme, which the embed inherits, leave this off. */
  themeControl?: boolean;
  /** Name the browser tab after the project, so boards for several repos are
   *  distinguishable. Hosts that own their own routing and tab title leave
   *  this off. The name itself always comes from `config.name`. */
  documentTitle?: boolean;
  /** Connects the open task to the host's own URL and history. The board
   *  never touches either itself, so a host that leaves this off keeps them
   *  as they are. */
  navigation?: BoardNavigation;
}

export function createBoard(
  rootElement: HTMLElement,
  options: CreateBoardOptions,
): Root {
  const root = createRoot(rootElement);

  root.render(
    <Board
      api={options.api}
      themeControl={options.themeControl}
      documentTitle={options.documentTitle}
      navigation={options.navigation}
    />,
  );

  return root;
}

export type { BoardAPI, BoardNavigation };
export { Board };
