---
title: Accept --json on task get instead of rejecting it as an unknown option
status: done
priority: medium
tags:
  - cli
  - bug
created: '2026-10-29T22:44:05.438Z'
updated: '2026-11-06T20:16:51.917Z'
---

`shipbench task get <slug> --json` exits 2 with `error: unknown option '--json'`. `get` always prints JSON, so it never declared the flag, and Commander rejects any option a command doesn't declare. An agent in another project reported this. It reproduces against 0.8.0 and against the current source ([cli.ts](../../apps/cli/src/cli.ts), `getTaskCommand`).

Agents will keep guessing wrong. `list`, `search`, `create`, `edit`, and `graph` all take `--json`, and an agent that has used those adds the flag to `get` by habit. This board did it too: the archived description-editing task wrote `task get --json` as its example.

## Current state (0.8.0)

| Accept `--json` | Reject it |
|---|---|
| `list`, `search`, `create`, `edit`, `graph` | `get`/`show`, `move`, `comment` (and its `edit`/`delete`), `flag`/`unflag`, `archive`/`unarchive`, `delete` |

## Fix

- `task get` accepts `--json` as a documented no-op. The help text should say the output is JSON either way. Don't add a text mode just to give the flag something to switch: `get` is a machine-first read.
- **Scope decision for the owner:** should the mutating commands take `--json` as well? My recommendation is yes for commands that return a task (`move`, `flag`/`unflag`, `archive`/`unarchive`, `comment` append and edit), printing the resulting task the way `create --json` and `edit --json` do. That lets an agent confirm a write without a second `get`. `delete` could print `{ slug, deleted: true }` or go without. If this is more than this task should carry, ship the `get` fix alone and split the rest into its own task.

## Acceptance

- `task get <slug> --json` and `task show <slug> --json` print the same output as without the flag and exit 0. `--archived --json` works the same way.
- Tests in the CLI suite cover the flag on `get`, plus each mutating command if those are in scope.
- The CLI README table, the site's `cli-reference.md`, and the scaffolded AGENTS.md template in `packages/core/src/init.ts` mention the flag only where it adds something. At minimum, `--help` for `get` says the output is always JSON.
- A changeset (patch, or minor if the mutating commands gain output).

## Task Updates

### 2026-11-06T20:06:43.710Z
Owner agreed to the full scope: --json on get as a no-op, and --json on the mutating commands that return a task (move, flag/unflag, archive/unarchive, comment append and edit).

### 2026-11-06T20:11:06.414Z
Shipped as a minor. Every task subcommand now takes --json (a structural test walks the command tree, so a new command without it fails). Writes print the task in the get shape; archive --done prints an array; delete prints { slug, deleted: true }; no-op flag/unflag print the unchanged task, matching edit. Docs: CLI README, site cli-reference (new JSON output section), scaffolded AGENTS.md template and this board's copy.
