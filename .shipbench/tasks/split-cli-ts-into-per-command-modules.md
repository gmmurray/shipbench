---
title: Split cli.ts into per-command modules
status: todo
priority: low
tags:
  - cli
  - refactor
related:
  - expose-a-consistent-cli-project-validation-report
created: '2026-11-20T21:42:58.810Z'
updated: '2026-11-20T21:42:58.810Z'
---

`apps/cli/src/cli.ts` is about 2,200 lines. Roughly 1,550 of them are a single `createCli` function that registers all twenty commands inline. The largest handlers are `task edit` (~310 lines), `task search` (~235), `task move` (~160), `task list` (~160), and `task archive` (~100). `cli.test.ts` mirrors it at about 3,900 lines.

The length alone isn't the main problem. It shows up in three ways:

- **Handlers can't be moved out.** They reach `adapter`, `data`, `chrome`, and `CliExitError` through `createCli`'s closure, so none can be extracted or tested alone.
- **Pure logic can only be tested end to end.** `task edit`'s list-field diffing (tags, depends_on, related, including the `StoredList` repair path) is pure logic but can only be tested by running the whole CLI. The bug where `validate`'s repair hints crashed or did nothing lived there.
- **Misplaced code goes unnoticed.** In a file this dense, a block that lands in the wrong place isn't caught. A doc comment ended up attached to the wrong declaration during the validation review.

## Approach

- Pass a small context object (`adapter`, `data`, `chrome`, and whatever else the handlers share) into per-group modules under `apps/cli/src/commands/`. Each module exports `register(program, ctx)`. A possible grouping: `init`, `validate`, `task-write` (create, edit, comment), `task-state` (move, flag, unflag), `task-query` (get, list, search, graph), `archive` (archive, unarchive, delete), and `board`. `createCli` keeps the shared setup and becomes the list of `register` calls.
- Move each module-level helper next to the commands that use it. Keep shared formatting in `output.ts` or a new small module.
- Pull `task edit`'s field-diffing out into a pure function with its own unit tests.
- Split `cli.test.ts` to match the new modules.

This is a pure move. Every command keeps its exact behavior, output, exit codes, and help text. Do it as its own change, not mixed into feature work, so the diff stays reviewable.

## Acceptance

- `createCli` registers commands through per-group modules; no command handler is defined inline in `cli.ts`.
- `task edit`'s list-field diffing is a pure function with direct unit tests.
- The existing CLI tests pass unchanged apart from moving between files. No assertion is weakened or removed.
- `pnpm typecheck`, `pnpm lint`, and the CLI tests pass, and `--help` output for every command is unchanged.
- No changeset is needed: the change is internal and invisible to users. If any user-visible behavior changes, that's a bug in the move.
