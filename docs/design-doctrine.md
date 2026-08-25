# ShipBench Design Doctrine

Ground truth for ShipBench's visual language across every surface — Harbor, the Board UI, and anything that comes later. Every design-related task implements against _this file_, not against a mockup, and not against anything an LLM produces without checking here first.

Harbor and the Board both implement this doctrine today. New surfaces adopt it; nobody invents a parallel theme. (The doctrine grew up inside Harbor, so its examples lean on Harbor screens — the rules are product-wide regardless.)

## How to read this doc

- **Tokens, geometry rules, and code snippets in this file are canonical.** Copy them into the consuming codebase verbatim.
- **Example content in code snippets is ShipBench-accurate.** Task IDs are slugs, priorities are `low/medium/high`, columns match config defaults. If you're generating UI copy from these snippets, do not invent branch names, commit hashes, or column labels — read the actual project state.
- **This is a system, not a theme.** The machined look is one skin over a set of rules that do real work: hierarchy, state, and semantics are expressed in the visual layer, not left to the words. The aesthetic is load-bearing _and_ legible — when the two conflict, legibility wins and the fix stays inside the machined vocabulary.

## The aesthetic thesis

**Machined, not glossy.** Flat surfaces, 1px borders, tight geometry, no shadows, no blur, no soft glow. Depth and interaction are expressed as _color shift within the palette_, never as elevation.

**Restrained, not monochrome-absolutist.** The system is mostly neutral, and color is rationed into three disjoint lanes that never bleed into each other:

1. **Neutral** — chrome, structure, and text. Does the bulk of the work.
2. **Accent** (one hue, indigo) — _doing_ emphasis: the primary action, focus, active/selected state. Rare and high-signal.
3. **Semantic** (three hues: danger/success/warning) — _meaning_ only: destructive, confirmed, needs-attention.

The discipline is: **any given color says exactly one kind of thing.** Neutral never means "act here," the accent never means "danger," a semantic hue never decorates. This is what keeps the palette from sliding back into a consumer-app rainbow while still letting the visual layer carry meaning.

---

## Foundations

### Palette

Neutrals plus three structural tokens, two text tokens, one accent, three semantics.

**Dark is the reference column.** The light column is not an inversion — it is derived separately and contrast-checked against the same bars (see [Theming](#theming-light--dark)).

**Neutral grounds & structure**

| Token      | Dark      | Light     | Role                                                          |
| ---------- | --------- | --------- | ------------------------------------------------------------ |
| `canvas`   | `#18171C` | `#ECEDF2` | Page background. The base of everything.                     |
| `surface`  | `#1E1D24` | `#FFFFFF` | Raised surface (cards, panels, dialog bodies).               |
| `surface2` | `#232229` | `#F3F3F8` | Filled control (input, select trigger, toast).               |
| `divider`  | `#2A2F44` | `#DCDCE4` | **Decorative hairlines only** — section rules, faint grid. Sub-perceptual by design (1.35:1 dark / 1.17:1 light); never a control boundary. |
| `iron`     | `#626B91` | `#84838F` | **Structural border** — control boundaries, card/input edges. ≥3:1 on every ground (worst: 3.03 dark, 3.19 light). |
| `ironlit`  | `#747D9E` | `#6C6B7A` | Hover/active border. Derived from iron — lighter in dark, **darker** in light, since hover promotes contrast against the ground either way. |

**Text (neutral emphasis)**

| Token     | Dark      | Light     | Role                                            |
| --------- | --------- | --------- | ----------------------------------------------- |
| `silver`  | `#AAA7BA` | `#56545F` | Secondary text, labels, icon default.           |
| `frosted` | `#F7F5F7` | `#1B1A21` | Primary text, active mark, top of the type hierarchy. |

**Accent (doing emphasis — one hue, rationed)**

| Token            | Dark      | Light     | Role                                                 |
| ---------------- | --------- | --------- | ---------------------------------------------------- |
| `accent`         | `#6E79F2` | `#4B52C7` | Primary action, focus ring, active/selected, live links. Indigo — the saturated sibling of `ironlit`, so it reads native to the palette. |
| `accent-hover`   | `#8A93F5` | `#3E45B5` | Hover state. Lighter in dark, **darker** in light — hover promotes contrast, not brightness. |
| `accent-pressed` | `#5A63D6` | `#343B9E` | Pressed/active state.                                 |
| `accent-soft`    | `accent` @ 13% | `accent` @ 13% | Tint fill behind active/selected surfaces. Derive with `color-mix` from `accent` so it flips for free. |
| `accent-line`    | `accent` @ 40% | `accent` @ 40% | Under-links, faint accent borders.         |

Accent fills take `canvas`-colored text — white fails contrast on the dark accent, and `canvas` passes in both themes (4.82:1 dark, 5.39:1 light). Because `canvas` itself flips, this needs no per-theme rule: the existing "primary inverts the canvas" grammar carries over unchanged.

Two measured caveats, both pinned in `tests/design-system/contrast.test.ts` so they cannot drift unnoticed:

1. **`accent` as text on dark `surface2` — 4.26:1.** It clears 4.5:1 on `canvas` and `surface` in both themes. On a `surface2` ground in dark, use accent as a border, fill, or mark rather than as body-sized text. Light has no such gap (5.70:1).
2. **`canvas` text on an `accent-pressed` fill — 3.56:1 in dark** (light is fine at 7.93:1). This is a knowing non-conformance for one transient state, not a claim that it passes. It is accepted rather than fixed because every fix costs more than the miss: clearing 4.5:1 with `canvas` text requires a pressed value *lighter* than `accent` itself (which sits at 4.82:1), which inverts the press affordance and collapses pressed into hover; and flipping the label to `frosted` on press (4.62:1) buys the bar by making the text change color mid-click. Nothing is conveyed only while pressed — the label, position, and meaning are identical to the resting and hover states, which both clear the bar — and the state lasts only as long as the pointer is held.

**Semantic (meaning only — never brand, status, or priority)**

| Token     | Dark      | Light     | Means                                       |
| --------- | --------- | --------- | ------------------------------------------- |
| `danger`  | `#E5605F` | `#C4322F` | Destructive, error, blocking failure.       |
| `success` | `#57B37E` | `#2A7449` | Completed, confirmed, saved.                |
| `warning` | `#E3A34A` | `#8A5A00` | Attention / degraded-but-loaded — read-time validation warnings, uncategorized status, dangling `depends_on` references. |

All three clear 4.5:1 as text/icon on `canvas`, `surface`, and `surface2` in **both** themes (worst case 4.63 dark, 4.67 light). Muted on purpose — they read as machined signal, not traffic lights. Optional soft tints (12–13% of the hue) for filled badge/toast backgrounds; the hue's primary carriers are a left-border, a small mark, and the text.

**Palette rules**

- **Three lanes, no bleed.** Neutral = chrome/structure/text; accent = one hue for _doing_; semantic = three hues for _meaning_. No hue outside these tokens. Priority and status are **neutral** — they are not colored (see [Color roles](#color-roles)).
- **No shadow, no blur, no glow.** Depth and focus are border/fill shifts. This rule is absolute, including for dialogs, dropdowns, focus, and drag ghosts.
- **Interaction shifts color, never size.** Hover shifts a border `iron → ironlit` or a fill `surface → surface2`, or promotes text/icon `silver → frosted`. Accent hover goes `accent → accent-hover`. Never scales, never translates.

### Color roles

The lanes above define _which_ colors exist; this defines _who owns emphasis_.

- **White (`frosted`) = reading emphasis.** Primary and active text, the status/column mark, hover promotion of `silver → frosted`. High-frequency, everywhere. It is the top of the _type_ hierarchy.
- **Accent (`accent`) = doing emphasis.** Primary action, focus ring, active/selected state, live links, "current" indicators. **Rare by design** — sparse enough that its appearance _means_ "this is the thing to act on." It is the top of the _interaction_ hierarchy. If a screen is washed in accent, the design is wrong.
- **Semantics = meaning, not emphasis.** `danger`/`success`/`warning` appear only where the system is reporting an outcome or a risk. Never for decoration, never to make something "pop," never on status columns or priority.
- **Priority and status stay neutral.** We now have color, but priority is still expressed by the chevron meter (count + label) and status by the column marker square — both neutral. Coloring them would collide with the meaning lane and dilute the semantic signal. Glanceability for priority comes from the (now visible) meter track and the text label, not hue.

### Typography

Two families. The split is functional, and it changed with the theme→system refresh: **sans carries everything you read; mono is a data accent.**

- **IBM Plex Sans** — page headers, section titles, **task titles**, body and reading prose, buttons, nav labels.
- **Intel One Mono** — data and machined chrome only: task IDs/slugs, tag chips, form/metadata values, file paths, commands, timestamps, metadata keys, and the small uppercase eyebrow/section labels.

The rule of thumb: **if a human reads it as language, it's sans; if it's an identifier, a value, or a machined label, it's mono.** (This corrects the previous over-reach where task titles were mono — a title is language, not code.)

Weights available: 300, 400, 500, 600, 700 for both.

**Type scale.** Stay on it.

| Role                     | Size | Family / weight        | Notes                              |
| ------------------------ | ---- | ---------------------- | ---------------------------------- |
| Page / display title     | 28px | sans 600               | `text-wrap: balance`               |
| Section title (h2)       | 20px | sans 600               |                                    |
| Subsection (h3/h4)       | 16px | sans 600               |                                    |
| Body / reading           | 15px | sans 400, `leading-7`  | prose, descriptions                |
| Task card title          | 14px | sans 500               | was 13px mono — now sans           |
| Secondary / dense body   | 13px | sans 400               | dialog copy, hints                 |
| Caption / data value     | 12px | mono 400               | slugs, timestamps, metadata values |
| Micro label (eyebrow/nav)| 11px | mono 500, uppercase, `tracking-[0.12em]` | **11px is the floor** for uppercase+tracking |

**Small-text floor: 11px.** Nothing below 11px, and uppercase + wide tracking is reserved for 11px+ machined labels — never body, never at 10px. (The old 10px tag/label sizes are retired.)

**Emphasis ladder (neutral).** Three tiers, no new hue: `frosted` (primary) → `silver` (secondary) → `silver` at 60% opacity (tertiary / placeholder / disabled). Importance is a step on this ladder plus weight, not color.

### Geometry

- **Radii**: `none: 0`, `DEFAULT: 2px`, `sm: 2px`, `md: 3px`, `lg: 4px`. No larger radii exist.
- **Borders**: 1px. `iron` for control boundaries (perceptible), `ironlit` on hover/active, `divider` for decorative hairlines only. No border thicker than 1px.
- **No shadow tokens.** Depth is border and fill contrast alone.

### Focus

Machined outline, branded and 2px so it survives a fast keyboard scan:

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}
```

The focus ring is one of the accent's core jobs — focus is a _doing_ state.

### Spacing & density

4px base scale: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` (Tailwind's default spacing already matches). Use it; don't invent in-between values.

- **Card interior**: `12px` (`p-3`). **Panel interior**: `14–16px`.
- **Related controls**: `8px` gap. **Sibling cards / list rows**: `10–12px` gap. **Major sections**: `40px+`.
- Density target is _workbench_, not marketing: tight enough to see a full column, loose enough to tap on a phone. Interactive rows get a **≥36px** min height for touch.
- Lay groups out with flex/grid `gap`, not per-element margins.

### Interaction states

Every interactive element defines these; expression is fixed so states read consistently across Harbor and Board.

| State           | Expression                                                             |
| --------------- | --------------------------------------------------------------------- |
| Default         | `iron` border / `surface` or `surface2` fill / `silver` text          |
| Hover           | border `iron → ironlit`, or fill `surface → surface2`, or text `silver → frosted` |
| Focus-visible   | 2px `accent` outline, 2px offset                                      |
| Active/selected | `accent` border + `accent-soft` tint fill; accent "current" marker     |
| Pressed         | `accent-pressed` (accent controls) / fill darken (neutral controls)   |
| Disabled        | `opacity-40`, no distinct fill; `cursor: not-allowed`                  |
| Loading         | neutral skeleton block (`surface2`) or a 1px indeterminate bar in `accent`; **no spinner glow** |
| Empty           | centered mono label + one Radix glyph + the primary next-action        |
| Error/validation| `danger` text + 2px `danger` left-border or inline message; shake once on submit-fail |

### Motion & feedback

- Transitions: `0.15–0.18s ease` on color/opacity/transform. Nothing longer; nothing bouncy.
- **Always gate on `prefers-reduced-motion: reduce`** (kills all transitions/animations — see Global CSS).
- Feedback is semantic and quiet: a `success` toast on completion, a `danger` inline message on failure, a one-shot shake on invalid submit. No confetti, no progress theater.

### Iconography

One brand mark, two inline primitives, one icon library. Non-overlapping roles.

**The brand mark** — a ship under sail: three sails over a hull, `frosted` outer sails against a `silver` center sail and hull. It appears only in brand contexts (header, favicon, social image, empty states). Never redraw it inline in a component.

The source of truth for its paths is [docs/brand/logo-mark.svg](brand/logo-mark.svg) — see [docs/brand/README.md](brand/README.md). Nothing renders that file; it ships in **two forms, and which one you want depends on whether there is a page**:

| Form | Where | Why |
| ---- | ----- | --- |
| `#logo` symbol (`IconSymbols.astro`) | In-page brand slots | Transparent, fills routed through `silver`/`frosted`, so the mark **inverts with the theme**. Reference it with `<svg class="h-5 w-5"><use href="#logo" /></svg>` — works identically from Astro and React. |
| `public/logo.svg` | Favicon, social images, README embeds | Generated from the canonical mark with baked colors on a `canvas` tile. These render the file with no page attached, so there is nothing to inherit. |

An `<img src="/logo.svg">` is an isolated document: it inherits no custom properties and no `currentColor`. That is the whole reason for the split — using the file in-page is what produced a black badge sitting in the light theme. The standalone file and raster icon set are generated from `logo-mark.svg`; the in-page symbol mirrors that geometry with theme-token fills.

**20px is the floor.** The mark holds from 20px up; below that the sails merge and the two-tone separation is lost. Smaller slots take a Radix glyph.

> **Superseded 2026-08-10:** the mark was previously three chevrons in an offset/stepped arrangement, and the chevron primitive below was justified as "brand-adjacent" — a fragment of the logo. That rationale is retired with the stepped mark. The chevron keeps the jobs where its *shape* does the work and loses the ones where it was standing in for the brand.

**The chevron (`#chev`) is the pointing/gauge primitive** — a horizontal `>` shape, earning its place by what the shape means, not by resembling the logo:

- Breadcrumb separator
- Priority indicator (see Priority Meter below)
- Select-trigger and prev/next arrows
- Small pointing accents in chrome labels

Repeating the primitive is fine. Composing several into a stepped arrangement is not — that reads as the retired logo.

**The disclosure marker (`#disc`) is the fold/unfold primitive** — `+` closed, `−` open, hairline, never a rotating arrow:

- Sidebar group and folder headers
- Mobile nav and docs drawers
- Any other collapse/expand toggle

Sized for a **10px box** (`h-2.5 w-2.5`), where its 1px bars land on whole pixels. One symbol serves both states: the cross bar's fill reads `var(--sb-disc-cross, currentColor)`, so setting `--sb-disc-cross: transparent` on the `<svg>` or any ancestor turns `+` into `−`. Custom properties inherit into the `<use>` shadow tree; if that ever fails the fallback leaves a static `+` rather than a blank box.

The state change is instant — **no transition, no rotation.** The disclosed content appears and hides instantly, so an animated marker would be the only thing moving. This is also why the marker is not a rotating chevron: rotation implies a direction of travel, and a fold has no direction.

**Do not use a bare `+` as an "add" affordance anywhere a disclosure marker can appear.** Create actions take a labelled control (`new`, a Radix glyph with text) — a naked plus in the same surface as a folder header is ambiguous between "expand this" and "add one here."

**Radix Icons (`react-icons/rx`)** — the library for every _other_ icon need: semantic wayfinding (nav items, section markers), action affordances (settings gear, hamburger, close/exit), form controls, empty-state accompaniments, and **the mark inside a semantic state** (e.g. a check on a `success` toast, a cross on `danger`, an exclamation on `warning`). Line-based, monochrome, geometry-first — matches the doctrine's austerity. No other icon library.

Usage rules:

- Import per-icon from `react-icons/rx` (tree-shakes correctly): `import { RxDashboard } from 'react-icons/rx'`.
- Default size `h-3.5 w-3.5` (14px) inside nav rows and buttons; `h-4 w-4` for standalone toolbar actions. Never larger than `h-5 w-5` in chrome.
- Default color `text-silver`, promote to `text-frosted` on hover/active. A semantic-state glyph takes its semantic color (`text-danger` etc.) — that is the one place an icon is colored.
- No fills, no gradients, no secondary strokes. If the Radix glyph you need has multi-tone, pick a different glyph.
- Don't use a primitive and a Radix glyph for the same purpose — the primitives are structural, Radix is semantic labelling.

**When to reach for which** — fold/unfold → `#disc`. Pointing, separating, or measuring → `#chev`. Names a destination, action, or outcome → Radix.

### Theming (light / dark)

**Dark is the signature default.** The system is built dark-first and dark stays the identity. Light is a first-class second theme, not a fallback.

- Tokens are the theming seam. The Board routes every color through `--sb-*` custom properties; Harbor exposes them as Tailwind `@theme` tokens; the site uses plain custom properties. **Style through tokens, never hard-coded hex in components** — that is what makes a second theme possible without touching component code.
- The light palette is _not_ an inversion. It is derived separately and contrast-checked against the same bars as dark (4.5:1 text, ≥3:1 structural borders); both columns are in [Palette](#palette) above.

**Three states, one attribute.** The control is System / Light / Dark:

```css
:root { color-scheme: dark; /* dark token values */ }

/* System: follow the OS, but only when no explicit choice is stored. */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) { color-scheme: light; /* light values */ }
}

/* Explicit choices win over the OS in both directions. */
:root[data-theme="light"] { color-scheme: light; /* light values */ }
:root[data-theme="dark"]  { color-scheme: dark;  /* dark values  */ }
```

`:root:not([data-theme])` is load-bearing. Without it, an explicit **dark** choice on a light-OS machine loses to the media query. The `[data-theme="dark"]` block exists for the same reason — it is not redundant with `:root`.

**Applying it before first paint is a per-app concern.** The rule is the same everywhere — no flash of the wrong theme — but the mechanism depends on the rendering model:

- **Server-rendered (Harbor):** persist the choice in a cookie, read it in the layout, and render `data-theme` into the initial HTML. Nothing runs on the client before paint.
- **Statically built (the site):** there is no server to read a cookie, so a **blocking inline script in `<head>`** reads the stored choice and sets `data-theme` before the first paint. It must be inline and synchronous; a module script, an island, or an `astro:page-load` hook all run too late and flash.

Either way, if the app uses view transitions, re-apply the stored choice after a swap — the root element survives, but a full document replacement does not.

**Derivation rules that keep the two columns honest:**

- **Hover** moves *away* from the ground, not toward "lighter". `accent-hover` is lighter than `accent` in dark and darker in light; same for `ironlit`.
- **Pressed darkens in both themes.** Unlike hover, this is an absolute rule, not a ground-relative one — a press reads as depression, and depression is darker regardless of what it sits on. In light that happens to also move away from the ground; in dark it moves toward it, which is exactly where the `accent-pressed` contrast caveat above comes from. Do not "fix" that caveat by lightening the token: it would make pressed a weaker hover.
- Tints (`accent-soft`, semantic soft fills) derive from their hue with `color-mix` rather than being hardcoded rgba, so a hue change or a theme flip carries automatically.
- Text on an accent fill is `canvas`, which flips with the theme — so text-on-accent needs no per-theme rule.

### Global page background

Canvas gets a very faint blueprint grid (drawn in `divider`, sub-perceptual on purpose). Route both the ground and the grid line through tokens so the grid survives a theme flip — a hardcoded `rgba` here is the single most commonly missed theming hole, because it is a background-image rather than a color:

```css
body {
  background-color: var(--canvas);
  background-image:
    linear-gradient(to right, var(--grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

`--grid-line` is `divider` at ~9–12% — derive it with `color-mix` from `divider` rather than restating the rgba per theme.

---

## Tailwind config

Drop-in for `tailwind.config` (or Tailwind v4 CSS-first equivalent). Dark values shown; in a themed app map each to a CSS custom property (`canvas: 'var(--color-canvas)'`, …) so the theme blocks in [Theming](#theming-light--dark) can redefine them without touching utility classes:

```ts
{
  theme: {
    extend: {
      colors: {
        canvas:   '#18171C',
        surface:  '#1E1D24',
        surface2: '#232229',
        divider:  '#2A2F44',
        iron:     '#626B91',
        ironlit:  '#747D9E',
        silver:   '#AAA7BA',
        frosted:  '#F7F5F7',
        accent:          '#6E79F2',
        'accent-hover':  '#8A93F5',
        'accent-pressed':'#5A63D6',
        danger:   '#E5605F',
        success:  '#57B37E',
        warning:  '#E3A34A',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Intel One Mono"', '"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        none: '0px',
        DEFAULT: '2px',
        sm: '2px',
        md: '3px',
        lg: '4px',
      },
    },
  },
}
```

Font loading: fontsource packages. Harbor loads the families via Astro's [Fonts API](https://docs.astro.build/en/reference/font-provider-reference) (fontsource provider); the Board bundles `@fontsource/*` CSS directly in its standalone entry.

Global CSS (in the project's global stylesheet):

Written through tokens, not hex — these selectors are easy to forget when adding a theme, and hardcoding them is how scrollbars and selection end up stuck in the wrong palette:

```css
::selection {
  background: var(--divider);
  color: var(--frosted);
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: var(--canvas);
}
::-webkit-scrollbar-thumb {
  background: var(--divider);
  border-radius: 0;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--iron);
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  *,
  *::before,
  *::after {
    transition: none !important;
    animation: none !important;
  }
}
```

Both primitives as SVG symbols (declared once, referenced everywhere):

```html
<svg width="0" height="0" class="absolute" aria-hidden="true">
  <defs>
    <symbol id="chev" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M3 2.5 L15 12 L3 21.5 L8.6 21.5 L20.6 12 L8.6 2.5 Z"
      />
    </symbol>
    <symbol id="disc" viewBox="0 0 10 10">
      <path fill="currentColor" d="M1 4.5 h8 v1 h-8 Z" />
      <path fill="var(--sb-disc-cross, currentColor)" d="M4.5 1 h1 v8 h-1 Z" />
    </symbol>
  </defs>
</svg>

<!-- usage -->
<svg class="h-3 w-3 text-silver"><use href="#chev" /></svg>

<!-- disclosure: `+` closed … -->
<svg class="h-2.5 w-2.5 text-silver"><use href="#disc" /></svg>
<!-- … `−` open -->
<svg class="h-2.5 w-2.5 text-silver" style="--sb-disc-cross: transparent">
  <use href="#disc" />
</svg>
```

An embedded surface that cannot rely on the host page defining these (the Board) declares its own copy under a prefixed ID — see `packages/board/src/ui/Chevron.tsx`.

---

## Component primitives

### Buttons

Semantics before styling: primary is high-commitment (and now brand-colored), secondary is neutral, ghost is dismiss-like, danger is destructive.

```html
<!-- Primary — accent fill, canvas text (accent inverts the canvas) -->
<button
  class="rounded bg-accent px-4 py-2 text-[13px] font-semibold text-canvas transition-colors hover:bg-accent-hover active:bg-accent-pressed"
>
  Save
</button>

<!-- Secondary — bordered, transparent, mutates border on hover -->
<button
  class="rounded border border-iron bg-transparent px-4 py-2 text-[13px] font-medium text-frosted transition-colors hover:border-ironlit hover:bg-surface2"
>
  Cancel
</button>

<!-- Ghost — text only, hover promotes silver → frosted -->
<button
  class="rounded px-4 py-2 text-[13px] font-medium text-silver transition-colors hover:text-frosted"
>
  Dismiss
</button>

<!-- Danger — destructive, semantic. Bordered by default; solid only for the final confirm. -->
<button
  class="rounded border border-danger bg-transparent px-4 py-2 text-[13px] font-medium text-danger transition-colors hover:bg-danger/10"
>
  Delete task
</button>

<!-- Disabled — opacity, never a distinct fill -->
<button
  class="rounded bg-accent px-4 py-2 text-[13px] font-semibold text-canvas opacity-40"
  disabled
>
  Save
</button>
```

The primary and danger buttons are the two places color carries weight — one says "the main action," the other says "this destroys something." They must never be the same color, and nothing else on the screen competes with them.

### Card

The universal container. Bordered surface, border shifts `ironlit` on hover; `accent` when active/selected.

```html
<article
  class="rounded-md border border-iron bg-surface p-3 transition-colors hover:border-ironlit"
>
  <!-- content -->
</article>

<!-- active / selected -->
<article
  class="rounded-md border border-accent bg-surface p-3"
  style="background-image: linear-gradient(var(--accent-soft), var(--accent-soft));"
>
  <!-- content -->
</article>
```

### Tag chip

Small mono pill for tags, labels, meta. Bordered, no fill.

```html
<span
  class="rounded border border-iron px-1.5 py-0.5 font-mono text-[11px] text-silver"
  >tag-name</span
>
```

Filled variant (for values inside form controls / metadata sidebars):

```html
<span
  class="rounded border border-iron bg-surface2 px-2 py-1 font-mono text-[11px] text-silver"
  >tag-name</span
>
```

### Priority meter

One horizontal chevron per configured priority tier. Filled = at or below current; dim = above. **Neutral, never semantic** — priority is not a danger/warning axis.

- `high` → three frosted
- `medium` → two frosted, one iron
- `low` → one frosted, two iron

The empty track is `iron`, so the meter reads as a real gauge, not floating marks. The text label rides alongside for glanceability.

Verified by looking at it (2026-08-09), after the `iron` retune that F1/F4 of the [usability audit](audits/design-system-usability-audit.md) turned on: the dim track measures **3.21:1 dark / 3.73:1 light** against `surface` (was 1.26:1), and filled-vs-dim mark separation is **4.80:1 dark / 4.62:1 light**. At real size the filled run is countable in both themes. Keep both facts in mind before restyling: the track is carried by `iron`, so it moves whenever that token does.

```tsx
type Priority = "low" | "medium" | "high";
const level = { low: 1, medium: 2, high: 3 }[priority];

<span
  class="flex items-center gap-1.5 rounded border border-iron px-1.5 py-0.5"
  title={`Priority: ${priority}`}
>
  <span class="flex items-center gap-[1px]" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <svg class={`h-2.5 w-2.5 ${i < level ? "text-frosted" : "text-iron"}`}>
        <use href="#chev" />
      </svg>
    ))}
  </span>
  <span class="font-mono text-[11px] text-silver">{priority}</span>
</span>;
```

### Section header

Uppercase mono label + horizontal rule + numbered counter. Used for major sections on long/documenty pages (settings, manage-statuses, empty landings). The rule is a `divider` hairline.

```html
<div class="mb-10 flex items-baseline gap-3">
  <span class="font-mono text-[11px] uppercase tracking-[0.2em] text-silver"
    >Foundations</span
  >
  <span class="h-px flex-1 bg-divider"></span>
  <span class="font-mono text-[11px] text-silver">01</span>
</div>
```

Omit the number when there isn't a sequence.

### Page header (sticky)

Slim bordered top bar. Backdrop stays crisp (no blur). Structural bottom border is `iron`.

```html
<header
  class="sticky top-0 z-40 border-b border-iron bg-canvas/95 backdrop-blur-0"
>
  <div class="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
    <a href="/" class="flex items-center gap-2.5">
      <svg class="h-5 w-5" aria-hidden="true"><use href="#logo" /></svg>
      <span class="text-[15px] font-semibold tracking-tight text-frosted"
        >ShipBench Harbor</span
      >
    </a>
    <nav
      class="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-silver"
    >
      <a
        href="/ideas"
        class="rounded px-2.5 py-1.5 transition-colors hover:bg-surface hover:text-frosted"
        >Ideas</a
      >
      <a
        href="/projects"
        class="rounded px-2.5 py-1.5 transition-colors hover:bg-surface hover:text-frosted"
        >Projects</a
      >
    </nav>
  </div>
</header>
```

Nav labels stay mono uppercase — they're machined chrome labels, at the 11px floor.

### Toolbar (in-content, bordered)

Used above split-pane surfaces (task detail, board host) for breadcrumb + actions. Bottom border `iron`; the breadcrumb chevron separator is `divider`.

```html
<div
  class="flex items-center justify-between gap-3 border-b border-iron px-4 py-2.5"
>
  <div class="flex min-w-0 items-center gap-2 font-mono text-[12px]">
    <span class="text-silver">project-name</span>
    <svg class="h-2.5 w-2.5 shrink-0 text-divider"><use href="#chev" /></svg>
    <span class="truncate text-frosted">task-slug</span>
  </div>
  <div class="flex shrink-0 items-center gap-2">
    <!-- secondary + primary button -->
  </div>
</div>
```

### Form control — labeled select trigger

The default shape for status/priority/assignee pickers. Focus and active are accent.

```html
<div class="mb-4">
  <label
    class="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-silver"
    >Status</label
  >
  <button
    class="flex w-full items-center justify-between rounded border border-iron bg-surface2 px-3 py-2 text-left transition-colors hover:border-ironlit focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
  >
    <span class="flex items-center gap-2 text-[13px] text-frosted">
      <span class="h-2.5 w-2.5 bg-frosted" aria-hidden="true"></span> In
      Progress
    </span>
    <svg class="h-2.5 w-2.5 rotate-90 text-silver"><use href="#chev" /></svg>
  </button>
</div>
```

The column-marker square (`h-2.5 w-2.5 bg-frosted`) is the shared visual language for "status" across board columns, select triggers, and card headers. It stays neutral (`frosted`) — status is not colored.

### Metadata footer (list of small key/value)

For dates, IDs, source paths at the bottom of a detail sidebar. Top border `divider` (decorative).

```html
<div
  class="space-y-1.5 border-t border-divider pt-4 font-mono text-[11px] text-silver"
>
  <div class="flex justify-between">
    <span>created</span><span class="text-frosted">2026-07-06</span>
  </div>
  <div class="flex justify-between">
    <span>updated</span><span class="text-frosted">2h ago</span>
  </div>
  <div class="flex justify-between">
    <span>source</span><span class="text-frosted">tasks/task-slug.md</span>
  </div>
</div>
```

### Toast

Sonner is the mechanism; this is the visual shape. Bordered `surface2` fill, **a semantic left-border + a semantic Radix glyph** carry the outcome, mono content, single trailing action. This is where the no-semantic-color rule was retired: a success and an error must be distinguishable pre-attentively, before the words are read.

```html
<!-- success -->
<div
  class="inline-flex items-center gap-3 rounded-md border border-iron border-l-2 border-l-success bg-surface2 px-3.5 py-3"
>
  <RxCheck class="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
  <div class="min-w-0 flex-1">
    <p class="font-mono text-[13px] text-frosted">Task moved to review</p>
    <p class="font-mono text-[11px] text-silver">build-api · in-progress → review</p>
  </div>
  <button
    class="shrink-0 font-mono text-[12px] text-silver transition-colors hover:text-frosted"
  >
    Dismiss
  </button>
</div>
```

Swap `success → danger`/`warning` and the glyph (`RxCross2` / `RxExclamationTriangle`) for the other outcomes.

A neutral toast needs a glyph that reports *no* outcome, so it takes a **`silver` Radix glyph** — neutral color keeps it out of the meaning lane while staying in the same visual family as the three semantic states. `info` → `RxInfoCircled`; `loading` → `RxUpdate`, **static** (rotating it would be the only spinner in a system whose loading affordance is a bar).

Not the brand mark: it was previously three chevrons in `iron`/`silver`/`frosted`, an inline redraw of the retired stepped logo, and the ship that replaced it is too dense to read at 14px. Verified by looking at it (2026-08-10) — the mark holds from 20px up, and the sails merge below that. **20px is the floor for the brand mark**; anything smaller wants a Radix glyph.

Entrance/exit motion (respects reduced-motion):

```css
.toast-enter {
  transform: translateY(8px);
  opacity: 0;
}
.toast-shown {
  transform: translateY(0);
  opacity: 1;
  transition:
    transform 0.18s ease-out,
    opacity 0.18s ease-out;
}
.toast-leave {
  transform: translateY(8px);
  opacity: 0;
  transition:
    transform 0.18s ease-in,
    opacity 0.18s ease-in;
}
```

### Borderless editor

For task title/body inputs inside detail views. The field is flush with the canvas — no border, no fill, just a custom caret. The title is now **sans** (it's a title, not data); the body stays sans for reading.

```html
<input
  class="editor w-full bg-transparent font-sans text-xl font-semibold text-frosted placeholder-silver"
  aria-label="Task title"
/>

<textarea
  class="editor mt-4 h-72 w-full resize-none bg-transparent font-sans text-[15px] leading-7 text-silver placeholder-silver"
  aria-label="Task body"
  spellcheck="false"
></textarea>
```

```css
.editor {
  caret-color: #6e79f2;
}
.editor:focus {
  outline: none;
}
```

---

## Not adopted (explicit non-goals)

- **P1/P2/P3 priority labels.** ShipBench uses `low/medium/high` (configurable via `config.json`). Any UI showing priority must read from config, not invent tiers.
- **Task IDs like `HARBOR-18`.** ShipBench uses slugs derived from title. There are no numeric IDs.
- **Column names beyond user config.** Default columns are `todo / in-progress / done` and are user-configurable. Do not hardcode `Merged`, `In Review`, or any other names.
- **Branch names, commit hashes, git ops on cards.** Harbor is read-only against GitHub and does not surface branch/commit metadata on cards.
- **Filename extensions in metadata.** Tasks are `.md` with YAML frontmatter, not `.toml`.
- **Any glow, halo, drop shadow, or soft blur.** Even for focus, dialogs, dropdowns, or drag ghosts. The system is flat — this survived the theme→system refresh unchanged.
- **Color outside the three lanes.** No fourth accent, no decorative hues, no semantic color on priority/status/chrome. Color that means nothing is noise.
- **Semantic color as decoration.** `danger`/`success`/`warning` report outcomes and risk. They never "brighten up" a screen, mark a status column, or stand in for the accent.

> **Superseded 2026-07-18:** the former "no semantic color anywhere" rule is retired. The design-system usability audit ([docs/audits/design-system-usability-audit.md](audits/design-system-usability-audit.md)) found that a categorical ban cost pre-attentive safety for error/destructive states in a tool. Color is now admitted under strict lane discipline (neutral / accent / semantic) rather than banned outright — the machined restraint is preserved by _rationing_ color, not by refusing it.
