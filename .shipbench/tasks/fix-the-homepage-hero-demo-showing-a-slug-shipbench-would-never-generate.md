---
title: Fix the homepage hero demo showing a slug ShipBench would never generate
status: todo
priority: high
tags:
  - site
  - copy
  - bug
created: '2026-08-30T14:34:47.929Z'
updated: '2026-08-30T14:35:05.266Z'
---

The hero workspace preview is the first thing a visitor sees, and it demonstrates ShipBench producing a slug ShipBench cannot produce.

[`apps/site/src/components/HeroWorkspaceWindow.astro`](../../apps/site/src/components/HeroWorkspaceWindow.astro) shows a task file whose title is `Setup GitHub OAuth`, then refers to that task twice by a slug that does not match it:

- line 17 — `shipbench task move setup-github-auth --to=review`
- line 153 — the pane filename `setup-github-auth.md`

Core's own slugifier disagrees. Run against the built package:

```
slugify("Setup GitHub OAuth")  =>  setup-github-oauth
```

The demo drops the `o` from `oauth`. The docs get it right — [`convention-spec.md`](../../apps/site/src/content/docs/convention-spec.md) uses `setup-github-oauth` in its `task comment` example — so the homepage is the only surface carrying the wrong form.

**Why this is worth its own task rather than a passing fix.** Slug generation is not incidental; [AGENTS.md](../../AGENTS.md) names it as something core owns outright, with the reasoning that "all consumers should create tasks through core to get consistent slugs." The hero is the page's argument for that guarantee, and it is currently the counterexample. A reader who types the title and gets a different filename than the homepage showed them has been told the wrong thing about the one behaviour the panel is demonstrating.

## Scope

Correct both occurrences to `setup-github-oauth`. Check the rest of the component's sample data against the same standard while you are in there — the two panes are meant to depict one task, and the CLI pane's `task graph` output (`✔ 4 tasks, 0 dependency blocks`) should stay consistent with whatever the board pane shows.

## Definition of done

- Every slug shown anywhere in the hero is what `slugify` returns for the title displayed beside it.
- The homepage and `convention-spec.md` refer to the example task by the same slug.
