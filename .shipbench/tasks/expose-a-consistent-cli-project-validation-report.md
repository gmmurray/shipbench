---
title: Expose a consistent CLI project validation report
status: done
priority: medium
tags:
  - cli
  - core
  - validation
  - dx
created: '2026-09-06T18:32:59.325Z'
updated: '2026-11-20T22:08:12.067Z'
---

ShipBench reports useful warnings while reading tasks and configuration. Provide one deliberate command for checking the project's structural health after manual edits, merges, or a batch of agent changes.

## Decisions before implementation

Choose the command, warning/error categories, exit behavior, and machine-readable report shape. Define the scope of live tasks, optional archive inspection, configuration, dependency consistency, and layout references. Reuse the established validators and graceful-read behavior.

Distinguish invalid data from supported states such as an absent layout file or preserved unfamiliar fields. Do not treat a convention preference or task-content judgment as a schema failure.

## Acceptance

- Report each actionable structural problem with its source and useful repair context.
- Continue inspecting other readable files after one malformed task.
- Make archive inspection explicit and keep stdout JSON clean.
- Return stable exit behavior suitable for scripts or optional CI use.
- Leave all project files unchanged; repairs require a separate explicit action.
- Check representative malformed and valid partial configurations and task files.
- Document what the command can establish. It validates structure, not whether a task is substantively finished or its rationale is correct.

## Task Updates

### 2026-11-12T00:15:42.238Z
Implemented as top-level `shipbench validate [--archived] [--json]`, backed by core's new `validateProject`. Decisions taken:

- **Command name.** Top level rather than `task validate` (which an old comment in `tasks.ts` anticipated), because it checks `config.json` and `layout.json` as well as tasks.
- **Severity rule.** `error` = invalid data that misplaces, hides, or permanently blocks a task (unknown status, unparseable frontmatter, dangling/self/cyclic `depends_on`, broken `layout.json`, invalid config, slug reused across live and archive, and so on). `warning` = reads correctly but probably unintended (preserved unknown field, unknown config key, dangling or self `related`, unknown layout column key, non-`.md` file in `tasks/`). A dangling `related` is a warning because it gates nothing; a dangling `depends_on` is an error because the task can never become available.
- **Not reported (supported states).** Partial config, absent or gitignored `layout.json`, stale layout slugs (the next layout write prunes them). Markdown links in descriptions and other content judgments are out of scope.
- **Stable codes.** Read warnings now carry an optional `code` (always set by core), so the report reuses the read path's validators instead of a second copy. `validateProject` adds only what one read cannot see: cycles of any length, live/archive slug reuse, ignored files, and unknown config keys.
- **New read warnings.** Missing/blank `title`, missing/malformed `created`/`updated`, non-list `tags`, non-string `depends_on` entries, self-dependency, self-`related`. These show up in `task list` / `task search` too. An empty `depends_on:` (null) still warns, because availability reads it as unmet.
- **Invalid config stops the check before task files** (`checked.tasks: null`), since statuses and priorities are only valid relative to it.
- **Exit codes.** `0` no errors (warnings pass), `1` any error, `2` cannot run (no board, usage error, read failure). `CliExitError` now allows `1`.
- **Streams.** Text problems go to stdout, the summary to stderr (a clean run prints nothing on stdout). With `--json`, stdout holds only the report; config load warnings go into the report rather than stderr. JSON adds a CLI `hint` to problems a command can repair.
- **Archive** only with `--archived`. Without it, archive files are listed but not parsed (used to resolve archived dependencies and detect slug reuse).

No `--strict` (fail on warnings) flag. Add one if CI use asks for it.

### 2026-11-16T02:13:47.793Z
Review fixes:

- **`task edit` now repairs malformed list fields**, so every `validate` hint works. `tags`, `depends_on`, and `related` are read through one helper that records whether the stored value is a list of strings. When it isn't (a bare string, a non-string entry, or a null `depends_on`), replace, clear, add, and remove always write a clean value. An empty result removes the field, as a normal clear does. Add and remove start from the stored value's text entries. The change line shows the old value as `(invalid: <raw JSON>)`. A null `tags` or `related` still counts as an empty list, and a null `depends_on` doesn't, which matches the read warnings. Core's `updateTask` needed no change: it already normalizes an empty `depends_on`/`related` away and strips an undefined `tags`.
- **CLI tests per hint**: each starts from the malformed file, runs the command `validate` suggests, and checks the code is gone. Covered: `tags-invalid` via `--tags` and `--clear-tags`, `depends-on-invalid` with null (`--clear-depends-on`) and with a non-string entry (`--depends-on`, `--clear-depends-on`), and `related-invalid` (`--clear-related`, `--related`).
- **Blank title** now reads "Blank title. Every task needs a non-empty `title`." (this includes `''`). "Expected title to be text" is kept for non-strings.
- **`config-unparseable`** ends the parse error with a period before "Tasks were not checked", without doubling one that is already there.
- **Changeset** now says `task edit` repairs non-list `tags`, `depends_on`, and `related`.
