---
title: >-
  Render GitHub Flavored Markdown, including strikethrough, in the Board's
  detail view
status: done
priority: medium
tags:
  - board
created: '2026-10-29T19:17:59.020Z'
updated: '2026-11-24T00:06:08.993Z'
---

`~~text~~` renders literally in the Board's detail view. [Markdown.tsx](../../packages/board/src/ui/Markdown.tsx) passes task bodies to `react-markdown` with no remark plugins, so the board renders CommonMark only. GitHub renders the same file as GitHub Flavored Markdown (GFM), so a task can look different on the board than it does on GitHub.

The `Markdown` component renders both descriptions and Task Updates, so one change covers both.

## Scope decision

- **All of GFM via `remark-gfm`.** This adds strikethrough, tables, task-list items, bare-URL autolinks, and footnotes. The board would render what GitHub renders, which is the strongest reason to do it. Each construct then needs styling under `.sb-markdown`, tables most of all, because the detail pane is narrow and wide tables need horizontal scroll.
- **Strikethrough only**, with `micromark-extension-gfm-strikethrough` and `mdast-util-gfm-strikethrough` wired up as a small remark plugin. This is a smaller change, but the board still won't match GitHub.

My recommendation is all of GFM. Task-list checkboxes should render as read-only (`disabled`), as GitHub shows them outside an editor. Ticking one from the card would be a write path, and that is a separate feature.

## Acceptance

- `~~done~~` renders as `<del>` in descriptions and Updates, styled per the [design doctrine](../../docs/design-doctrine.md).
- If all of GFM: tables scroll horizontally instead of widening the pane, task lists render with disabled checkboxes, and bare URLs become external links through the existing `MarkdownLink` path, so they get the same `classifyLink` handling and sanitization.
- `Markdown.test.tsx` covers each new construct, and existing link behaviour is unchanged.
- A changeset for `@shipbench/board`.

## Task Updates

### 2026-11-23T23:57:42.483Z
Took the all-of-GFM option, as the owner chose. `remark-gfm` is wired into `Markdown`, so descriptions and Updates both get it.

- Tables sit in a `.sb-md-table` wrapper that scrolls sideways. The table keeps `w-full`, so columns wrap text first and scroll only when they can't shrink any further.
- Task-list checkboxes come out `disabled` from remark-gfm itself. They hang in the bullet gutter and use the same `accent-sb-silver` as the new-task dialog's checkbox, not the accent, because nothing on them can be clicked.
- `del` keeps the surrounding text colour and only adds the line-through, so struck text stays readable.
- Footnote ids get a per-instance `useId` prefix through `clobberPrefix`. Without it, a description and an Update that each use `[^1]` would share `fn-1` ids, and the Update's reference would jump to the description's note.
- Bare URLs reach `MarkdownLink` as ordinary links. The tests check they come out as external links in a new tab.

Not checked in a browser: the checkbox gutter alignment and the footnote divider. Tests, typecheck, lint, and the board build pass.
