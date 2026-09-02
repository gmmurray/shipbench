# @shipbench/core

## 0.3.0

### Minor Changes

- 4cddbc5: Let a task's description be written and revised without hand-editing the file. `createTask` now takes an optional body, and the CLI exposes it as `shipbench task create --body <text>` / `--body-file <path>` (`-` reads stdin) alongside a new `shipbench task edit <slug>` that replaces a description whole — an empty value clears it. Both paths preserve `created`, bump `updated`, and leave `## Task Updates` alone, which removes the read-modify-write against the file the CLI just wrote.
  
  `--body-file` is the path to prefer for anything multi-line: ShipBench opens the file itself and reads it as UTF-8, so the description never passes through shell quoting or a shell's encoding — on Windows, both a quoted argument and a pipe go through PowerShell's Windows-1252 decode and corrupt every non-ASCII character.
  
  `createTask` and `updateTask` now reject a body containing an unfenced `## Task Updates` heading, naming `task comment` instead. Serialization writes the body verbatim, so such a heading previously turned part of a description into comments on the next read — reachable today through the Board's description editor, not only through the new flags.

## 0.2.0

### Patch Changes

- e8f7c03: Keep scaffolded project documentation on public CLI commands and file-format rules instead of exposing an internal layout helper.

## 0.1.1

### Patch Changes

- 09068e0: No functional changes. The package contents are identical to 0.1.0.
  
  This release exists to exercise the release pipeline after it moved from a
  long-lived npm token to GitHub OIDC trusted publishing, and to attach the
  provenance attestations that 0.1.0 shipped without. Attestations are applied at
  publish time and published versions are immutable, so verifying the fix required
  publishing a version rather than amending one.

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
