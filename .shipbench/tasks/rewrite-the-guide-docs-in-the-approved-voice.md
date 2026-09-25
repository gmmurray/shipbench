---
title: Rewrite the guide docs in the approved voice
status: todo
priority: medium
tags:
  - docs
  - copy
depends_on:
  - rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page
created: '2026-09-24T23:00:52.457Z'
updated: '2026-09-24T23:00:52.457Z'
---

Rewrite the guide docs using the voice approved in [rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page](rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page.md). Where these pages explain how ShipBench is used, use plain product voice. Commands, flags, and examples stay exact. Run every one that changes.

## Pages

- `workflows.md`, `solo-trunk-workflow.md`, `concurrent-agents.md`
- `recipe-review-gate.md`, `recipe-worktree-rules.md`, `recipe-gitignore-layout.md`
- `harbor.md` (it stays out of the build while `harborEnabled` is false, but its copy should be ready)
- the explanatory prose in `convention-spec.md`, not the format rules

## Also

The landing page's "Finding out why" card links to `/docs/convention-spec/#task-updates`, because no page shows the practice itself. Consider a short guide on linking tasks to each other and writing Task Updates so an agent can later follow the chain back to a decision. It should say plainly that this only finds what someone wrote. If the guide is written, point the card at it.

Use the banned-pattern list in the outline on the parent task. Strip rationale comments from any file this task touches.
