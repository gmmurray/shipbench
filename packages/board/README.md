# @shipbench/board

The React kanban surface for ShipBench. ShipBench Harbor embeds the component;
the ShipBench CLI serves the standalone bundle from `dist/standalone.html`.

## Embedded library

Install `@shipbench/board`, `@shipbench/core`, `react`, and `react-dom`, then
load the compiled stylesheet once in the host application:

```tsx
import { Board, type BoardAPI } from '@shipbench/board';
import '@shipbench/board/styles.css';

const api: BoardAPI = getBoardApi();

export function ProjectBoard() {
  return <Board api={api} />;
}
```

The stylesheet is an explicit export instead of JavaScript-injected CSS. That
keeps server-side imports free of DOM mutations and gives the host control over
stylesheet ordering. It contains the complete Tailwind output for Board's own
markup; consumers do not need to scan this package with Tailwind. The source
stylesheet remains at `src/styles.css` for design-token parity checks.

React and React DOM are peer dependencies and are external to the compiled
library, so the Board shares the host's React instance. The standalone build
still bundles its runtime and fonts so `shipbench board` remains self-contained.

## Build outputs

`pnpm build` cleans `dist/` once and then writes both outputs without either
Vite config emptying the shared directory:

- `dist/index.js`, declarations, and `dist/styles.css` for package consumers
- `dist/standalone.html` and hashed assets for the ShipBench CLI
