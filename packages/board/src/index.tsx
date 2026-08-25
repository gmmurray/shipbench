import type { BoardAPI } from '@shipbench/core';
import { createRoot, type Root } from 'react-dom/client';
import { Board } from './ui/Board.js';
import './styles.css';

export interface CreateBoardOptions {
  api: BoardAPI;
  /** Show the standalone theme toggle (System/Light/Dark). Hosts that own their
   *  own theme (e.g. Harbor, which the embed inherits from) leave this off. */
  themeControl?: boolean;
}

export function createBoard(
  rootElement: HTMLElement,
  options: CreateBoardOptions,
): Root {
  const root = createRoot(rootElement);

  root.render(<Board api={options.api} themeControl={options.themeControl} />);

  return root;
}

export type { BoardAPI };
export { Board };
