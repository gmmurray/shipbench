---
title: Add 'task show' as an alias of 'task get'
status: done
priority: low
tags:
  - cli
created: '2026-10-07T15:53:05.399Z'
updated: '2026-10-08T22:22:29.681Z'
---

An agent in another repo ran `shipbench task show <slug>`, got an unknown-command error, and fell back to reading the task's `.md` file directly. That skips what `task get` adds: validation warnings, the archived-task hint, and unreadable-file handling.

`show` is the name people and agents guess first (`git show`, `gh issue view`), and Commander's "did you mean" suggestion can't bridge `show` → `get`. `board terminal` already takes `term` and `tui` as aliases, so there's precedent.

## Scope

- Register `show` as an alias of `task get`, with the same options and behaviour.
- Test that the alias resolves, beside the existing `task get` tests.
- Changeset for the CLI.

Only `show`. Don't add `view` or other guesses until an agent is seen reaching for one.
