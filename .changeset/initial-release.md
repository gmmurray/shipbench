---
'@shipbench/core': minor
'@shipbench/board': minor
'shipbench': minor
---

First public release.

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
