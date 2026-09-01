---
title: Give the board window a project-specific title and a favicon
status: todo
priority: medium
tags:
  - board
  - ui
  - cli
created: '2026-09-01T22:52:14.000Z'
updated: '2026-09-01T22:52:14.000Z'
---

Every board tab is identical in the browser. The title is a hardcoded
`ShipBench Board` in [standalone.html](../../packages/board/standalone.html#L6),
and there is no favicon at all — so a developer running boards for three
projects gets three tabs with the same text and the same blank document icon.
Once tabs narrow, the title is gone and only the icon is left to tell them
apart, and there isn't one.

Both halves of this are about the same thing: a board tab should say which
project it belongs to.

## The title

Keep ShipBench in it — the tab should still identify the tool — with the
project first, since that is the part that differs between tabs and the part
that survives truncation. Something shaped like `<project> — ShipBench Board`.

The board is served as a static file, byte-for-byte: `boardServer.ts` maps `/`
to `standalone.html` with no templating. So this is a client-side
`document.title`, not a server-rendered one. That is the right answer anyway —
Harbor gets the same behavior without the CLI's server being involved.

**The open question is where the name comes from**, and it should be decided
before any code moves:

1. **Directory basename**, handed to the board by the CLI. Zero configuration,
   correct almost always, and wrong in the ordinary case where the checkout
   directory isn't the project's name.
2. **A `name` field in `config.json`.** Explicit and always right, but it is a
   change to the convention itself — spec, `.shipbench/AGENTS.md`, and the
   `init` scaffold all move with it, and it makes every existing board
   nameless until edited.

Worth considering: (1) now with (2) layered later as an override, so the
default needs no configuration and the escape hatch exists when the basename
is wrong. Decide it explicitly rather than defaulting into it.

Plumbing note: `CreateBoardOptions` in
[index.tsx](../../packages/board/src/index.tsx#L6) already carries
board-owned options (`themeControl`), and a `projectName?: string` belongs
there. It does **not** belong on `BoardAPI` — that interface is core's
published contract, and this is presentation the host supplies, not data the
host serves. Keeping it in board options means core is untouched. The CLI's
`standalone.tsx` then needs the value from the server; adding it to the
existing `/api/config` response is likely cheaper than a new endpoint, but
check whether that muddies a response that currently mirrors `config.json`.

The board must stay correct when no name is supplied — Harbor may not pass one
— and fall back to the current `ShipBench Board`.

## The favicon

`apps/site/public/logo.svg` is the mark to use, but **bundle it rather than
hot-linking `https://shipbench.dev/logo.svg`.** The CLI board is a local tool
that should work on a plane; a remote favicon makes the tab icon depend on
shipbench.dev being reachable and leaks a request to the site every time a
developer opens their own board. The file is 1,974 bytes — small enough to
inline as a data URI in `standalone.html` or emit as a build asset, with no
meaningful cost either way.

See [docs/brand/README.md](../../docs/brand/README.md) before copying a logo
asset; the mark has a source of truth and derived files are supposed to come
from it.

Two smaller things to settle: whether the demo/dev `index.html` gets the same
treatment (it should, or dev stops matching what ships), and whether the icon
needs a dark-background variant to stay legible against a dark browser chrome.

## Scope

`standalone.html`, `index.html`, `standalone.tsx`, `CreateBoardOptions`, and
whatever the CLI's board server has to expose to supply the name. Not the
terminal board. Not a `config.json` schema change unless option (2) is the
decision — and if it is, the convention surfaces move with it in the same
change, not after.

## Definition of done

- Two boards open for two different projects are distinguishable by tab title
  and by icon, including when tabs are narrow enough to hide the title.
- A host that supplies no project name still gets a sensible title and a
  working icon.
- The favicon resolves with no network access.
- The name's source is decided and written down, not left implicit in the
  implementation.
- `pnpm --filter @shipbench/board test`, `pnpm --filter shipbench test`, and
  `pnpm typecheck` pass.
- **A changeset.** Both published packages are affected and this is visible
  behavior. Minor rather than patch if `CreateBoardOptions` gains a member —
  that is a new published API surface, even though it is additive and optional.
