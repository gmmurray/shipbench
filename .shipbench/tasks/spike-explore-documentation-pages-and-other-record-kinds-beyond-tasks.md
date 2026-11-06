---
title: 'Spike: explore documentation pages and other record kinds beyond tasks'
status: backlog
priority: medium
tags:
  - spike
  - product
  - convention
  - docs
created: '2026-10-29T22:47:14.195Z'
updated: '2026-10-29T22:47:14.195Z'
---

Explore whether ShipBench should grow from a task board into a project documentation tool, with documentation pages, plans, specs and possibly other kinds of record alongside tasks, and what structure would make each kind worth having. This is a spike. The deliverable is a recommendation recorded as a task update, plus whatever follow-ups it implies. Implementation is out of scope.

This task records the owner's ideas first, as they were stated, and the conclusions drawn from them second. Start a later look from the ideas, not the conclusions: the conclusions came from one conversation and may not hold.

## The owner's ideas

These came up in a conversation in `obelisk-novo-backend` on 2026-10-29. They are paraphrased closely and not yet evaluated.

**Where it started: an internal wiki in Obelisk.** The owner imagined internal documentation stored in Obelisk and visible in its admin frontend: notes on their other internal apps, and other dev knowledge. The catch was that the edit experience would have to be decent, and that it would have to justify itself over Obsidian.

**Obsidian fatigue.** Keeping everything in Obsidian means constantly organizing across unrelated parts of life: personal, personal dev, professional, relationships. It is almost easier to have something they built for their own workflow (or close to it) that lives in a place they go to only for that kind of work.

**ShipBench could grow the same way.** If ShipBench grows from a project board into a full project documentation tool, it could include tasks plus conventions for planning, wikis and documentation, specs, "and really anything." Wikis follow naturally from that path.

**Plans are being piloted, and the pilot is not the end state.** The owner is piloting plans, where tasks are phased and grouped visually, like sprint planning or roadmapping done the ShipBench way. The current pilot is a Markdown task. What the owner actually has in mind is a simple but real data model for plans. That would be more useful to them personally than Markdown, while Markdown is fine for agents. It could come with a UI built to make it easier to use, such as a custom render of the board.

**ShipBench and Obsidian differ on purpose.** ShipBench is about things attached to a project, which has its own benefits. Obsidian is, in the owner's words, a cloud tool: personal, reachable anywhere, attached to no project. That is intentional too. There are other considerations besides.

**Editor reuse.** If a great docs editor gets built for ShipBench, Obelisk could depend on it as a package or copy its components.

**Two objections the owner raised to the first analysis:**

- **Don't build on the inside-vs-on-top rule** from [the plans spike](spike-plans-as-a-reading-order-over-tasks-and-building-on-top-of-shipbench-vs-inside-it.md). That rule is untested, and reasoning from it limits what gets considered.
- **"It can all be Markdown" sells nothing.** Tasks were possible as Markdown before ShipBench existed. ShipBench is a light, opinionated convention on top of Markdown, plus tools that support it. Taken seriously, the "just Markdown" argument would leave ShipBench as an unstructured folder of Markdown files with no tasks at all.

## A first analysis, set aside

Recorded so it isn't repeated. The first pass reasoned from the plans spike's rule: anything spanning repositories belongs on top of ShipBench, and data stays in the repository. From that it concluded two things. First, ShipBench docs and an Obelisk wiki don't compete, because ShipBench is per-project by definition. Second, plans, outcomes and docs are one pattern: Markdown pages that link to tasks. The owner rejected the foundation (see above), and both conclusions fell with it.

## Conclusions drawn from the ideas

These are the starting position for this spike, open to challenge.

**ShipBench's value is the opinionated layer, so a new kind of record earns its place through structure.** Typed fields, validation, queries such as `--available`, a workflow, and tools and views built on them. Whether a kind is "Markdown underneath" doesn't decide anything.

**Kinds gain very different amounts from structure.**

- **Plans gain a lot.** Phases, ordered membership, per-step status and dates are a real data model, and a board view or roadmap can render them. A plan is not just a document that links to tasks.
- **Documentation pages gain little unless a structure is found for them.** Candidates:
  - **A page kind:** runbook, reference, decision, how-to.
  - **Typed links** to the tasks and code paths a page covers, with backlinks, so a task shows the docs that describe it.
  - **A `verified` marker plus the paths a page covers,** so a tool can flag a page whose covered code changed since it was last checked. Neither Obsidian nor an ordinary wiki does this, and drift is the main way dev documentation fails.

**What kinds share is machinery, not a shape.** Slugs and collision handling, links and backlinks, the Updates log, search, validation. If ShipBench supports several kinds, that machinery is what generalizes. Each kind's fields, views and verbs stay its own.

**ShipBench and a hosted tool such as Obelisk differ in where the data lives, not in what it's about.**

- **ShipBench is files in git.** Local-first and versioned with the code. Agents read the files directly, and nothing is hosted. Editing needs a checkout.
- **A hosted store is reachable and editable from any device,** behind auth. History and agent access have to be built.

Knowledge that spans repositories can live in ShipBench too, in a dedicated repository with its own `.shipbench/`.

**One option links the two: a hosted client of ShipBench files.** Obelisk would read and write `.shipbench/` files in the owner's repositories through the GitHub API, and render tasks, plans and docs across all of them in its admin. That gives one data model and one editor, built in ShipBench, with two hosts. This would be the owner's personal tool, not a hosted ShipBench service, so the product copy's "there is no hosted ShipBench service" still holds. It is the hosted counterpart of [the local workbench spike](spike-explore-a-local-workbench-across-shipbench-repositories.md), which deliberately leaves hosted synchronization as a separate decision. Whether Obelisk does this belongs to the Obelisk spike, not here. What matters here is that ShipBench's formats and packages wouldn't block it.

**The editor.** The board edits task bodies in a plain `textarea` today, and `@shipbench/board` is published as one app behind `BoardAPI`, not as components. That is current state, not a limit. If ShipBench grows docs, a good editor belongs here, published deliberately so another host can consume it. The costs are a coupled release cadence and fitting a host's visual language as well as the [design doctrine](../../docs/design-doctrine.md).

## Questions to answer

- **What structure would documentation pages actually use?** Test the candidates against a real corpus rather than in the abstract. `../obelisk-novo-backend/docs/` is a wiki written for humans and agents, and this repository has `docs/` too. Check which fields would have been filled in, and which drift a `verified` check would have caught.
- **Where do documentation pages live?** A new `.shipbench/docs/`, or a layer over a repository's existing `docs/` (frontmatter on pages already there)? Many repositories already have `docs/`. Taking it over and duplicating it both have costs.
- **How does a kind get defined?** Built-in kinds (tasks, plans, docs), or kinds a project declares in config? `config.json` already has a `schema.custom_fields` slot. Check whether it points towards per-kind schemas or is unrelated.
- **Can staleness be checked cheaply and honestly?** Whether a page records a date or a commit, how renames are handled, and how to avoid claiming a page is accurate when the check only shows that nothing it covers has changed. The product copy forbids claiming that task files can't drift from the code, and the same caution applies here.
- **How do plans and docs relate?** Both are being explored now. Settle whether they share anything beyond the machinery before building either.
- **What stays out?** "Really anything" is the owner's ceiling, not a requirement. Name the kinds that would not earn their place.

## Related

- [Spike: plans as a reading order over tasks, and building on top of ShipBench vs inside it](spike-plans-as-a-reading-order-over-tasks-and-building-on-top-of-shipbench-vs-inside-it.md). It holds the current plans pilot and the inside-vs-on-top rule this spike deliberately doesn't build on.
- [Spike: explore outcomes and deliverables above individual tasks](spike-explore-outcomes-and-deliverables-above-individual-tasks.md). It is another candidate kind of record.
- [Spike: explore a local workbench across ShipBench repositories](spike-explore-a-local-workbench-across-shipbench-repositories.md). It is the local, read-only side of viewing across repositories.
- `../obelisk-novo-backend/.shipbench/tasks/spike-decide-whether-obelisk-should-host-an-internal-wiki-and-how-it-relates-to-shipbench.md` is the Obelisk side of the same conversation. It owns whether Obelisk hosts a wiki or becomes a ShipBench client.

## Done when

A recommendation is recorded as a task update with its reasoning: which kinds beyond tasks are worth supporting, the minimal structure for each, and where it lives. Follow-up tasks exist for whatever it implies. "Tasks only, and documentation stays plain `docs/`" is a valid outcome.
