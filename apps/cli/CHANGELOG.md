# shipbench

## 0.6.0

### Minor Changes

- b741ea0: The board now asks before you leave a task with unsaved text in the description, the Task Updates box, or an update you're editing. Every way out of the task asks first: the back button, the breadcrumb, previous and next, `j`/`k`, a link to another task, the archive, and Escape. "Keep editing" leaves everything as it was, and "Discard" continues where you were going. With nothing unsaved, you leave at once as before.
  
  While text is unsaved, reloading or closing the tab also shows the browser's leave prompt. The board adds that prompt only while something is unsaved, so an embedding page's unload behavior is otherwise unchanged. Read-only boards have no editors and never ask.
- ebd3305: A page that embeds the board can now fit it under its own app bar or inside a panel by setting two CSS custom properties on the mount element or any ancestor. `--sb-viewport-h` is the height the board treats as its viewport, and defaults to `100vh`. `--sb-sticky-top` is where the board's sticky header and detail panel stop, and defaults to `0px`. With neither set, the board looks exactly as before.
- e0963cf: The board's search box has a clear button while it holds text, and Escape in a non-empty search box clears it too. Either way the full board comes back at once, without the usual search delay, and focus stays in the box so you can type a new query.
  
  When a task is open, Escape in a non-empty search box clears the search first. The next Escape closes the task as before. Read-only boards get the same control.
- a9ff486: The board's search box now finds tasks by their descriptions and Task Updates, as well as their titles, slugs, assignees, and tags. It matches the way `shipbench task search` does: every term, or double-quoted phrase, has to appear somewhere in the task.
  
  When a match is only in a task's content, the card shows where it was found: a snippet of the description, or the matching Update's excerpt and timestamp, with a count of any other matching Updates. Search still hides cards without reordering columns. The empty state now lists what search covers, and the archive view's filter works the same way.
- 9db1d21: The welcome task that `shipbench init` writes now ends with a Task Updates entry, timestamped when the board was created, and its next steps include `shipbench task comment`. A new board shows what an Update looks like and which command adds one.
  
  Only newly initialized boards change. `init` still leaves an existing project untouched.
  
  A fresh welcome task now starts with one Update, so an entry you append to it sits at index 1, not 0. Scripts that seed a board with `init` and then edit or delete Updates by index should account for it.

### Patch Changes

- 9a2ae9e: The board no longer loses what you're typing when the open task changes on disk. If you have unsaved changes to a title, description, or Task Update and the task file changes underneath you, the board keeps your text and says the task changed. You can load the new version, which discards your text, or keep yours. An editor with no unsaved changes still picks up the new version silently.
  
  Editing a Task Update now stays attached to that entry when another entry is added or deleted on disk, so a save can no longer land on a different update. If the entry you're editing is itself deleted, the board keeps your text and won't save it. A pending delete confirmation also stays on the update you chose.
- 4fa3fbf: A page that mounts several boards and hides the inactive ones, with the `hidden` attribute or `display: none`, now sends the board's keyboard shortcuts only to the visible board. Before, Escape closed open tasks on every board, and a hidden board with a task open could take `j`/`k` and the arrow keys, which blocked page scrolling and the visible board's own navigation.
  
  Escape pressed in a text field no longer closes the open task or the archive view. A description or Task Update you're writing stays open with your text. Escape in the search box still clears it first and then closes the task.
- Updated dependencies [b741ea0]
- Updated dependencies [9a2ae9e]
- Updated dependencies [ebd3305]
- Updated dependencies [e0963cf]
- Updated dependencies [a9ff486]
- Updated dependencies [4fa3fbf]
  - @shipbench/board@0.6.0

## 0.5.0

### Minor Changes

- 2617c6b: Stop an unreadable Updates section from eating the description it sits under. When the trailing `## Task Updates` section did not parse, core returned the entire raw body as `Task.body` — the field documented as "Timeless task description, excluding the reserved trailing Task Updates section" — and every consumer that trusted that comment inherited the damage.
  
  The sharpest consequence was silent data loss: `task edit --body` on such a task succeeded, reported success, and deleted the whole section, good entries included, because the raw text lived in `body` and the write serialized an empty `comments` over it. The description guard could not catch it, since the incoming body was clean. Git was the only trail.
  
  Core now keeps the split it already computed. `Task.body` is the description above the marker; the section is quarantined verbatim on a new optional `Task.unreadableUpdates` (`{ text, reason }`) and written back byte-identical on every write. A frontmatter or description edit can no longer drop it, the Board's description editor holds a real description again, and `task search` stops matching broken entry text as if it were the description. Comment mutations still refuse a task in this state — appending to a section that cannot be read would leave it just as unreadable.
  
  The warning now names the line that broke the parse rather than only the rule, and `unreadableUpdatesWarning` builds it from a single task, so `shipbench task get` reports it too. That was the narrowest read — the one agents are told to prefer — and it used to say nothing at all, because validation ran only over a whole directory. `task get --json` carries the quarantined section as `unreadable_updates`.
  
  Consumers reading `Task.body` for a malformed task will see a shorter string than before: the description, without the section appended.
- b1e6037: `task search` now ranks results by relevance instead of returning them in board order. `searchTasks` in `@shipbench/core` scores each match on which fields the query terms landed in — title outweighs tags, tags outweigh the description, the description outweighs Task Updates — scaled by how much of the query each field covers. A more recently `updated` task breaks a score tie, then the caller's input order. The ranking lives in `searchTasks` itself, so the Board inherits the same order when its description-search work adopts the shared function.
  
  `--limit` no longer truncates silently. The CLI's JSON output gains `total_matches` (the count before the limit), and text output ends with a `… N of M matches not shown (raise --limit)` line whenever the limit drops a match, including `--limit 0`.
  
  Still staged to follow-up tasks: metadata and availability filters on `task search`, whole-word and exact-phrase matching, semantic retrieval.
- 50df087: `task search` now takes `task list`'s own filters: `--status`, `--assignee`, `--priority`, `--tag` (comma-separated or repeated, AND semantics), and `--available` / `--blocked`. They narrow the candidate set before the search runs, so "ready work that mentions X" is one command instead of a search whose output you filter by hand.
  
  The filters reuse `task list`'s predicate and the `listAvailableTasks` / `listBlockedTasks` helpers verbatim, so semantics match exactly — `--available` / `--blocked` rank on `config.default_column` unless `--status` overrides it, and an archived dependency counts as satisfied. `--available` excludes `--blocked`, and availability is a live-column concept that cannot combine with `--archived` / `--all`. Filtering never changes the relevance ordering; it only decides which tasks are searched.
  
  This completes the metadata/availability narrowing that `make-cli-search-retrieve-recorded-decisions-with-useful-context` deferred. Still staged: whole-word and exact-phrase matching, semantic retrieval.
- d5ad53b: `task search` now retrieves recorded decisions. The search corpus gains **Task Updates**: every parsed entry, plus a quarantined unreadable section, alongside the title, tags, and description it already covered. A pivot or rationale recorded only in an Update — the place ShipBench tells you to record it — is now findable with the one command built for that.
  
  `searchTasks` in `@shipbench/core` is now the shared lexical retrieval contract; the Board implements the same semantics next. Each `TaskSearchMatch` carries more source context so a caller can act on a hit without loading the whole task:
  
  - `status` — the task's current column, so an Update match reads as a record, not a claim that the decision still stands.
  - `matched_fields` may now include `"updates"` (additive to the `title` / `tags` / `body` set).
  - `update_matches` — present when an Update matched. A readable entry gives its zero-based `index`, ISO `timestamp`, and an excerpt, so the source is retrievable exactly; an unreadable section gives `{ unreadable: true, snippet }`.
  
  The CLI adds `location` (`"live"` / `"archive"`) to every JSON match and prints `[live · in-progress]` and `↳ update N (timestamp): …` lines in text mode. `--include-body` now also attaches `comments` so an Update hit resolves in one call. Search output never labels a match "current" or "decided".
  
  Deliberately staged to follow-up tasks, not in this change: metadata and availability filters on `task search`; whole-word and exact-phrase matching; semantic retrieval.
- ea2df5b: `task search` gains two opt-in precision controls. Both narrow how a term matches and leave the corpus, ranking, and result context untouched.
  
  - **Exact phrase.** A double-quoted run in the query — `"token exchange"` — is one term that must match contiguously. Internal whitespace matches any whitespace run, so a phrase still hits when it wraps across a line; an empty or unbalanced quote is dropped. The CLI reads the quote characters from the `<query>` argument literally, so protect them from the shell: `shipbench task search '"token exchange"'`.
  - **`--whole-word`.** Matches every term — loose or quoted — on word boundaries, so `ci` stops matching `decision`, `explicit`, and `specific`.
  
  The grammar lives in `searchTasks` in `@shipbench/core`, which now takes an optional third `TaskSearchOptions` argument (`{ wholeWord?: boolean }`); the quote grammar is parsed from the query string. The Board inherits both when it adopts the shared function. Substring, whitespace-delimited matching stays the default.
  
  This completes the whole-word and exact-phrase matching staged by `make-cli-search-retrieve-recorded-decisions-with-useful-context`. Still staged: semantic retrieval.
- 56be8c8: A task file whose frontmatter does not parse now shows up everywhere instead of disappearing. A hand edit that repeats a key, such as a second `depends_on:`, makes the YAML invalid. Until now, core dropped that file from every read and left a single warning behind. The Board showed nothing, and `task list --json` returned a `tasks` array that looked complete.
  
  Core now returns the file itself. `TaskReadResult` has a new required `unreadable` array of `UnreadableTaskFile` entries (`slug`, `path`, the whole file verbatim, and a `reason` that names the file line where it can, such as "Duplicated mapping key at line 5."). The `frontmatter` warning is still there. Frontmatter that parses to a list or a bare value, which used to come through as a task with fields named `0` and `1`, is treated the same way. `getTask` and every mutation now throw an exported `UnreadableTaskError` whose message names the task and the file and whose `file` carries the same record. Before, `getTask` threw the raw js-yaml message, which named neither. Hosts that build a `TaskReadResult` themselves must add `unreadable`.
  
  The Board shows these files in an Unreadable column at the leading edge of the board and in the archive view. Each read-only card shows the path, the reason, and the frontmatter exactly as written.
  
  `shipbench task list` and `task search` print each file as an `[unreadable]` line after the tasks, whatever the filters, and their JSON has an `unreadable` array (`--include-body` adds the raw `content`). Both still exit `0`, because the read succeeded and the file is in the output. `task get` on such a file fails with the new message. The terminal board shows an "N unreadable" alert, and the board server answers a write to the file with 422.
- debafc0: `shipbench task edit` now revises validated task metadata, not just the description. New flags: `--title` (which never renames the file), `--priority`, `--assignee` / `--clear-assignee`, `--tags` / `--add-tag` / `--remove-tag` / `--clear-tags`, and `--depends-on` / `--add-depends-on` / `--remove-depends-on` / `--clear-depends-on`. Array flags take comma-separated or repeated values; replacement and incremental forms are mutually exclusive, and clearing a field is always its own flag. Every requested change goes through one `updateTask` call, so core's validation runs before any write and a rejected value (an unconfigured priority, a `depends_on` slug with no task file) leaves the task exactly as it was. `status` and board placement stay with `task move`; the Updates section stays with `task comment`.
  
  `core`'s `updateTask` now rejects a `title` with no slug-able character, mirroring `createTask`, rather than writing a task with an empty title.
  
  `task list` and `task search` filters are now consistent: `--status`, `--assignee`, and `--priority` accept a comma-separated or repeated list and match a task whose value is any of the ones listed (`--tag` keeps AND). A `--status` or `--priority` value that is not configured is now an error that names the valid set — previously `task list --status backlog,todo` matched nothing and exited zero. `TaskAvailabilityOptions.status` accepts a list alongside a single id.
  
  Completes `complete-validated-task-metadata-editing-in-the-cli`, including the multi-value filter-flag defect folded into its scope during board review.

### Patch Changes

- dcf2a94: `shipbench board` now refuses requests that a web page could send on your behalf. The server binds `127.0.0.1`, which keeps other machines out, but it answered every request that reached it, including ones from other pages open in the same browser.
  
  Two attacks were possible. A page on any site could send a `no-cors` POST with a `text/plain` body, which the browser sends without a preflight, and create, reorder, comment on, archive, or unarchive tasks. The attacker could not read the response, but the write had already happened. And a page on a hostname that re-resolves to `127.0.0.1` (DNS rebinding) became same-origin with the board, so it could read the whole board and send any write.
  
  The server now answers with 403 when the `Host` header names anything other than `127.0.0.1` or `localhost` on the port it actually bound. This covers API routes, the event stream, and static files. It also returns 403 for a state-changing request whose `Origin` is not the board's own, including the literal `null` that sandboxed frames and `file:` pages send. Requests with no `Origin`, such as those from curl or scripts, are still accepted, and the standalone board's own requests are unchanged.
- 0a42655: Confine task slugs to the tasks directory. Core built every task path by pasting the slug into `.shipbench/tasks/<slug>.md`, and nothing checked that the slug was a single path segment, so a slug containing `../` could reach any `.md` file relative to the tasks directory, inside the repository or outside it. `shipbench task delete ../../README` deleted the README, and the board server, which decodes `%2F` in its task routes, could be sent `POST /api/tasks/..%2F..%2FREADME/unarchive` to move it out of the repository.
  
  Every core function that turns a slug into a path (`getTask`, `updateTask`, `addComment`, `editComment`, `deleteComment`, `reorderTask`, `moveTask`, `deleteTask`, `archiveTask`, `unarchiveTask`) now rejects an empty slug, `.`, `..`, and anything containing `/`, `\`, or NUL before touching storage, with an error beginning `Invalid task slug`. The board server answers these with 400. A slug does not have to look like `slugify` output: a hand-created `My_Task.md` stays readable, movable, and deletable.
  
  `FsAdapter` also refuses a path that resolves outside its root, for reads, writes, deletes, and listings, as a second line of defense for anything that reaches the adapter without going through core's task functions.
- Updated dependencies [e2d15c9]
- Updated dependencies [56be8c8]
  - @shipbench/board@0.5.0

## 0.4.0

### Minor Changes

- 6a93ad4: Let a Task Update hold ordinary Markdown headings. A line starting a heading at column 0 inside an entry's text — `#` through `######` — made the next read report a malformed Updates section, at every level, including the `####` that reads as plain body text. The write succeeded and the read failed later, so nothing surfaced the problem until someone touched that task's Updates again; by then `task comment`, `comment edit`, and `comment delete` all refused the task while `task get`, `list`, `move`, and `edit` kept working, leaving a board that looked healthy and a file only a hand edit could repair.
  
  Only a `### <ISO 8601 timestamp>` line opens an entry now. A heading whose text starts with a calendar date is still judged as an entry heading, so a hand-written one at the wrong level is caught rather than folded silently into the entry above it; every other heading is prose.
  
  `addComment` and `editComment` now validate entry text before writing, so the CLI can no longer produce a file it will refuse to read. Text carrying its own `## Task Updates` heading, a column-0 heading whose text is a date, or an unclosed code fence is rejected on the command that wrote it. `createTask` and `updateTask` reject a description that leaves a code fence open for the same reason: the fence ran past the end of the description and swallowed the marker below it, hiding every entry from `task get`, the board, and search while the file still held them.
  
  `shipbench task comment` and `shipbench task comment edit` accept `--body <text>` and `--body-file <path>` (`-` reads stdin) in place of the positional text, the same pair `task create` and `task edit` take. `--body-file` is the one to reach for when an update runs to several lines: ShipBench reads the file as UTF-8 itself, so the prose never passes through shell quoting or a shell's encoding.
  
  The CLI now parses each command's options where they are written. An option declared on a parent previously claimed every later occurrence of its flag, which is what kept `task comment edit <slug> <index> --body-file <path>` from reaching its subcommand. The visible consequence elsewhere is that `-C <path>` must precede the subcommand, which is the only place it was ever read.

### Patch Changes

- @shipbench/board@0.4.0

## 0.3.0

### Minor Changes

- 4cddbc5: Let a task's description be written and revised without hand-editing the file. `createTask` now takes an optional body, and the CLI exposes it as `shipbench task create --body <text>` / `--body-file <path>` (`-` reads stdin) alongside a new `shipbench task edit <slug>` that replaces a description whole — an empty value clears it. Both paths preserve `created`, bump `updated`, and leave `## Task Updates` alone, which removes the read-modify-write against the file the CLI just wrote.
  
  `--body-file` is the path to prefer for anything multi-line: ShipBench opens the file itself and reads it as UTF-8, so the description never passes through shell quoting or a shell's encoding — on Windows, both a quoted argument and a pipe go through PowerShell's Windows-1252 decode and corrupt every non-ASCII character.
  
  `createTask` and `updateTask` now reject a body containing an unfenced `## Task Updates` heading, naming `task comment` instead. Serialization writes the body verbatim, so such a heading previously turned part of a description into comments on the next read — reachable today through the Board's description editor, not only through the new flags.

### Patch Changes

- @shipbench/board@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [bac700d]
- Updated dependencies [7d32f8a]
  - @shipbench/board@0.2.0

## 0.1.1

### Patch Changes

- 09068e0: No functional changes. The package contents are identical to 0.1.0.
  
  This release exists to exercise the release pipeline after it moved from a
  long-lived npm token to GitHub OIDC trusted publishing, and to attach the
  provenance attestations that 0.1.0 shipped without. Attestations are applied at
  publish time and published versions are immutable, so verifying the fix required
  publishing a version rather than amending one.
- Updated dependencies [09068e0]
  - @shipbench/board@0.1.1

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
  - @shipbench/board@0.1.0
