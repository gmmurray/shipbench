---
title: Let host apps size the board with CSS variables
status: todo
priority: medium
tags:
  - board
  - ui
created: '2026-09-23T21:25:59.783Z'
updated: '2026-09-23T21:25:59.783Z'
---

The board assumes it owns the whole browser window. It sizes itself against
`100vh` and pins its sticky parts to the top of the viewport. That's right for
the standalone board, but a host that puts the board under its own app bar, or
inside a panel, has to override board rules to make it fit. Those overrides
target Tailwind class output, which is not a contract and can change in any
release. Requested from the Radar side. Harbor embeds the board the same way
and would use this too.

## Where the assumption lives

Verified against source:

- **`100vh`**:
  - `min-h-screen` on the root in [Board.tsx](../../packages/board/src/ui/Board.tsx),
    in both the loaded and the load-error branches;
  - `min-h-[calc(100vh-var(--sb-header-h))]` in [BoardCanvas.tsx](../../packages/board/src/ui/BoardCanvas.tsx);
  - `min-h-[calc(100vh-var(--sb-header-h)-2.5rem)]` three times in
    [KanbanBoard.tsx](../../packages/board/src/ui/KanbanBoard.tsx);
  - `lg:max-h-[calc(100vh-var(--sb-header-h)-2.5rem)]` on the metadata aside in
    [DetailView.tsx](../../packages/board/src/ui/DetailView.tsx).
- **Sticky offsets**:
  - `sticky top-0` on the header in [BoardHeader.tsx](../../packages/board/src/ui/BoardHeader.tsx);
  - `lg:sticky lg:top-[calc(var(--sb-header-h)+1.25rem)]` on the same aside.

## Direction

Give hosts two CSS custom properties, and have the board read them with
fallbacks that reproduce today's behavior exactly:

- **`--sb-viewport-h`**: the height the board should treat as its viewport.
  Every `100vh` above becomes `var(--sb-viewport-h, 100vh)`.
- **An offset for sticky elements**, named in the same style (e.g.
  `--sb-sticky-top`): the distance from the top of the scroll container at
  which the board's sticky parts should stop. The header uses
  `top: var(--sb-sticky-top, 0px)`, and the aside adds it to its existing
  `--sb-header-h + 1.25rem` offset.

A host with a 56px fixed app bar and window scrolling would then set
`--sb-viewport-h: calc(100dvh - 56px)` and `--sb-sticky-top: 56px`. A host
that puts the board in its own scrolling panel would set `--sb-viewport-h` to
the panel height and leave the offset at 0.

**Watch out: don't declare defaults on `.sb-board-root`.** `styles.css`
declares `--sb-header-h: 65px` there, which is fine because the board sets
that variable itself. A default for a host variable declared in the same place
would sit closer to the board than the host's element. It would override
whatever the host sets on its mount element or any ancestor, and the feature
would silently do nothing. Use `var()` fallbacks at each point of use, or a
declaration hosts can reliably override.

Out of scope:
- The Radix dialogs and the sonner toaster use `position: fixed` against the
  real window. A modal covering the whole page and a corner toast are both
  reasonable inside a host.
- Changing the default from `100vh` to `100dvh` for the standalone board is a
  separate decision.

No change to `createBoard`'s options or return type: the variables are the
interface.

## Docs

The variables become a contract with host apps, so document them in
[docs/board/design.md](../../docs/board/design.md). It has no embedding
section today. Add a short one: both variables, where to set them (the element
passed to `createBoard` or any ancestor), their defaults, and the two example
layouts above. Board embedding isn't a supported public use case, so the site
docs stay as they are.

## Acceptance

- With neither variable set, the standalone board renders pixel-for-pixel as
  today. The layout-class assertions in
  [Board.test.tsx](../../packages/board/src/ui/Board.test.tsx) (around the
  `--sb-header-h` checks) are updated to the new class strings and still pin
  the fallback behavior.
- A test mounts the board inside an element that sets both variables. It
  asserts that the root, canvas, and column containers resolve their heights
  from `--sb-viewport-h`, and that the header and the aside offset by
  `--sb-sticky-top`.
- A variable set on the element passed to `createBoard` reaches the board.
  This guards against a default on `.sb-board-root` shadowing it.
- Add a changeset, since this changes `@shipbench/board`. Outside hosts get it
  only through a board release.
