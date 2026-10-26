import type { BoardAPI } from '@shipbench/core';
import { createRoot, type Root } from 'react-dom/client';
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
    />,
  );

  return root;
}

export type { BoardAPI };
export { Board };
