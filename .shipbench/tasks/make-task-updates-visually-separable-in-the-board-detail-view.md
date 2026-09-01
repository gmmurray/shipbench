---
title: Make task updates visually separable in the board detail view
status: done
priority: medium
tags:
  - board
  - design
  - ui
created: '2026-09-01T22:46:09.857Z'
updated: '2026-09-01T23:10:28.268Z'
---

In the web board's detail view, a run of task updates reads as one continuous
column of text. There is nothing that says *this is where the previous update
ended and the next one began* — you have to notice a date and infer a boundary
from it.

The rendering is [`TaskUpdatesSection`](../../packages/board/src/ui/DetailView.tsx#L534)
and the reason is visible in the markup. Each entry is an `<li>` with a left
divider rule, `gap-4` between siblings, a `<time>` at `font-mono text-[12px]
text-sb-silver`, and the body below it. The entries share a continuous left rule,
so it separates the section from the page rather than the entries from each
other, and the only per-entry marker — the timestamp — sits at nearly the size
of the prose above it and in a color close enough to it that the eye doesn't
catch it as a header. On a task with several long updates, the boundary is
weaker than the paragraph breaks inside a single update, which is exactly
backwards: the strongest separator on screen should be between entries, not
inside one.

## Constraints

[docs/design-doctrine.md](../../docs/design-doctrine.md) is ground truth. Work
in existing tokens (`sb-divider`, `sb-iron`, `sb-silver`, `sb-frosted`,
`sb-surface2`) rather than introducing new values, and match the register the
rest of the detail view already uses — the section header's mono-uppercase
treatment is the vocabulary this view speaks.

Approach is open, but the fix has to make the boundary the dominant break, not
just a louder timestamp. Worth weighing: giving the timestamp a distinct role
(the section header's mono-uppercase-tracked treatment is one option) so it
reads as a header rather than as more prose; separating entries structurally
rather than only by spacing; and letting the body text carry the reading weight
so metadata recedes instead of competing.

Whatever the treatment, it has to hold in both a single-update task and a long
run of them, and it must not fight the hover-revealed edit/delete controls that
share the timestamp's row — the entry header is a flex row with a 36px minimum
height for those buttons.

## Scope

`TaskUpdatesSection` in the Board package. Not the detail view generally, not
the card, not the terminal board. The section's editing form and the empty state
are in scope only where the new treatment would otherwise leave them
inconsistent.

## Definition of done

- Scanning a task with several updates, the entry boundaries are the most
  obvious breaks in the section — clearer than the paragraph breaks inside any
  one entry.
- Holds for one update and for many, with and without markdown structure in the
  bodies.
- Edit and delete controls still work and still align with the entry header.
- `pnpm --filter @shipbench/board test` and `pnpm typecheck` pass; existing
  `DetailView`/`Board` tests are updated rather than worked around if the markup
  moves.
- **A patch changeset.** `@shipbench/board` is published and this is a visible
  behavior change, so it needs one — and per [.changeset/README.md](../../.changeset/README.md)
  the three packages are a fixed group, so the bump carries core and the CLI
  with it.

## Task Updates

### 2026-09-01T23:08:04.379Z
Implemented. The root cause was tighter than the description said: .sb-markdown body text is var(--sb-silver) and the timestamp was text-sb-silver — the exact same color, differing only by 2px and the font family. That is why the eye never caught it as a header.

Two changes in TaskUpdatesSection. Entries no longer share a continuous left border (adjacent identical left rules read as one unbroken line, so the rule separated the section from the page rather than entries from each other); each entry now carries a top hairline with symmetric 20px space above and below it, suppressed on the first via first:border-t-0 first:pt-0. And the timestamp became a machined chrome label — mono 11px, uppercase, tracking-[0.14em], text-sb-frosted — which inverts the hierarchy so metadata leads and prose recedes. Per the doctrine's Section header and Page header primitives, 11px mono uppercase is the established vocabulary for exactly this.

Also moved the add-form's separator from sb-divider to sb-iron. Now that entries are divided by horizontal rules, an identical rule above the form would have read as one more entry boundary; iron is the doctrine's structural border and divider is the content hairline, so the distinction is the one the doctrine already draws.

Uppercasing is the CSS utility, not toUpperCase() — the DOM text is unchanged, so accessible names and any getByText on a timestamp still match. No test asserted on the old classes; all queries go through roles and aria-labels, so nothing needed updating.

Verified in a real browser, not just jsdom: built the board bundle, ran the CLI board against this repo, and screenshotted this very task's updates section in both themes. The boundaries are now decisively the strongest break in the section. Contrast inverts correctly in light mode (frosted is #1b1a21 against silver #56545f).

660 root tests, 126 board tests, typecheck, and lint all pass. Patch changeset added; changeset:status confirms the fixed group takes core and the CLI to 0.1.2 alongside board.
