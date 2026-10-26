---
title: Confine task slugs to the tasks directory in core
status: done
priority: high
tags:
  - core
  - security
created: '2026-09-23T19:28:44.468Z'
updated: '2026-09-26T20:55:24.304Z'
---

Core builds every task path by pasting the slug in: `` `${TASKS_DIR}/${slug}.md` ``
in [tasks.ts](../../packages/core/src/tasks.ts), with `ARCHIVE_DIR` for archived
reads. Nothing checks that the slug is a single path segment. `FsAdapter`
resolves paths with a bare `join(rootDir, path)`
([fs.ts](../../packages/core/src/adapters/fs.ts)) and doesn't check that the
result stays under the root either. So a slug containing `../` reaches any
`.md` file relative to `.shipbench/tasks/`, inside the repo or outside it.

Reproduced against the built core in a scratch project:

- `deleteTask(adapter, config, '../../DOOMED')` deleted `DOOMED.md` from the
  repo root.
- `unarchiveTask(adapter, config, '../../../NOTES')` read the repo-root
  `NOTES.md` as if it were an archived task, wrote it to the repo's *parent*
  directory, and deleted the original.

The reachable files are exactly the `.md` ones, which includes `README.md`,
`AGENTS.md`, `CLAUDE.md`, and every doc.

## Who can reach it

- **The CLI board server.** `boardServer.ts` decodes the slug segment with
  `decodeURIComponent`, and its route regex (`[^/]+`) only excludes a literal
  `/`. So `%2F` becomes a real separator. Combined with the missing origin
  checks in
  [reject-cross-origin-and-rebound-requests-to-the-cli-board-server](reject-cross-origin-and-rebound-requests-to-the-cli-board-server.md),
  a web page can send a bodiless `no-cors` POST to
  `/api/tasks/..%2F..%2F..%2FREADME/unarchive` and move the user's README out
  of their repo. That task closes the browser route. This one closes the hole
  underneath it, and neither depends on the other.
- **The CLI.** `shipbench task delete ../../README` deletes the README. The
  user typed it, but agents drive the CLI with slugs they assembled, and a
  mangled slug shouldn't be able to reach outside the board.
- **Any other host.** Harbor reads through a read-only GitHub adapter, so the
  risk there is reading an arbitrary `.md` through `getTask`. Validating in
  core covers every adapter at once.

`depends_on` is already safe: it's validated against the slugs `listTasks`
returns, not by building a path. `createTask` is safe too, since it slugifies
the title.

## Direction

- **Validate in core, once, at every exported function that turns a slug into
  a path.** Today that's `getTask`, `updateTask`, `addComment`, `editComment`,
  `deleteComment`, `reorderTask`, `moveTask`, `deleteTask`, `archiveTask`, and
  `unarchiveTask`. Grep for other callers when implementing. One shared
  assertion, not a copy per function.
- **Define "valid" as "a single path segment", not as "what `slugify` would
  produce".** `listTasks` returns every `*.md` filename as a slug, including
  hand-created files that `slugify` wouldn't generate (uppercase,
  underscores). A shape regex would make those tasks unreadable and unmovable
  through core. Reject: empty, `.`, `..`, anything containing `/` or `\`, and
  NUL.
- **Give the error a message that matches the board server's validation
  regex** (e.g. starting with `Invalid`), so the server answers 400 rather
  than 500.
- **Also make `FsAdapter` refuse a path that resolves outside its root**, the
  way `serveStatic` in `boardServer.ts` already does for the bundle directory.
  This is defense in depth for anything that reaches the adapter without going
  through core's slug functions.

## Acceptance

- Each slug-taking core function rejects `../x`, `a/b`, `a\b`, `..`, and the
  empty string before touching storage. Tests prove nothing was read, written,
  or deleted.
- A hand-created task whose filename `slugify` wouldn't produce (e.g.
  `My_Task.md`) can still be read, moved, edited, archived, and deleted.
- `FsAdapter` rejects a path that escapes its root, for reads, writes,
  deletes, and listings.
- `DELETE /api/tasks/..%2F..%2FREADME` and
  `POST /api/tasks/..%2F..%2FREADME/unarchive` on the board server return 400
  and leave the file in place.
- `shipbench task delete ../../README` fails with the validation message.
- Add a changeset. This changes `@shipbench/core`, which is in the fixed
  release group.
