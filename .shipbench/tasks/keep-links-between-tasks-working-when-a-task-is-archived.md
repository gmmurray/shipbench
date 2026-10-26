---
title: Keep links between tasks working when a task is archived
status: backlog
priority: medium
tags:
  - core
  - cli
  - board
  - convention
  - archive
created: '2026-10-25T23:55:31.006Z'
updated: '2026-10-25T23:55:31.006Z'
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

## Constraints

- Archiving moves the file byte-for-byte, and core never rewrites another task's file as a side effect. That is why [let-tasks-reference-related-work-without-implying-a-dependency](let-tasks-reference-related-work-without-implying-a-dependency.md) only unions incoming edges on read. Rewriting links in other files on archive would break both rules.
- Slugs are never reused across live and archive, so `<slug>.md` identifies one task whichever directory it is in.

## Candidate directions

These can combine.

1. **Resolve on read.** When a body links to `<slug>.md` and that file is missing, the Board, and Harbor through `resolveRepoLink`, try `archive/<slug>.md` (or `../<slug>.md` from the archive) before giving up. No file changes. Plain Git viewers like GitHub still show the link as broken.
2. **Warn on archive.** `task archive` names the live tasks whose bodies link to the task being archived, the way it already guards live `depends_on` dependents. The person archiving gets the information without being blocked.
3. **Report it.** [expose-a-consistent-cli-project-validation-report](expose-a-consistent-cli-project-validation-report.md) lists task-to-task links that don't resolve, with the fix (the archived path) when one exists.
4. **Prefer `related` for references between tasks.** Once that field exists, a slug in frontmatter survives archiving because it is resolved against live tasks and the archive. Prose links stay for context but stop being the only record.

## Decide

Which of these to build, and whether the convention should recommend a link form that survives archiving. Fix this repo's ten broken links as part of the work, or decide they stay as a record of the problem.
