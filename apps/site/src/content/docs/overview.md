---
title: ShipBench Overview
description: Learn how the ShipBench project system, ShipBench CLI, local board, and ShipBench Harbor work together.
group: Getting Started
order: 1
updated: 2026-08-05
---

A hosted tracker is built to coordinate a team, and you configure it again for every repository — so most projects never get one, and the plan ends up in your head or in a `TODO.md` that stopped reflecting reality a week ago. ShipBench's answer is to keep the plan in the repository that already holds your code, your documentation, and your architecture decisions. [Why ShipBench](/docs/why/) makes the full argument.

ShipBench is Git-native project management for solo developers. Your project plan lives inside your repository as plain Markdown files, so Git, your editor, the ShipBench CLI, the local board, and coding agents share one source of truth. The project system requires no external database or hosted account.

ShipBench is one portable system with several clients:

- **The ShipBench project system** — the `.shipbench/` directory, file format, and rules that turn any Git repository into a task board. It works on its own.
- **The ShipBench CLI and local board** — local clients for querying, validating, editing, and viewing the project system.
- **ShipBench Harbor** — an optional hosted client for developing ideas before code exists and observing pushed task boards across public GitHub repositories.

ShipBench Harbor never stores ShipBench tasks. Tasks remain in their repositories, and you can use the project system, CLI, and local board without Harbor.

## Start here

New to ShipBench? Read these in order:

1. [Why ShipBench](/docs/why/) — the problem ShipBench solves, and why the plan belongs in the repository.
2. [Quickstart](/docs/quickstart/) — install the ShipBench CLI, initialize a repository, create a task, and open the board.
3. [Workflows](/docs/workflows/) — pick a development process, from a solo loop on `main` to concurrent agents in Git worktrees, and paste the conventions your agents need.

## Reference

- [ShipBench Project Files](/docs/convention-spec/) — the specification for the `.shipbench/` directory: task format, dependencies, updates, ordering, and archives.
- [ShipBench CLI Reference](/docs/cli-reference/) — every command, flag, and JSON payload, with agent-oriented query patterns.
