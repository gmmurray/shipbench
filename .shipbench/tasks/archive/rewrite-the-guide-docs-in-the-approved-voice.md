---
title: Rewrite the guide docs in the approved voice
status: done
priority: medium
tags:
  - docs
  - copy
depends_on:
  - rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page
created: '2026-09-24T23:00:52.457Z'
updated: '2026-09-25T04:26:26.958Z'
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

## Task Updates

### 2026-09-25T03:26:09.978Z
Done, ready for review.

**Approach.** These pages were already specific and mechanism-first, so I rewrote their prose in place instead of starting over. The concurrent-agents recovery steps are exact Git procedures, and rewriting them from nothing risked breaking one. Every command, config example, and block meant for agents is unchanged. What changed is the surrounding prose:

- lines that ended on a punchline ("Wanting a branch for its own sake is not.", "The fix is timing.", "This balance keeps structured tools safe…");
- phrases that announced intent ("narrow on purpose", "deliberately small", "genuinely fuzzy", "the trade being made");
- sentences built on "not X but Y".

**Pages:**

- **workflows** and **solo-trunk-workflow**: most of the prose reworked.
- **concurrent-agents**: about fifteen sentences.
- **recipe-review-gate**: two passages. The "`done` gets slower and truer" tradeoff is now "`done` lags behind the work".
- **recipe-worktree-rules**: one tradeoff.
- **harbor.md**: its closing line.
- **convention-spec**: the validation-model closing line and the Task Updates guidance paragraph.
- **recipe-gitignore-layout**: no change needed.

**New guide: `decision-trail.md` ("Tracing a Decision").** It covers linking related tasks, recording decisions as Updates, finding them with `task search --all`, and letting an agent follow the chain back. It includes a block to paste into the root AGENTS.md, because the scaffolded instructions don't mention linking tasks. Its limits section says nothing is automatic, that archiving a task breaks board links to it while search still finds it, and that board search matches titles only.

I checked every behaviour against the real CLI and the board design:

- searching a slug finds the tasks that link to it;
- `--all` finds Updates on archived tasks;
- the board opens links to live tasks in place.

The landing page's "Finding out why" card now links to this guide. The overview and convention-spec link to it too, and it's in the e2e page list. I added a note on `make-task-descriptions-discoverable-through-board-search` to update the guide's titles-only line when that task lands.

**Verification.** Typecheck, lint, 122 vitest tests, and Playwright (102 passed, 1 skipped as before) all pass. The docs-code-fences test caught the guide's commands marked `no-copy` without a placeholder, and they're copyable now. I reviewed the new page in the browser on desktop.

### 2026-09-25T04:26:26.958Z
Added owner attribution at the owner's request, since the why page and README are written in first person. The site footer now reads 'Built by Greg' and links to thedevelopergreg.com. That footer now appears on docs pages too, which had none, using a wider variant that matches the docs layout. The why page shows 'By Greg' in its meta line, switched on by a new optional byline frontmatter field. The README's first-person paragraph is signed. The name and URL live in SITE_CONFIG.author. built-output.spec checks that every page has the credit and only the why page has the byline. Typecheck, lint, 122 vitest tests, and Playwright (103 passed, 1 skipped) all pass.
