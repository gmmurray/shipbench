---
title: Show an unreadable Updates section in the Board
status: todo
priority: medium
tags:
  - board
depends_on:
  - >-
    quarantine-an-unreadable-updates-section-instead-of-folding-it-into-the-description
created: '2026-09-05T01:09:14.391Z'
updated: '2026-09-05T01:09:14.391Z'
---

A task whose `## Task Updates` section does not parse is invisible as a problem
in the Board and in Harbor. `boardStore` loads the `updates` warning into
`state.warnings`, but `DetailView` renders only `depends_on` warnings, so the
Updates panel reads "Task Updates 0" and nothing says why. Harbor inherits the
same rendering and is read-only, so it cannot even be repaired from there.

Once the broken section is quarantined onto its own `Task` field, the Board has
something honest to show: a real description in the description panel, and the
unreadable text preserved where the entries would be.

See [docs/audits/malformed-updates-recovery-spike.md](../../docs/audits/malformed-updates-recovery-spike.md)
§4 and §5 for the verified behavior, including the current dead end where the
description editor is prefilled with the broken section and then refuses to save
it — whether the text is unchanged or correctly repaired.

## Scope

- Render the `updates` warning in the Updates panel, filtered the way
  `depends_on` warnings already are in `DetailView`.
- Show the quarantined text where the entries would be, marked as unreadable
  rather than styled as content. Read-only: this is a display of what is in the
  file, not an editor.
- Confirm the description panel behaves normally again — a malformed task's
  description should be editable and saveable, because the marker is no longer
  in `body`.
- Harbor gets this for free through the published Board. Nothing Harbor-side is
  in scope here.

## Not in scope

Editing or repairing the section from the Board. The spike concluded the repair
belongs in the file; this task is about making sure someone knows to open it.
