---
title: Settle the branding doctrine questions the homepage pass surfaced
status: done
priority: medium
tags:
  - docs
  - site
  - branding
created: '2026-08-30T14:34:48.082Z'
updated: '2026-09-01T23:00:45.715Z'
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

## 4. The problem statement is a theme, not a string

The doctrine governs two strings. In practice there is a third thing — the problem statement — appearing in at least three places, no two identical:

| Where | Text |
| --- | --- |
| `site.ts` `description` | "**Setting up** a tracker for every new project **costs more than it saves**, so most projects never get one." |
| `index.astro` hero subhead | "**Standing up** a tracker for every new project **costs more than it's worth**, so most projects never get one." |
| [`overview.md`](../../apps/site/src/content/docs/overview.md) | "**Setting up** a tracker for every new project **costs more than it saves**, so most projects never get one and…" |

**Do not promote it to a canonical string.** The variants exist because three surfaces have three different jobs — a search-result snippet, a subhead read after the `h1` has already made its claim, and the opening of a documentation page. One sentence cannot hold all three shapes, and forcing it to is what produced the drift.

**The phrasing needs replacing either way.** "Costs more than it saves" / "costs more than it's worth" reads as ad copy, for three reasons worth writing down because they generalize past this line:

- **Ledger vocabulary.** *Costs*, *worth*, *saves* assert a valuation. Everywhere else the site earns its claims by showing a mechanism; this line just announces a verdict.
- **The weak clause leads.** "Most projects never get one" is the strong half — an observation about behaviour, and checkable. Using it as support for the valuation inverts them.
- **No mechanism.** It never says *why* a tracker is too heavy. [`why.md`](../../apps/site/src/content/docs/why.md) does, and concretely: tools like Linear and Jira "are built to coordinate people, and coordination is most of what you pay for in setup cost and process surface."

The site already owns better phrasing than the line it keeps paraphrasing. `index.astro`'s own why-section has "overhead for a team you don't have," and `why.md` has the enumeration — "create the workspace, name the columns, invite yourself, wire up whatever integration lets your coding agent see any of it." Mine those before inventing a fourth variant.

**Watch for collision.** Any hero rewrite reaching for "built to coordinate people" or "a team you don't have" duplicates the why-section two scroll-lengths below it ([`index.astro:72`](../../apps/site/src/pages/index.astro)). If the hero takes that angle, the why-section needs a different one.

Directions per surface, rather than one string stretched across all three:

| Surface | Direction |
| --- | --- |
| Hero subhead | Consider cutting the problem clause entirely. The `h1` already asserts placement, and the why-section is the very next thing on the page. The subhead then reads: "ShipBench makes the repository itself the board — Markdown tasks, Git history, nothing to sign up for." |
| Hero subhead, if a clause stays | Give it the angle the why-section only mentions in passing — that you pay the setup again per project — so the two do not restate each other. |
| Meta description | Needs the shelf and the reason as one standalone pair, under 155 characters. For example: "Project trackers are built to coordinate people. ShipBench is built for one person with several repositories — tasks as Markdown, versioned in Git." (147) |
| `overview.md` | Keep the second half — the `TODO.md` that stopped reflecting reality is the good part. Replace only the valuation: "…so standing one up per repository is mostly ceremony for a team of one. The plan ends up in your head instead, or in a `TODO.md` that stopped reflecting reality a week ago." |

What the doctrine should record is the constraint, not the sentence: state the problem as a mechanism, never as a valuation, and keep ledger vocabulary out of it.

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
- The doctrine records the problem statement as a theme with a stated constraint (mechanism, not valuation) rather than as a fourth canonical string.
- No surface still states the problem in ledger vocabulary.

## Task Updates

### 2026-09-01T22:34:42.483Z
All four questions decided and recorded in AGENTS.md.

1. Meta description — the code was right. Dropped 'meta description' from the descriptor's slot list and added a rule saying the title carries the shelf and the description carries the reason, og:/twitter: included. site.ts's description keeps the reason.

2. Period — punctuation belongs to the context, not the string. Statement contexts keep it (OG headline, socialImageAlt, README top); standalone label contexts drop it (hero badge, footer colophon). Both forms are the tagline. No code change; all four surfaces already matched.

3. Casing — went the stricter way rather than the 'likely fine' way: the descriptor keeps its sentence case everywhere, including <title>. Re-casing is a variant even when no word changes, and 'Git-Native' diverged from the identical string on GitHub one click away. site.ts title is now 'ShipBench — Git-native project management for solo developers'. That also handles the length note: still 61 characters, but sentence case renders materially narrower than Title Case, which is what the ~60 mark is actually about.

4. Problem statement — recorded as a theme with four constraints (mechanism not valuation, no ledger vocabulary, lead with the checkable half, mine why.md and check neighbouring surfaces) rather than a third canonical string.

Copy changes: hero subhead dropped its problem clause entirely (the h1 already claims it and the why-section is the next thing on the page); meta description replaced with a 147-char mechanism-framed pair; overview.md and the root README both reworded off 'costs more than it saves'. README was outside the task's table but inside its definition of done.

Typecheck, astro check, and all 660 tests pass. No changeset: no published package changed.

### 2026-09-01T22:41:41.486Z
Unrelated finding, noticed by the owner while reviewing this work — recorded here rather than lost, but it is not part of this task and needs its own.

The site's canonical URLs carry a trailing slash (`output: 'static'` with Astro's default directory build format, and BaseLayout's `canonicalPath` normalizes to it deliberately), but nearly every internal link on the site is authored without one. So `/docs/why` serves a 307 to `/docs/why/` before the 200. Confirmed in the network panel: `why` → 307 (0.4 kB, 38 ms), then `why/` → 200 (12.0 kB, 66 ms); same shape for `convention-spec`.

Scale of it: roughly 11 bare internal hrefs across Header.astro, Footer.astro, index.astro, and docs/[...slug].astro, plus about 30 bare Markdown links across the docs content. The one deliberate exception is the `/docs` → `/docs/overview` entry in astro.config.mjs `redirects`, which is a real redirect and should stay.

Two things make it worth more than the raw milliseconds suggest:

- The requests in the screenshot are ClientRouter prefetches fired on link hover, not navigations. So the wasted round trip happens on hover across the whole site, for links the visitor may never click, and it is paid before the prefetch can warm anything.
- The site is internally inconsistent about it: the canonical tag and the sitemap both say `/path/` while every link says `/path`.

Fix is authoring-side — the hrefs need the trailing slash. Astro's `trailingSlash` option governs what the dev server and adapter accept; it does not rewrite links, so setting it alone would not remove the redirects. Worth pairing with something that keeps it from drifting back: a lint rule, or routing internal links through a helper.

### 2026-09-01T22:51:38.197Z
Resolved the trailing-slash finding rather than filing it, at the owner's direction.

Links: 30 Markdown links across the docs content and 11 hrefs in Header.astro, Footer.astro, index.astro, and docs/[...slug].astro now point at the canonical trailing-slash route. The one anchored link became /docs/convention-spec/#task-updates. astro.config.mjs's /docs redirect now targets /docs/overview/ so that route is one hop instead of two. Verified against a real build: every internal href in the built HTML carries the slash, and no asset path was touched.

Guard: apps/site/src/test/internal-links.test.ts scans the source tree and fails on the file that authored a bare route. It runs as a third vitest project (@shipbench/site:source, node environment) because it reads files rather than exercising logic or a DOM. Confirmed non-vacuous by reverting one literal href and one template-literal href and watching each fail by name — the template-literal case needed the scanner to flatten ${...} first, or /docs/${id} and /docs/${id}/ would both have read as /docs/ and passed.

Two things this turned up that were not visible from the network panel:

- theme.spec.ts's flash detector intercepted '**/docs/overview' and mutated the response to defer the theme bootstrap. That glob was matching the pre-redirect URL, and route.fetch() was quietly following the redirect for it. Once the spec navigated to the canonical URL the pattern stopped matching, the mutation stopped being applied, and the test correctly reported the detector as vacuous. Fixed the pattern. Worth noting because the test was only ever passing through a redirect it was not written to expect. The rest of the harness moved to canonical paths too, including search.spec.ts's DOCS_PAGE (whose waitForURL built '${DOCS_PAGE}/' and had to lose the concatenation).
- apps/site's vitest suite runs in neither CI workflow. Root 'pnpm test' only lists packages/core, packages/board, apps/cli, design-system, and brand-assets; e2e.yml runs Playwright. Adding 'apps/site' to the root projects list does not work — its Svelte project needs the svelte plugin and resolve.conditions ['browser'], and neither survives being referenced from the root config (11 files fail with lifecycle_function_unavailable). So ci.yml gets a separate 'Test (site)' step, and the root config carries a comment saying why the entry is absent. This also picks up the site's existing 42 tests, which were running nowhere in CI before.

Verified: 660 root tests, 78 site tests (36 of them new), 100 Playwright tests on a production build, lint, and typecheck all pass.
