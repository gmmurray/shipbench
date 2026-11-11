---
title: Keep links between tasks working when a task is archived
status: done
priority: medium
tags:
  - core
  - cli
  - board
  - convention
  - archive
created: '2026-10-25T23:55:31.006Z'
updated: '2026-11-11T00:10:19.405Z'
related:
  - let-tasks-reference-related-work-without-implying-a-dependency
  - expose-a-consistent-cli-project-validation-report
---

Task bodies link to each other with relative Markdown links such as `[the decision](some-task.md)`. `task archive` moves the file to `tasks/archive/` byte-for-byte and rewrites nothing, so any link across the live/archive line stops resolving: a live task linking to an archived one, and an archived task linking to a live one.

This repo just hit it. Archiving 52 done tasks on 2026-10-25 left 10 broken links. Six more done tasks were kept live only because open tasks link to them, which is the workaround this task should make unnecessary.

## Evidence

Live → archived (the target is now `archive/<slug>.md`):

- `find-the-nearest-board-above-the-current-directory` → `decide-whether-the-cli-finds-the-nearest-board-above-the-current-directory`. That link is the build's specification.
- `make-cli-search-retrieve-recorded-decisions-with-useful-context` → `make-task-descriptions-discoverable-through-board-search`
- `rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page` → `strengthen-and-correct-shipbench-s-public-explanation-across-the-site-and-docs-then-assess-next-steps`

Archived → live (the target is now `../<slug>.md`): seven links from five archived tasks, for example `rewrite-the-guide-docs-in-the-approved-voice` → `rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page`. These break whenever an archived task pointed at work that is still open, so keeping tasks live can't prevent them.

Also seen: `strengthen-shipbench-messaging-across-docs-and-public-pages-then-assess-next-steps` (archived) links to `spike-evaluate-whether-shipbench-helps-people-resume-real-projects`, which no longer exists anywhere. Deleting a task breaks links the same way.

### The Board doesn't follow bare task links even between live tasks

`classifyLink` in `packages/board/src/utils/links.ts` only treats a link as a link to another task when it is written `./<slug>.md` or `.shipbench/tasks/<slug>.md`. A bare `<slug>.md` resolves against the repo root, so it never matches. In the CLI board, which has no `resolveRepoLink`, it shows as plain text instead of opening the task. The comment above the base selection says adjacent files "are matched below by slug anyway", but no code does that.

This repo writes task links the bare way: 42 `](<slug>.md)` links in live task bodies on 2026-11-06, and none in the `./` form. So links between live tasks are already dead in the Board, before archiving comes into it.

## Constraints

- Archiving moves the file byte-for-byte, and core never rewrites another task's file as a side effect. That is why [let-tasks-reference-related-work-without-implying-a-dependency](let-tasks-reference-related-work-without-implying-a-dependency.md) only unions incoming edges on read. Rewriting links in other files on archive would break both rules.
- Slugs are never reused across live and archive, so `<slug>.md` identifies one task whichever directory it is in.

## Candidate directions

These can combine.

1. **Resolve on read.** First make the Board recognize a bare `<slug>.md` as a link to a task, as the comment in `links.ts` already claims it does. Then, when a body links to `<slug>.md` and that file is missing, the Board tries `archive/<slug>.md` (or `../<slug>.md` from the archive) before giving up. No file changes. Plain Git viewers like GitHub still show the link as broken.
2. **Warn on archive.** `task archive` names the live tasks whose bodies link to the task being archived, the way it already guards live `depends_on` dependents. The person archiving gets the information without being blocked.
3. **Report it.** [expose-a-consistent-cli-project-validation-report](expose-a-consistent-cli-project-validation-report.md) lists task-to-task links that don't resolve, with the fix (the archived path) when one exists. That task is still `todo`, so this direction waits for it.
4. **Prefer `related` for references between tasks.** The field now exists. A slug in frontmatter survives archiving because it is resolved against live tasks and the archive. Prose links stay for context but stop being the only record. This one needs no code, only a recommendation in the convention and the habit of using it.

## Decide

Which of these to build, and whether the convention should recommend a form for links between tasks: `related` in frontmatter, a bare `<slug>.md`, or `./<slug>.md`. Direction 1 (with the bare-link fix) and direction 2 look like the cheap, low-risk core. Direction 4 costs only a convention change. Fix this repo's ten broken links as part of the work, or decide they stay as a record of the problem.

## Task Updates

### 2026-11-07T21:05:16.918Z
Decided and built directions 1, 2 and 4. Direction 3 stays with expose-a-consistent-cli-project-validation-report, where core's new `taskLinkTargets` gives it the link parsing it needs.

- **Resolve on read (Board).** `classifyLink` reads a bare `<slug>.md` or `archive/<slug>.md` as a candidate task slug, and an archive path as a slug too. `Markdown.tsx` checks the slug against live tasks and `archivedSlugs`: a live task opens in place whichever directory the link names, and an archived one renders at `.shipbench/tasks/archive/<slug>.md` (a host URL through `resolveRepoLink`, or the plain path in the CLI board). The Board never renders archived bodies, so links from the archive back to live tasks don't arise there.
- **Warn on archive (CLI).** `task archive` and `task archive --done` print a stderr warning naming the live tasks whose description or Updates link to what was archived. The warning doesn't block, and it skips links between tasks archived in the same run, since siblings in `tasks/archive/` still resolve. Core exports `taskLinkTargets` and `tasksLinkingTo`. The Board's archive dialog doesn't warn yet, because that would need a fourth pure core subpath.
- **Convention.** The scaffolded AGENTS.md (and this repo's copy) asks for a linked task to be recorded in `related` or `depends_on` as well. The convention spec and the decision-trail guide say the same and describe the new behavior.

This repo's broken links stay as they are. The five live-to-archived links found on 2026-11-07 now resolve on the Board through the archive fallback. The links from archived tasks back to live ones are inside archived files, which the board contract keeps out of routine edits.
