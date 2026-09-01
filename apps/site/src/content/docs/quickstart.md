---
title: Quickstart
description: Install the ShipBench CLI, initialize a repository, create a task, and open the local Kanban board.
group: Getting Started
order: 2
updated: 2026-08-05
---

ShipBench keeps your project plan in the repository itself. Tasks are Markdown files under `.shipbench/tasks/`, so Git, your editor, the ShipBench CLI, the local board, and coding agents all work from the same source.

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

See the [ShipBench CLI Reference](/docs/cli-reference/) for every command and [Workflows](/docs/workflows/) for a branch-aware multi-agent flow.
