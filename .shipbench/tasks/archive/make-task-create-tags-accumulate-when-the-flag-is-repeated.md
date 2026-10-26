---
title: Make task create --tags accumulate when the flag is repeated
status: done
priority: medium
tags:
  - cli
  - bug
created: '2026-10-13T23:22:35.435Z'
updated: '2026-10-13T23:26:12.162Z'
---

`task create --tags` keeps only the last value when the flag is repeated: `--tags a --tags b` writes `tags: [b]` with no error. Every other list flag accumulates across repeats — `task create --depends-on`, `task edit --tags` / `--add-tag` / `--remove-tag`, and `--tag` on `list`, `search`, and `board` — so an agent reasonably expects the same here and silently loses tags.

Reported by an agent working in another repo, which fell back to a comma-separated quoted list.

## Fix

- Parse `task create --tags` with the same accumulating comma-list parser `task edit` uses, and dedupe case-insensitively the way `task edit --tags` does.
- Help text and the CLI reference say "comma-separated or repeatable."
- Test a repeated `--tags` on create.
- Patch changeset for `shipbench`.
