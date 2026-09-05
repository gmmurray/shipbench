# @shipbench/board

## 0.5.0

### Minor Changes

- e2d15c9: Show an unreadable Updates section in the task detail view instead of an empty one. A task whose `## Task Updates` section will not parse used to render as "Task Updates 0" with nothing to explain it, because the Board displayed only `depends_on` warnings — so the corruption was invisible in the Board and in Harbor, which inherits the same rendering and is read-only.
  
  The section now reports itself: the count reads `unreadable`, the reason the parse failed is announced as an alert, and the preserved text is shown verbatim in a `pre` rather than rendered as Markdown, since rendering it would hide the very markup that broke it. The add-update form is hidden while the section is in this state, matching core, which refuses those mutations until it parses.
  
  The read-only shortcut that hid an empty Updates section no longer applies when the section is unreadable. Harbor is read-only everywhere, which makes it the host that most needs this to stay visible.

### Patch Changes

- Updated dependencies [2617c6b]
  - @shipbench/core@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [6a93ad4]
  - @shipbench/core@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [4cddbc5]
  - @shipbench/core@0.3.0

## 0.2.0

### Minor Changes

- bac700d: Name the browser tab after the project and ship a favicon, so boards open for several repos are distinguishable. The name is `config.name` — the same value the header breadcrumb renders — and the new `documentTitle` option keeps the behavior opt-in, so embedded hosts that own their own routing and tab title are unaffected.

### Patch Changes

- 7d32f8a: Separate task updates in the detail view so each entry is visually distinct. Entries are divided by a hairline rule instead of sharing one continuous left border, and the timestamp now reads as a header rather than as more body prose.
- Updated dependencies [e8f7c03]
  - @shipbench/core@0.2.0

## 0.1.1

### Patch Changes

- 09068e0: No functional changes. The package contents are identical to 0.1.0.
  
  This release exists to exercise the release pipeline after it moved from a
  long-lived npm token to GitHub OIDC trusted publishing, and to attach the
  provenance attestations that 0.1.0 shipped without. Attestations are applied at
  publish time and published versions are immutable, so verifying the fix required
  publishing a version rather than amending one.
- Updated dependencies [09068e0]
  - @shipbench/core@0.1.1

## 0.1.0

### Minor Changes

- 4920743: First public release.
  
  ShipBench is Git-native project management for solo developers: the task board
  lives in the repository as Markdown files with YAML frontmatter, so Git carries
  the history and every client is optional.
  
  - **`shipbench`** — the CLI. `shipbench init` scaffolds a `.shipbench/`
    directory into any Git repository; `shipbench board` serves a local Kanban
    board with live file watching.
  - **`@shipbench/core`** — the headless library the CLI is built on. No
    filesystem, UI, or network of its own; all I/O goes through a
    `StorageAdapter`, with local-filesystem and GitHub Contents API
    implementations included.
  - **`@shipbench/board`** — the React board. Published so the CLI and
    out-of-repository hosts can resolve it; not a supported standalone library.

### Patch Changes

- Updated dependencies [4920743]
  - @shipbench/core@0.1.0
