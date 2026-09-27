---
title: Quickstart
description: Install the ShipBench CLI, initialize a repository, create a task, open the local Kanban board, and record a decision you can search for later.
group: Getting Started
order: 2
updated: 2026-09-27
---

By the end of this page you'll have a repository with a `.shipbench/` folder, a first task, the board open in your browser, and a recorded decision you can search for. It takes a few minutes and works in any Git repository.

You can install the CLI globally or run it through `npx`:

```bash
npm install --global shipbench
shipbench --help

# Or run commands without a global install.
npx shipbench --help
```

The examples below use the installed `shipbench` command. If you prefer `npx`, prefix each command with `npx`.

## 1. Initialize the repository

Run `init` from the root of an existing Git repository:

```bash
shipbench init
```

ShipBench creates:

```text
.shipbench/
├── config.json
├── layout.json
├── README.md
├── AGENTS.md
└── tasks/
    └── welcome-to-shipbench.md
```

The command uses the current directory name as the project name. Override it when needed:

```bash
shipbench init --name "Acme Widgets"
```

`init` is non-destructive. If the repository already contains a valid ShipBench project, the command leaves every project file unchanged. It also refuses to write over an incomplete, malformed, or invalid `.shipbench/` directory and explains what you need to repair.

## 2. Create a task

Create a task in the configured default column:

```bash
shipbench task create "Build the landing page"
```

Add metadata when it helps you sort or delegate work:

```bash
shipbench task create "Build the landing page" \
  --priority high \
  --tags site,frontend \
  --assignee agent
```

Write the description with the task instead of opening the file afterward.
`--body` takes text; `--body-file` reads a Markdown file as UTF-8, which is the
one to use for anything multi-line:

```bash
shipbench task create "Build the landing page" --body-file plan.md
shipbench task edit build-the-landing-page --body-file revised-plan.md
```

ShipBench slugifies the title, avoids collisions across live and archived tasks, validates the metadata, and sets the `created` and `updated` timestamps.

## 3. Open the board

Launch the local board from the same repository root:

```bash
shipbench board
```

The ShipBench CLI opens `http://127.0.0.1:4321/` in your browser. If port `4321` is busy, it tries the next nine ports and prints the selected address.

The server watches `.shipbench/tasks/`, `config.json`, and `layout.json`. Changes made through the board, CLI, editor, or an agent appear without a manual refresh.

Choose another port or keep the browser closed:

```bash
shipbench board --port 4400
shipbench board --no-open
```

## 4. Record a decision, and find it later

A task can carry timestamped updates below its description. Append one when a
choice only makes sense against the moment it was made:

```bash
shipbench task comment build-the-landing-page \
  "Chose static generation over SSR: the content changes at release, not per request."
```

`--body-file` reads a Markdown file, the same way it does for `task create`.

Search covers titles, tags, descriptions, and updates, so the explanation stays
reachable long after the session that wrote it:

```bash
shipbench task search "static generation" --all
```

`--all` includes archived tasks alongside live ones. Nothing is captured for
you — search finds what you or your agent chose to write down.

## Work with a coding agent

`shipbench init` creates `.shipbench/AGENTS.md`, a machine-facing reference for the project board. It teaches agents the task schema, valid operations, dependency rules, archive safeguards, and current CLI discovery commands.

Give your coding agent this starting instruction:

```text
Read .shipbench/AGENTS.md, then run shipbench task list --available --json.
Use shipbench task get <slug> before starting a task.
```

Codex, Claude Code, Cursor, AGY, and other coding tools can use the same file. Automatic discovery differs by tool: some agents read nested `AGENTS.md` files automatically; others need a pointer from their root instructions or your prompt. ShipBench stores plain guidance instead of binding your project to one agent platform.

For efficient agent reads, shortlist tasks without bodies and fetch one full task afterward:

```bash
shipbench task list --available --json
shipbench task get build-the-landing-page
```

[Resuming a Project](/docs/resuming-a-project/) follows a small project through a break and a handoff to a fresh agent session. See the [ShipBench CLI Reference](/docs/cli-reference/) for every command and [Workflows](/docs/workflows/) for a branch-aware multi-agent flow.
