# @shipbench/core

## 0.5.0

### Minor Changes

- 2617c6b: Stop an unreadable Updates section from eating the description it sits under. When the trailing `## Task Updates` section did not parse, core returned the entire raw body as `Task.body` — the field documented as "Timeless task description, excluding the reserved trailing Task Updates section" — and every consumer that trusted that comment inherited the damage.
  
  The sharpest consequence was silent data loss: `task edit --body` on such a task succeeded, reported success, and deleted the whole section, good entries included, because the raw text lived in `body` and the write serialized an empty `comments` over it. The description guard could not catch it, since the incoming body was clean. Git was the only trail.
  
  Core now keeps the split it already computed. `Task.body` is the description above the marker; the section is quarantined verbatim on a new optional `Task.unreadableUpdates` (`{ text, reason }`) and written back byte-identical on every write. A frontmatter or description edit can no longer drop it, the Board's description editor holds a real description again, and `task search` stops matching broken entry text as if it were the description. Comment mutations still refuse a task in this state — appending to a section that cannot be read would leave it just as unreadable.
  
  The warning now names the line that broke the parse rather than only the rule, and `unreadableUpdatesWarning` builds it from a single task, so `shipbench task get` reports it too. That was the narrowest read — the one agents are told to prefer — and it used to say nothing at all, because validation ran only over a whole directory. `task get --json` carries the quarantined section as `unreadable_updates`.
  
  Consumers reading `Task.body` for a malformed task will see a shorter string than before: the description, without the section appended.

## 0.4.0

### Minor Changes

- 6a93ad4: Let a Task Update hold ordinary Markdown headings. A line starting a heading at column 0 inside an entry's text — `#` through `######` — made the next read report a malformed Updates section, at every level, including the `####` that reads as plain body text. The write succeeded and the read failed later, so nothing surfaced the problem until someone touched that task's Updates again; by then `task comment`, `comment edit`, and `comment delete` all refused the task while `task get`, `list`, `move`, and `edit` kept working, leaving a board that looked healthy and a file only a hand edit could repair.
  
  Only a `### <ISO 8601 timestamp>` line opens an entry now. A heading whose text starts with a calendar date is still judged as an entry heading, so a hand-written one at the wrong level is caught rather than folded silently into the entry above it; every other heading is prose.
  
  `addComment` and `editComment` now validate entry text before writing, so the CLI can no longer produce a file it will refuse to read. Text carrying its own `## Task Updates` heading, a column-0 heading whose text is a date, or an unclosed code fence is rejected on the command that wrote it. `createTask` and `updateTask` reject a description that leaves a code fence open for the same reason: the fence ran past the end of the description and swallowed the marker below it, hiding every entry from `task get`, the board, and search while the file still held them.
  
  `shipbench task comment` and `shipbench task comment edit` accept `--body <text>` and `--body-file <path>` (`-` reads stdin) in place of the positional text, the same pair `task create` and `task edit` take. `--body-file` is the one to reach for when an update runs to several lines: ShipBench reads the file as UTF-8 itself, so the prose never passes through shell quoting or a shell's encoding.
  
  The CLI now parses each command's options where they are written. An option declared on a parent previously claimed every later occurrence of its flag, which is what kept `task comment edit <slug> <index> --body-file <path>` from reaching its subcommand. The visible consequence elsewhere is that `-C <path>` must precede the subcommand, which is the only place it was ever read.

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
