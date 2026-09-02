---
title: Give the board window a project-specific title and a favicon
status: done
priority: medium
tags:
  - board
  - ui
  - cli
created: '2026-09-01T22:52:14.000Z'
updated: '2026-09-01T23:33:49.034Z'
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

**The name comes from `config.name`.** This was written up as an open question
between a directory basename and a new config field; it is neither, because the
field already exists and the basename is already its default.

`ShipbenchConfig.name` is declared in [types.ts](../../packages/core/src/types.ts#L60),
is **required** — `loadConfig` rejects a config without a non-empty name — and
`shipbench init` already defaults it to the current directory name behind
`-n, --name`. So "directory basename" was never an alternative to the config
field; it is the value that field is seeded with at init, after which the
project can edit it. Zero-configuration correctness and an explicit override
are both already shipped.

The board already holds it: [BoardHeader.tsx](../../packages/board/src/ui/BoardHeader.tsx#L75)
reads `config?.name` and renders it in the breadcrumb. The work is to set
`document.title` from the config the board already loads.

**Do not add `projectName` to `CreateBoardOptions`.** An earlier draft of this
task proposed exactly that, and it would have been a mistake: a host-supplied
name is a second source of truth competing with `config.name`, and since the
breadcrumb renders the config value, the tab and the breadcrumb could show two
different names for the same board. It would also split identity across hosts —
the CLI would report the checkout directory while Harbor reported the GitHub
repository name, for one project, in the one place whose entire job is saying
which project this is. No new published API surface is needed, in board options
or on `BoardAPI`.

The remaining judgment call is small: `DEFAULT_CONFIG.name` is
`'Untitled Project'`, the deep-merge safety net for a config missing the field.
Prefer rendering it as-is over special-casing the string — comparing UI against a
default value is hidden coupling, and "Untitled Project" is both honest and still
more distinguishable than today's identical tabs.

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

Board-side only: wherever `document.title` gets set from the already-loaded
config, plus `standalone.html` and `index.html` for the icon and the static
fallback title. No core change, no CLI change, no board-server change, no new
endpoint. Not the terminal board.

## Definition of done

- Two boards open for two different projects are distinguishable by tab title
  and by icon, including when tabs are narrow enough to hide the title.
- A board whose config carries no name still gets a sensible title and a
  working icon.
- The title agrees with the breadcrumb — one name per board, from one source.
- The favicon resolves with no network access.
- `pnpm --filter @shipbench/board test` and `pnpm typecheck` pass.
- **A patch changeset**, against `@shipbench/board` alone. Visible behavior
  changes, but no published API surface is added.

## Task Updates

### 2026-09-01T23:13:28.892Z
Corrected the task before implementing: the open question it posed does not exist.

ShipbenchConfig.name is already declared, already required (loadConfig errors with 'Config must define a non-empty name'), and shipbench init already defaults it to the current directory name behind -n, --name. So the two options this task framed as alternatives are the same option — the directory basename is the config field's seed value at init, not a competing source. This repo's own config.json reads name: shipbench. BoardHeader.tsx already does config?.name and renders it in the breadcrumb, so the board holds the value today.

Consequence for the plan: no CreateBoardOptions.projectName, no BoardAPI change, no core change, no board-server change, no new endpoint. The work is setting document.title from config the board already loads. The changeset drops from minor to patch against @shipbench/board alone, since no published API surface is added.

Worth recording why the rejected plumbing was actively wrong rather than merely redundant: a host-supplied name is a second source of truth competing with config.name, and because the breadcrumb renders the config value, the tab and the breadcrumb could disagree about the same board. It would also split identity across hosts — the CLI reporting the checkout directory while Harbor reports the GitHub repository name — for one project, in the one place whose job is saying which project this is.

Description and definition of done rewritten to match. Implementation not started; awaiting go-ahead on the title format.

### 2026-09-01T23:25:44.339Z
Implemented. Title comes from config.name via a useDocumentTitle hook reading the same store value BoardHeader renders, so the tab and breadcrumb cannot disagree. Format is '<name> — ShipBench Board'; a config with no usable name falls back to the bare 'ShipBench Board', which is also the static title in the HTML so the tab reads the same before the first config load resolves.

One deviation from the approved plan, for correctness. I had said no new API surface, but setting document.title unconditionally from a library component would clobber the tab title of any embedded host — Harbor owns its own routing and title, and would never get it back. So the behavior is opt-in behind documentTitle on CreateBoardOptions and BoardProps, defaulting off, mirroring the existing themeControl precedent exactly ('standalone hosts pass true; the embed omits it'). This is not the projectName option the earlier draft proposed and this task rejected — it carries no name, only ownership of the window chrome, so config.name remains the single source. Consequence: the changeset is minor rather than patch, and the fixed group moves to 0.2.0. Effect cleanup restores the previous title on unmount, covered by a test.

Favicon added as a generated asset rather than a hand copy: packages/board/public/logo.svg joins STANDALONE_SVG_OUTPUTS in scripts/brand/assets.ts, so pnpm generate:icons emits it and the existing byte-identity test in brand-assets.test.ts fails if it ever drifts from docs/brand/logo-mark.svg. Bundled, not hot-linked. Both standalone.html and the demo index.html link it, and the demo passes documentTitle so dev exercises what ships. vite.lib.config.ts sets publicDir: false so the library build does not re-emit the standalone's asset.

Verified against a real browser on a production build, with all off-origin requests aborted to simulate no network: title 'shipbench — ShipBench Board', breadcrumb 'shipbench', /logo.svg 200 image/svg+xml, zero off-origin and zero failed requests. Incidentally confirmed the actual goal — port 4321 turned out to be another ShipBench board already running for a different project, and it read 'obelisk-conduit — ShipBench Board' while this repo's read 'shipbench — ShipBench Board'.

Noted, not fixed: browsers draw tab icons at 16px, below the 20px floor docs/brand/README.md documents for the mark. Rendered at 16/32/64 on both light and dark chrome, the baked canvas tile keeps it legible and unmistakably not a blank page icon. The site takes the same approach — it ships the SVG as its preferred favicon and deliberately has no 16px output — so this is consistent rather than a new exception.

5 new board tests (131 total), 665 root tests, typecheck, and lint pass.
