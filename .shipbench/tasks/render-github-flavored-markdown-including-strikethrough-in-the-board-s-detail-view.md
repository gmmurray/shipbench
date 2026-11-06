---
title: >-
  Render GitHub Flavored Markdown, including strikethrough, in the Board's
  detail view
status: backlog
priority: medium
tags:
  - board
created: '2026-10-29T19:17:59.020Z'
updated: '2026-10-29T19:17:59.020Z'
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
