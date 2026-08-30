---
title: Settle the branding doctrine questions the homepage pass surfaced
status: todo
priority: medium
tags:
  - docs
  - site
  - branding
created: '2026-08-30T14:34:48.082Z'
updated: '2026-08-30T14:35:38.517Z'
---

A pass over the homepage — [`index.astro`](../../apps/site/src/pages/index.astro), [`HeroWorkspaceWindow.astro`](../../apps/site/src/components/HeroWorkspaceWindow.astro), [`config/site.ts`](../../apps/site/src/config/site.ts) — checking copy against the naming and branding doctrine in [AGENTS.md](../../AGENTS.md).

**The doctrine is being followed, and visibly so.** `site.ts` and [`scripts/og/cards.ts`](../../scripts/og/cards.ts) both carry comments citing the doctrine and reasoning from it; the OG card's comment explicitly works through why the tagline appears there and the descriptor deliberately does not. The umbrella-name rule, the product-name rule, and the domain rule are all clean on the homepage.

What the pass found is not violations. It is four questions the doctrine does not answer, which is why four surfaces have each answered them differently. Each needs a decision recorded in AGENTS.md; some also need a code change to match.

## 1. The doctrine is wrong about meta descriptions

The doctrine says to use the descriptor "where the job is search and categorization: `<title>`, **meta description**, the GitHub repository description, npm."

`site.ts` does not do that. Its `description` carries the *reason* ("Setting up a tracker for every new project costs more than it saves…"), and a comment there overrides the doctrine in as many words: "the description gets to carry the reason, which is what earns the click."

**The code is right and the doctrine is wrong.** A meta description is not a shelf label — it is the search-result snippet, and it is read by someone deciding whether to click. The `<title>` beside it already does the categorizing, which is exactly the split the doctrine is built on; the doctrine just assigned both halves to the same slot. `og:description` and `twitter:description` inherit the same string ([`BaseLayout.astro:54,64`](../../apps/site/src/layouts/BaseLayout.astro)), so this governs every social preview too.

Recommended: amend AGENTS.md to drop "meta description" from the descriptor's list and say plainly that the description carries the reason while the title carries the shelf. Leave `site.ts` alone.

## 2. Is the period part of the tagline?

The doctrine writes the tagline as **"Plans that ship with the work."** Four surfaces, two forms:

| Surface | Form |
| --- | --- |
| OG card headline (`cards.ts:29`) | with period |
| `socialImageAlt` (`site.ts`) | with period |
| Hero badge (`index.astro`) | **no period** |
| Footer (`Footer.astro:6`) | **no period** |

The split is not random — the two without periods are badge/chip contexts, where dropping terminal punctuation is normal typographic practice, and the two with periods are running statements. That is probably the right answer, but nothing records it, so the next person to add a surface will guess.

Decide, then state it: either the period is part of the string, or the string is punctuated by its context and badges drop it.

## 3. Does the descriptor keep its casing?

The doctrine gives the descriptor in sentence case: "Git-native project management for solo developers." Two surfaces disagree:

- `site.ts` `title` — **Title Case**: "ShipBench — Git-Native Project Management for Solo Developers"
- The GitHub repository description — sentence case, matching the doctrine

The doctrine says "don't invent variants" but never says whether casing counts as one. Title-casing a page title is an ordinary convention, so this is likely fine — but "Git-Native" is a visible re-styling of a string the doctrine calls canonical, and it currently differs from the same string one click away on GitHub.

## 4. There is a third canonical string, and the doctrine doesn't know about it

The doctrine governs two strings. In practice there is a third — the problem statement — and it appears in at least three places, no two identical:

| Where | Text |
| --- | --- |
| `site.ts` `description` | "**Setting up** a tracker for every new project **costs more than it saves**, so most projects never get one." |
| `index.astro` hero subhead | "**Standing up** a tracker for every new project **costs more than it's worth**, so most projects never get one." |
| [`overview.md`](../../apps/site/src/content/docs/overview.md) | "**Setting up** a tracker for every new project **costs more than it saves**, so most projects never get one and…" |

Two of the three agree; the homepage is the outlier. The variation buys nothing — these are not three different points, they are one sentence typed three times.

This is the most consequential of the four, because it is the line doing the most work on the site: it is the meta description, the hero subhead, and the opening of the docs. Either promote it to a third canonical string with a stated home, or decide it is a theme rather than a string and stop treating near-identical phrasings as a problem. What it should not be is unowned.

## Also worth fixing while here (not doctrine)

- `title` is **61 characters**; search results truncate around 60.
- `description` is **158 characters**, and the tail past 155 is `ry.` — so the last word can be cut mid-render.

Neither is a branding question; both are cheap.

## Scope

- Amend AGENTS.md's "Naming and branding" section with the four decisions.
- Apply whatever code changes those decisions imply. Item 1 implies none.
- Not a rewrite of the homepage. Its copy is sound: the "How It Works" facts are benefit-framed rather than mechanical, and the why-section carries the argument rather than the implementation. The implementation-voice problem that prompted this sweep is **not** present on the homepage.

## Definition of done

- AGENTS.md answers all four questions, including the correction to its own meta-description rule.
- Every tagline and descriptor instance on the site matches the decisions.
- The problem statement has one settled form, or a recorded decision that it does not need one.
