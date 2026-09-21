---
title: Let tasks reference related work without implying a dependency
status: todo
priority: medium
tags:
  - core
  - cli
  - board
  - convention
created: '2026-09-14T21:48:37.117Z'
updated: '2026-09-14T21:48:37.117Z'
---

Tasks reference each other for reasons that are not prerequisites: the spike that produced a decision, the sibling task sharing a surface, the audit that explains a constraint. Today that context lives in prose, so it is unqueryable, invisible to every machine-readable read, and easy to mistake for a dependency. Add an optional `related` frontmatter field recording association between tasks and nothing more.

The field never gates anything. It does not affect availability, does not block archiving, does not enter the dependency graph, and never moves a task. It is schema and visibility — the same opt-in posture as `tags`, with the identity resolution `depends_on` already has.

## Settled decisions

These were resolved before the task was written; treat them as given rather than reopening them.

**Undirected, resolved where the project is already loaded.** A file stores one direction, and core never writes another task's file as a side effect — that would change an `updated` timestamp nobody asked to touch. Reads that already hold every task union the incoming edges and dedupe, so an association written on either side is visible from both. A single-task read stays a single-file read and reports the frontmatter as written; it does not load the project to synthesize the other direction.

**Archived targets are valid on write.** Validation resolves against live tasks and the archive, because pointing at an archived spike or decision is the main reason to reach for the field. `depends_on` rejects archived slugs today; leave that alone and record why the two differ — an archived prerequisite is already satisfied, so it is rarely worth writing, while a reference to finished work is the ordinary case.

**The Board edits the field, not just displays it.** The detail view gets the same affordance the dependency field has.

**Validation follows the existing posture.** Strict on write: self-reference and slugs matching no task file are rejected. Graceful on read: a dangling slug is a warning and the task still loads. No cycle rules — an association has no direction to cycle, and both files naming each other is normal rather than an error.

## Acceptance

- The convention gains `related` as an optional list of task slugs, deduped and preserved the way `depends_on` is, and omitted from the file when it holds nothing.
- Availability, archiving, ordering, and the dependency graph behave identically whether or not a task carries a `related` value.
- The field can be set, added to, removed from, and cleared from the CLI in one validated write, alongside the other metadata edits, so a rejected value leaves the task untouched.
- A related task is legible wherever it is shown: its title, its current column, and whether it is archived or unresolved — not a bare slug the reader has to look up.
- Both directions of an association are visible from either task on surfaces that load the whole project, and an association recorded on both files is shown once.
- The Board's editor preserves a target it cannot currently resolve. The archive is not loaded until the archive view opens, so an archived or unresolved slug must survive an unrelated edit rather than being silently dropped on save.
- A dangling or malformed value produces a warning naming the field and still returns the task.
- Every surface documenting the task schema and the dependency field describes `related` and states the line between the two: one orders work, the other only points at it.
- Projects scaffolded by `init` carry the field in their own conventions, so it is discoverable without reading this repository.
