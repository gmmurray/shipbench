---
title: Stop the project-files spec describing core instead of the file format
status: todo
priority: medium
tags:
  - docs
  - site
  - convention
created: '2026-08-30T14:18:20.706Z'
updated: '2026-08-30T14:18:58.658Z'
---

A follow-on from `rewrite-the-terminal-board-reference-to-describe-the-tool-not-its-implementation`. That task fixes one section; this one is the result of sweeping the rest of the docs for the same family of problem.

**The sweep's main finding is that the problem is not systemic.** All twelve site pages and every `cli-reference` section were read. The result is one real defect, in one page, plus the same leak in two places outside the site.

## What is wrong

[`convention-spec.md`](../../apps/site/src/content/docs/convention-spec.md) is the specification for the `.shipbench/` file format. It opens by saying the files "stand on their own" and that the CLI, local board, Harbor, and coding agents are all *clients of the same project data*. Then it spends the rest of the page describing what one of those clients does:

- "**Core** slugifies titles to lowercase, hyphenated filenames. If a slug exists … **core** appends a numeric suffix."
- "On write, **core** rejects an unknown slug, a self-reference, and a direct two-task cycle."
- "**Core** never strips data it does not own."
- "**Core** stores arbitrary `{ timestamp, text }` entries and never judges their prose."
- "Any task can be archived, but **core** blocks a non-done task with live dependents unless the caller explicitly forces it."
- "`created` — ISO 8601 timestamp set once by **core**."
- "Board drag-and-drop and **core** mutations update it."

Seven sentences make `core` the actor. This is a different failure from the board section's: not too much mechanism, but **the wrong subject**. These are rules of the convention, and the page states them as behaviours of the TypeScript package that happens to implement it.

**Why this is more than a style problem.** [AGENTS.md](../../AGENTS.md) states the architectural invariant plainly: the project system "works without Harbor or any external service," and the adapter surface is "intentionally minimal to make future adapters (GitLab, Bitbucket) trivial." This page is the document someone reads to write a non-JavaScript client or to hand-edit a task file correctly. Phrasing the format's rules as "what core does" quietly makes `@shipbench/core` the *definition* of the format rather than one implementation of it. The page's own opening paragraph contradicts its body.

### Two internal API names have escaped into user-facing text

Worse than the voice, because these are unusable by the reader they are shown to:

- [`convention-spec.md:125`](../../apps/site/src/content/docs/convention-spec.md) — "Core returns parsed Updates as `Task.comments` and keeps them separate from `Task.body`." Those are TypeScript type members. A person hand-writing a Markdown file, or writing a client in another language, cannot act on them.
- [`recipe-gitignore-layout.md:44`](../../apps/site/src/content/docs/recipe-gitignore-layout.md) — "A code client can apply core's `orderedTasksForColumn` to the task files for the same result." This sits **inside the block the reader pastes into their own repository's `AGENTS.md`**, so it is shipped as an instruction to an agent that has no access to core's internals.

### The same leak ships into every ShipBench project

`orderedTasksForColumn` is not only in the docs. It is in the scaffold templates at `packages/core/src/init.ts:267` and `packages/core/src/init.ts:403`, which means `shipbench init` writes that function name into the `README.md` and `AGENTS.md` of every project anyone creates. This repo's own [`.shipbench/AGENTS.md:118`](../../.shipbench/AGENTS.md) carries it, which is how it surfaced.

Fixing only the site would leave the more widely distributed copy in place, so the scaffold is in scope even though the sweep that found this was a site pass.

## What the sweep found healthy

Recorded so nobody repeats this pass:

- **[why.md](../../apps/site/src/content/docs/why.md), [overview.md](../../apps/site/src/content/docs/overview.md), [quickstart.md](../../apps/site/src/content/docs/quickstart.md)** — consistently written from the reader's problem.
- **[workflows.md](../../apps/site/src/content/docs/workflows.md), [solo-trunk-workflow.md](../../apps/site/src/content/docs/solo-trunk-workflow.md), [concurrent-agents.md](../../apps/site/src/content/docs/concurrent-agents.md)** — decision-oriented, and explicit about when *not* to adopt something.
- **The three recipes** — the strongest writing on the site. Every one states what it does, when you would want it, and what it costs, including when to skip it.
- **[harbor.md](../../apps/site/src/content/docs/harbor.md)** — capability- and boundary-oriented throughout.
- **`cli-reference` apart from `board terminal`** — `init`, `connect`, `task create/move/comment/get/list/search/graph/archive/unarchive/delete` all describe what the command does for you.

One borderline case, deliberately left alone: quickstart's "ShipBench slugifies the title, avoids collisions across live and archived tasks, validates the metadata, and sets the `created` and `updated` timestamps." It lists internal behaviour, but it earns its place by telling the reader what they no longer have to do themselves.

## Scope

- Rewrite `convention-spec.md` so the format's rules are stated as rules of the format. Where a constraint really is implementation-specific rather than part of the convention, say which client and why — do not just delete the distinction.
- Remove `Task.comments` / `Task.body` from that page. Describe the separation between description and Updates in terms of the file.
- Remove `orderedTasksForColumn` from the pasteable block in `recipe-gitignore-layout.md` and from both scaffold templates in `packages/core/src/init.ts`. The CLI answer (`shipbench task list --json` and the ordering rules already written out) is what a reader can act on.
- Not a rewrite of the other eleven pages. The list above is the evidence they do not need one.

## Constraints

- This is a spec. It must stay precise — the goal is a change of subject, not a softening. Every rule that is true today must still be stated and still be exact.
- The strict-on-write / graceful-on-read model is a real property of the convention and must survive, without `core` as its subject.
- Changing the `init.ts` templates changes files that `shipbench init` writes. Check whether any test asserts on the scaffold text before editing.

## Definition of done

- `convention-spec.md` states the format's rules without making `core` their actor, and no longer contradicts its own opening paragraph.
- No internal API identifier appears in any user-facing docs page or in any pasteable block.
- `shipbench init` no longer scaffolds `orderedTasksForColumn` into a new project's `README.md` or `AGENTS.md`.
- This repository's `.shipbench/AGENTS.md` matches the corrected scaffold.
- Typecheck, lint, and the test suite pass — the `init.ts` edits are code, not prose.
