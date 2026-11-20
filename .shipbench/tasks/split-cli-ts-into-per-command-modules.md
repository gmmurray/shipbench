---
title: Split cli.ts into per-command modules
status: done
priority: low
tags:
  - cli
  - refactor
related:
  - expose-a-consistent-cli-project-validation-report
created: '2026-11-20T21:42:58.810Z'
updated: '2026-11-20T22:28:33.498Z'
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

## Task Updates

### 2026-11-20T22:18:22.755Z
Split done. Two departures from the suggested shape:

- **`task get` registers on its own.** Commander lists subcommands in `--help` in registration order, and `get` sits between `comment` and `flag`. To keep `task --help` unchanged, `commands/taskQuery.ts` exports `registerTaskGet` separately from `registerTaskQueries` (list, search, graph). `createCli` calls the register functions in the original order.
- **File names are camelCase** (`taskWrite.ts`, `taskState.ts`, `taskQuery.ts`, `editFields.ts`), matching `boardServer.ts` and `processCli.ts`, not the kebab-case names in the description.

Verification: `--help` output for all 24 command paths (aliases included) is byte-identical to the pre-split build. The moved test bodies match the original `cli.test.ts` line for line as a multiset, with only the imports regenerated. The shared harness lives in `commands/testing.ts`. The CLI suite went from 367 to 385 tests (18 new in `editFields.test.ts`, covering the `StoredList` repair path). `pnpm typecheck` and `pnpm lint` pass. No changeset.
