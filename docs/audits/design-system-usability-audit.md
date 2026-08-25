# Design system usability audit

**Date:** 2026-07-18
**Task:** `audit-design-system-for-usability`
**Doctrine under test:** [docs/design-doctrine.md](../design-doctrine.md)
**Method:** objective contrast math on every token pair the doctrine actually
uses (computed via WCAG 2.x relative-luminance, not eyeballed), grounded against
the real implementation in Harbor's `src/styles/global.css` (Harbor was in this
monorepo when the audit ran; it now lives in its own repository),
`packages/board/src/styles.css`, and live components (`TaskCard`,
`PriorityMeter`, `MetadataInputs`, form controls). Task-walkthrough and heuristic
passes reason from that evidence.

> **Status (2026-08-09). All six findings are closed.** Read the body of this
> file as a dated snapshot of 2026-07-18, not as current state. The numbers in
> this header were re-measured on 2026-08-04 while writing the executable
> palette tests
> (`turn-palette-contrast-and-token-parity-into-executable-tests`) and again on
> 2026-08-09 closing out F3, F4, and the `accent-pressed` item
> (`close-out-the-remaining-design-system-audit-findings-type-floor-priority-meter-accent-pressed`).
> They are measured, not assumed.
>
> - **F1 · CRITICAL · RESOLVED.** `fix-structural-contrast-token` lightened the
>   border token. `iron` now measures **3.42 / 3.21 / 3.03** against
>   canvas / surface / surface2 in dark and **3.19 / 3.73 / 3.38** in light —
>   clearing WCAG 1.4.11's 3:1 on every ground in both themes, against the
>   1.19–1.35 recorded in §Pass 1. This is now guarded by
>   `tests/design-system/contrast.test.ts` rather than by anyone redoing the
>   math.
> - **F2 · HIGH · RESOLVED (doctrine amended).** The muted-machined semantic
>   layer was adopted. `danger` / `success` / `warning` exist in all three
>   palettes and are in use in all three surfaces, so the audit's
>   "grep confirms zero semantic color" evidence line no longer holds.
> - **F3 · MEDIUM · RESOLVED.** The floor is 11px and nothing in `apps/` or
>   `packages/` renders type below it. The sans/mono rule was re-checked: card
>   titles went sans in the doctrine refresh, and the four remaining mono titles
>   (Board archive rows, Harbor idea rows and links) plus two mono prose
>   paragraphs were converted. Mono is retained where the doctrine assigns it —
>   identifiers, values, machined uppercase labels, chrome navigation, toasts,
>   and empty-state labels.
> - **F4 · MEDIUM · RESOLVED — the meter reads as a gauge.** F4 was explicitly
>   "rides on F1", and F1's `iron` retune carried it. The dim track went
>   1.26:1 → **3.21:1 dark / 3.73:1 light** against `surface`, and filled-vs-dim
>   mark separation measures **4.80:1 / 4.62:1**. Re-read on 2026-08-09 by
>   rendering the component's markup against the real tokens at 1× in both
>   themes: the filled run is countable at real size and the text label carries
>   the exact value. No component change was needed; the measurement was the
>   whole fix. The numbers are now recorded on the doctrine's priority-meter
>   primitive so the next reader does not have to re-render it.
> - **F5 · MEDIUM · RESOLVED.** A full light theme shipped
>   (`add-a-light-theme-and-three-state-theme-toggle-to-shipbench-dev`), with
>   all four theme states implemented in the site, Harbor, and the Board.
> - **F6 · LOW · RESOLVED.** Focus is now `outline: 2px solid` the accent token
>   with a 2px offset in all three surfaces — exactly the 1px → 2px,
>   route-through-accent recommendation.
>
> One measurement this audit did not take, recorded here because it belongs with
> the others: `canvas` text on an **`accent-pressed`** fill is **3.56:1** in
> dark (light is 7.93:1). **Decided 2026-08-09: accepted as a documented
> caveat, not fixed.** Clearing 4.5:1 with `canvas` text needs a pressed value
> lighter than `accent` itself (4.82:1), which inverts the press affordance and
> collapses pressed into hover; flipping the label to `frosted` on press
> (4.62:1) buys the bar by changing text color mid-click. Nothing is conveyed
> only while pressed. The doctrine now states the caveat and the rule behind it
> ("pressed darkens in both themes"), and
> `tests/design-system/contrast.test.ts` pins the 3.56:1 alongside the
> accent-on-dark-`surface2` 4.26:1 case so neither can drift unnoticed.

---

## Verdict on the hypothesis

The owner's hypothesis (2026-07-16): the system may be "too cool" at the expense
of **readability and glanceability.**

**PARTIALLY CONFIRMED — and relocated.** The coolness does _not_ hurt where it
was suspected. Text contrast is strong (near-AAA), so the mono/machined type
treatment does not harm text legibility — that limb of the hypothesis is
**cleared with numbers.** The cost is real but lives in two specific places:

1. **Structural perceptibility.** The flat / no-shadow thesis delegates all
   structure to borders and fills, but the border (`iron`) and fill
   (`surface`/`surface2`) tokens sit at 1.07–1.35:1 against canvas — far below
   WCAG's 3:1 non-text minimum. The aesthetic asks borders to carry structure
   and the border token is too dark to do it.
2. **Categorical no-semantic-color.** Error, success, and destructive states are
   all monochrome (grep-confirmed: zero red/green/amber in the codebase), so
   danger and confirmation never register pre-attentively in a tool where an
   errant delete has cost.

Both are fixable while preserving the machined aesthetic: **#1 is a single-token
value change** (no aesthetic compromise — arguably crisper); **#2 is a
deliberate doctrine amendment.** The machined aesthetic survives the audit; two
specific numeric decisions inside it do not.

A larger framing emerged from the review and is captured under
[Strategic direction](#strategic-direction-theme--system) below: the current
doctrine reads as a **theme** (a palette + type pairing, like a VS Code color
theme) rather than a **design system** for a tool, because the visual layer
carries no semantic load — all meaning lives in text. The accepted direction is
to **promote the theme into a system**: keep the machined geometry spine, relax
two absolutisms (mono-for-everything, tiny tracked caps), and add the two
capabilities it lacks (semantic color roles, light/dark adaptivity).

---

## Pass 1 — Measurements (objective)

### Text contrast — WCAG 1.4.3 (needs 4.5:1 normal, 3:1 large)

| Text      | on canvas | on surface | on surface2 | Verdict            |
| --------- | --------- | ---------- | ----------- | ------------------ |
| `silver`  | 7.59:1    | 7.12:1     | 6.71:1      | ✅ AA; ~AAA        |
| `frosted` | 16.43:1   | 15.41:1    | 14.53:1     | ✅ AAA comfortably |

**Disconfirming evidence for the hypothesis.** Body text, labels, and titles all
pass. The aesthetic does not cost text contrast.

### Non-text / structural contrast — WCAG 1.4.11 (needs 3:1)

| Pair                            | Ratio      | Verdict |
| ------------------------------- | ---------- | ------- |
| `iron` border on canvas         | **1.35:1** | ❌      |
| `iron` border on surface        | **1.26:1** | ❌      |
| `iron` border on surface2       | **1.19:1** | ❌      |
| `ironlit` hover border on canvas | **1.83:1** | ❌      |
| `surface` fill vs canvas (card edge) | **1.07:1** | invisible |
| `surface2` fill vs canvas (input fill) | **1.13:1** | invisible |

A control (e.g. `.sb-form-control`: `surface2` fill + `iron` border) is
distinguished from the page by a combined signal of ~1.1–1.35:1. **The entire
structural layer sits at the perceptual floor.** This is the core measured
finding.

### Priority-meter contrast

Dim (`iron`) chevrons are **1.26:1 on surface** — effectively invisible. Filled
(`frosted`) are 15.41:1. The "N filled of 3" gauge metaphor does not land; the
empty track can't be seen.

### Focus outline

`silver` focus ring is 7.12–7.59:1 on the backgrounds — well over 3:1.
**Contrast is not the problem;** the 1px thickness is thin for the
"which control has focus" moment.

### Type-size inventory

Heavy reliance on **10–11px mono**, much of it uppercase with 0.12–0.2em
tracking: tag chips `text-[10px]`, priority label `text-[10px]`, metadata labels
`text-[10px] uppercase tracking-[0.14em]`, card slug `text-[11px]`, nav
`text-[11px] uppercase`. Card titles are `13px` mono. 10px mono + uppercase +
tracking sits under the common ~12px legibility floor, and the treatment reduces
small-size legibility further.

Grep confirmed **zero semantic color** anywhere in `**/*.{tsx,astro,css}` — the
no-semantic-color rule is fully honored in the implementation.

---

## Pass 2 — Task walkthroughs (grounded in the code)

- **Scan for highest-priority task.** Contrary to the audit brief's assumption,
  `PriorityMeter` renders the text value ("high"/"medium"/"low") beside the
  chevrons, so priority is chevron-count _plus_ a redundant text label — better
  than "chevron-count only." But the label is 10px and the empty track is
  invisible, so the meter reads as "N floating marks + tiny label," slower than
  a color-coded scan.
- **Find a task by title in a full column.** Mono titles at 13px are legible on
  contrast but mono is slower to scan in bulk than sans; the tax compounds with
  column length.
- **Distinguish error toast from success toast.** Impossible at a glance — both
  are `surface2` + identical 3-chevron mark + mono text. Differentiation
  requires reading the words.
- **Distinguish destructive from benign affordance.** Same problem; a "Delete"
  button is monochrome like any other. In a tool, this is a safety cost.
- **Spot the focused control.** Works (7:1 contrast) but the 1px outline is
  minimal.
- **Phone in bright ambient light.** Dark-only (`color-scheme: dark`, no light
  theme) is a real-world legibility risk against the product vision ("Harbor on
  a phone while agents work"). The blueprint grid itself (9% iron lines) is faint
  enough to be harmless — cleared.

---

## Pass 3 — Heuristic sweep

- **Match to conventions (approachability).** The system is _unfamiliar_ by
  design — mono everywhere, tiny uppercase tracked labels, no color = meaning.
  These read as "expert IDE tool," a dialect the user must learn. Familiarity is
  the largest lever on approachability and costs little identity if spent
  carefully.
- **Visibility of system status.** With no semantic channel, the system's state
  (this succeeded, this is dangerous, this needs attention) is only ever
  _stated_, never _shown_. This is the "theme, not system" tell.
- **Consistency.** Harbor and Board implement the same primitives from the same
  token source (`--sb-*` mirrors the doctrine) — good. The doctrine's own
  type rule ("sans is chrome, mono is content/code-shaped data") is
  _violated in practice_: card titles render in mono, and a task title isn't
  code. The rule is right; the implementation over-reached.

---

## Findings

Severity, evidence, doctrine rule, recommendation, and whether the fix lands
within the doctrine or amends it.

### F1 — Structural contrast fails systemically · **CRITICAL** · within doctrine

- **Evidence:** `iron` 1.19–1.35:1, `ironlit` 1.62–1.83:1, `surface`/`surface2`
  fills 1.07–1.13:1 vs canvas — all far under WCAG 1.4.11's 3:1.
- **Rule:** Palette (`iron` = borders/structure); Geometry ("depth by border and
  fill contrast alone", "no border thicker than 1px").
- **Recommendation:** lighten the border token — or split a dedicated `border`
  token from the decorative-divider color — to ≥3:1 on canvas (~`#4A5170`
  territory; tune against the palette). Preserves flat / 1px / no-shadow /
  monochrome entirely; makes the machined look crisper. Highest-leverage fix.

### F2 — No semantic color costs pre-attentive safety · **HIGH** · amends doctrine

- **Evidence:** grep confirms zero semantic color; error/success/destructive are
  visually identical (`surface2` + chevron mark + mono).
- **Rule:** Palette ("no semantic reds/greens"), and the "Not adopted" non-goals.
  The discipline is correct for status and priority; the question is a narrow
  exception for destructive/error/attention states.
- **Decision (accepted):** adopt a conventional muted-machined semantic layer —
  **danger / success / warning** — reserved strictly for meaning, never brand
  emphasis, status, or priority. `warning` is retained because ShipBench already
  has first-class warning states (unfinished `depends_on`, read-time validation
  warnings, uncategorized status). See
  [Strategic direction](#strategic-direction-theme--system).

### F3 — Type-size floor leans below comfort · **MEDIUM** · within doctrine

- **Evidence:** pervasive 10–11px mono, much uppercase + tracked; the doctrine's
  own sans/mono rule is violated by mono card titles.
- **Recommendation:** raise the small-text floor to 11–12px; make **sans carry
  titles and reading prose**, mono an _accent_ for data (IDs, slugs, commands,
  timestamps, tags); reconsider uppercase + tracking at ≤10px. No token/palette
  change.

### F4 — Priority meter reads as marks, not a gauge · **MEDIUM** · within doctrine

- **Evidence:** dim `iron` chevrons 1.26:1 — invisible track.
- **Recommendation:** rides on F1 (a lighter border/dim token gives a visible
  empty track); or make empty slots `silver`-dim. Doctrine already flags the
  meter "adopted, negotiable."

### F5 — Dark-only vs the phone-in-sunlight vision · **MEDIUM** · product

- **Evidence:** `color-scheme: dark` only; no light theme; product vision
  imagines phone use in ambient light.
- **Recommendation:** treat a light theme as a real backlog candidate. The
  Board already routes tokens through `--sb-*` variables ("the seam for future
  theming"), so it's architecturally anticipated.

### F6 — Focus outline adequate but thin · **LOW** · within doctrine

- **Evidence:** 7:1 contrast (fine), 1px + 2px offset (thin).
- **Recommendation:** 1px → 2px, and route through the new accent so focus is
  both branded and more visible. Rolls into the accent implementation.

---

## Strategic direction: theme → system

The audit surfaced a framing bigger than the individual findings, reviewed and
accepted with the project lead (2026-07-18):

**Why it feels like a theme, not a doctrine.** The doctrine spends its words on
hex values, geometry, type pairing, and iconography — the surface — and almost
none on hierarchy, state, semantics, feedback, or density. Meaning is carried
entirely by _text_. The visual layer does zero semantic work. That is the
definition of a theme (a VS Code color theme decides what things look like, not
what they mean or how they behave).

**The accepted move: promote the theme into a system.** Keep the machined
geometry spine (flat, no shadow, 1px, tight radii, blueprint grid — high
identity, low tax). Relax the two absolutisms that concentrate the "theme, not
tool" cost (mono-for-everything; tiny uppercase tracked caps). Add the two
capabilities a tool's system needs and this lacks: **semantic color roles** and
**light/dark adaptivity.** The mental model becomes "the machined look is _one
skin_ over a real system," not "the machined look _is_ the system."

### Decided design direction

- **Accent color — indigo `#6E79F2`** (the saturated/brightened sibling of
  `ironlit #3C4265`, so it looks native to the palette rather than bolted on;
  ties into the blueprint-grid metaphor as the "live trace"). Computed 4.82:1 on
  canvas — passes icon/text. Chosen from the blue → cyan → indigo band
  specifically because it is the one hue family conventional semantics never
  claim, so brand emphasis and meaning never collide.
- **Accent role split** — white (`frosted`) = _reading_ emphasis (primary/active
  text, the status mark, hover promotion; high-frequency); indigo accent =
  _doing_ emphasis (primary action, focus ring, active/selected state, live
  links, current indicators; **rare and high-signal by design**).
- **Primary button adopts the accent** — accent fill + `canvas` (dark) text.
  Computed: white text fails on every accent candidate (1.97–3.41:1); canvas
  text passes (≥4.82:1). This reuses the doctrine's existing "primary inverts the
  canvas" grammar unchanged.
- **Semantic layer — danger / success / warning**, muted/machined, walled off
  from the accent hue. `danger` = destructive/error/blocking; `success` =
  completed/confirmed; `warning` = attention/degraded-but-loaded (unfinished
  dependencies, validation warnings). First-draft mutes (tune during
  implementation): danger ~`#E5605F`, success ~`#57B37E`, warning ~`#E3A34A`.
- **Typography** — sans carries titles and reading prose; mono demoted to a data
  accent; small-text floor raised to 11–12px; uppercase+tracking reconsidered at
  the smallest sizes.
- **Light theme** — added as a first-class mode; dark stays the signature
  default.

**Companion visual:** a live "accent try-on" rendered in the ShipBench palette
(all candidates, contrast facts, semantic-collision checks, button-adoption
toggle) was produced during the review as a decision aid. It is an Artifact, not
a repo file.

### What a tool's design system adds (scope for the doctrine amendment)

Beyond the accent/semantic decisions, promoting theme → system means the doctrine
should gain: a **hierarchy ladder** (more than the current two text tiers — a
real type scale + emphasis levels), defined **interaction states**
(selected/active/disabled/loading/empty/error/validation), a **density &
spacing scale**, **feedback/motion semantics** (what the system does on
success/error/loading), and the **light/dark theming model**.

---

## Proposed follow-up task decomposition

Filed to the ShipBench backlog on 2026-07-18:

1. **`fix-structural-contrast-token`** (high) — retune `iron` / add a dedicated
   border token to ≥3:1 on canvas. Cascades to cards, inputs, dividers, priority
   track, tables. Independent of the larger doctrine rewrite; can ship first.
   (Addresses F1, F4.)
2. **`amend-design-doctrine-to-system`** (high) — the keystone spec task: rewrite
   the doctrine from theme → system. Captures the indigo accent + role split, the
   semantic layer, relaxed typography, the missing systemic layers (hierarchy,
   states, density, feedback), and the light/dark theming model. Gates
   implementation. (Addresses F2, F3, F6 + strategic direction.)
3. **`implement-doctrine-refresh-harbor-board`** (high) — apply the amended
   doctrine across Harbor and the Board: accent, semantic states, typography,
   focus. Depends on #1 and #2. (Addresses F2, F3, F6.)
4. **`spike-harbor-light-theme`** (medium) — light-mode palette derivation and
   viability, phone-in-sunlight field test. The `--sb-*` seam anticipates it.
   (Addresses F5.)
