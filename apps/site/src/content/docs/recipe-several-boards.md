---
title: 'Recipe: Several Boards in One Repository'
description: Give each part of a repository its own board, with its own columns and agent instructions, and tell agents which board owns which code.
group: Workflows
order: 6
updated: 2026-10-25
---

## What it does

Gives a part of your repository its own `.shipbench/` directory. A board belongs to the directory it sits in, so `packages/api/.shipbench/` is a complete board with its own `config.json`, its own tasks, and its own `AGENTS.md`, exactly like one at the repository root. Each board's tasks are invisible to every other board.

The CLI needs no setup for this. The part that needs writing is a routing note in your root `AGENTS.md`, so an agent that starts at the repository root knows which board owns the code it is changing.

## When you'd want it

Use one board and [tags](/docs/cli-reference/#shipbench-task-list) when the parts share a workflow. `shipbench task list --tag api` and board search already narrow one board to one part, and only one board lets a task in `site/` depend on a task in `packages/api/`.

Use a board per part when the parts differ in something one board has only one of:

- **Columns.** The site wants `draft → review → published` while the API wants a `review` gate.
- **Cadence.** One part closes dozens of small tasks a week, and you want its `done` history kept apart from the rest.
- **Agent instructions.** Each part has rules an agent working on the other part shouldn't read.

If the parts need to depend on each other more than they need any of these, keep one board.

## Creating a board in a subdirectory

```bash
shipbench -C packages/api init
```

`init` creates the board where you point it and names it after the directory, here `api`. When a board already exists above it in the same checkout, `init` still creates the new one and prints a note naming the existing board. That note is also how you'd notice an `init` run in the wrong directory by mistake.

## Reaching each board

Without `-C`, every command uses the nearest board at or above the current directory. Anywhere inside `packages/api/`, including `packages/api/src/`, that is the api board. When the board was found above the current directory, commands that change a task print `Using .shipbench/ from <path>` on stderr first, so a write always names its board.

A directory with no board of its own reaches the nearest board above it. If the repository root has a board and `site/` does not, commands run in `site/` read and write the root board.

`-C <path>` names a board exactly and never searches above it. It is the clearer form for agents and scripts, because the command says which board it means wherever it runs:

```bash
shipbench -C packages/api task list --available --json
```

## The block

Each board's `.shipbench/AGENTS.md` describes that board. An agent working from the repository root reads the root `AGENTS.md`, and whether it ever opens a nested one depends on the tool. Paste this into your repository's root `AGENTS.md`, with one line per board:

```text
## Task boards

This repository has two ShipBench boards. Use the one that owns the code you
are changing, and follow that board's `.shipbench/AGENTS.md`:

- `packages/api/`: `shipbench -C packages/api task list --available --json`
- `site/`: `shipbench -C site task list --available --json`

Every command takes the same `-C` path as its board's list command. A task on
one board cannot depend on a task on the other. Link to its file in the
description instead.
```

The routing note only says where each board is. Each board's own `AGENTS.md` stays the contract for working on it.

## Two boards in the browser

Run `shipbench board` once per board. The first takes port 4321. When a port is in use, the next server tries the following nine and prints the URL it chose:

```bash
shipbench board
shipbench -C packages/api board
```

To choose a board's port, pass `--port`. It sets the preferred port, and the same fallback applies when it is taken:

```bash
shipbench -C packages/api board web --port 4400
```

Each server watches only its own board, and each window takes its title from that board's name, so two tabs stay distinguishable. The board's theme preference is saved per port.

## Pointing across boards

`depends_on` only accepts slugs on the same board. A task that names a slug from another board is rejected with `Unknown dependency`.

To point at a task on another board, link to its file in the description. From a task on the site board:

```markdown
Waits on the API change in
[add-rate-limits](../../../packages/api/.shipbench/tasks/add-rate-limits.md).
```

The path is relative to the task file, which sits three directories below the repository root. Both files are in the same repository and commit, so the link stays correct in your editor and on GitHub. The browser board shows it as a plain path and does not open it.

## With worktrees

The [worktree rules](/docs/recipe-worktree-rules/) apply to each board unchanged. Each board is branch-local, and its status changes run against the canonical checkout. With several boards, `-C` points at the board's directory inside the canonical checkout:

```bash no-copy
shipbench -C ~/code/my-project/packages/api task move <slug> --to review
```

## Tradeoffs

**Dependencies stop at the board's edge.** Work that spans two boards is tracked twice, once on each board, and the link between the two tasks is prose. Nothing reports that the site task is waiting, so check the linked task yourself before starting.

**There is no view across boards.** `task list` and `task search` read one board at a time. Answering "what's ready anywhere in this repository?" takes one command per board.

**Agents have to be told.** The routing note is the only thing that sends an agent to the right board from the repository root, and it goes stale when you add a board without adding its line.
