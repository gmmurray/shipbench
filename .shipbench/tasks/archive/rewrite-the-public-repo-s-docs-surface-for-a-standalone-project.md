---
title: Rewrite the public repo's docs surface for a standalone project
status: done
priority: medium
tags:
  - docs
  - distribution
  - split
created: '2026-08-22T20:35:22.967Z'
updated: '2026-08-29T15:45:57.106Z'
---

The copy that created this repo left it *building*. This one leaves it **legible to someone who has never seen the monorepo** — which is every visitor it will ever have.

Separated from the copy because the work is different in kind: that one was mechanical and verified by a green suite, this one is writing and has no test that can tell you it worked.

## What is wrong on arrival

- **[README.md](../../README.md) documents a repository layout that no longer exists.** Its "Repository layout" section shows `harbor/`; its content is otherwise strong and mostly survives. The quickstart, the why, and the "what's in the box" framing are all still true.
- **[AGENTS.md](../../AGENTS.md) is written for the monorepo** — the dependency graph, the dogfooding section, the Harbor architecture section, the `pnpm --filter` guidance. Roughly half applies; the Harbor half does not.
- **Harbor still needs describing, without living here.** Harbor is a real client of the convention and the branding doctrine requires it stay visible — but its source is private. The README already handles this well (it describes Harbor and links to `shipbench.dev/docs/harbor`), so the pattern exists; apply it consistently.

## Scope

- Rewrite the README's layout section; leave the argument and quickstart alone unless the split made them false.
- Rewrite `AGENTS.md` for this repo: three packages plus the site, no Harbor, dogfooding instructions that match this board.
- Fix or remove cross-boundary links. A link into a private repo is worse than no link.
- **Reconcile `docs/spec.md` with what a reader can actually see.** It carried over, but roughly half of it describes Harbor's data model, auth design, and caching — a codebase that is now private. Decide per section whether it stays as product documentation (Harbor is a real, describable product) or moves to Harbor's repo. The trap is leaving text that reads like an invitation to go look at code that isn't there.
- **Add the files a public repo is expected to have and the monorepo never needed:** contributing guidance (even if it is "issues welcome, PRs discussed first"), and an issues/discussions posture. A solo-maintainer project should say so plainly rather than implying a team.
- Decide whether the branding doctrine section of `AGENTS.md` is public-facing guidance or internal — it reads as internal, and it is the sharpest statement of the ShipBench/Harbor relationship anywhere.

## Constraints

- Branding doctrine holds: ShipBench is the umbrella, Harbor and the CLI are clients. This repo is the strongest place that relationship gets asserted, so it must not read as "ShipBench, and also some unrelated web app."
- Tagline vs. descriptor rules still apply — "Plans that ship with the work." for humans, "Git-native project management for solo developers." for the GitHub repo description and package metadata.
- The site is the deep documentation. The README points at `shipbench.dev`; it does not duplicate it.

## Definition of done

- A developer landing on this repo cold understands what ShipBench is, what the three packages are, how to run them, and where Harbor fits — without encountering a reference to a repo they cannot see.
- No unresolvable links.
- The GitHub repository description is set to the canonical descriptor.

## Task Updates

### 2026-08-29T15:43:56.167Z
Done 2026-08-29. Smaller than the task described in one place and larger in another.

**Smaller: the dogfooding section was not stale.** The task lists it as monorepo-era content needing a rewrite. It is accurate as written - node apps/cli/dist/index.js is still exactly right here, and the warning that both the workspace root and apps/cli are named 'shipbench' is still true. Left alone.

**Larger: two documents actively claimed @shipbench/board is not published to npm.** AGENTS.md and docs/spec.md both said 'internal monorepo package, not published to npm - consumed only by the CLI and Harbor.' That directly contradicts the readiness work and would have been visible on the repository the day the package appeared on the registry. Both now carry the published-for-convenience framing. Found by sweeping for references to things a reader cannot see rather than by reading the sections, which is why it survived earlier passes.

**AGENTS.md.** Harbor reframed throughout from a package in this repo to the reference external consumer: overview states plainly that Harbor's source is a separate private repository and nothing here builds it; the dependency graph drops the harbor arrow and gains the point that Harbor consuming core and board from npm is what makes the published contract real rather than theoretical; the Harbor section is retitled 'a consumer, not a package here'. 'Monorepo layout' -> 'Repository layout'. Package-names doctrine notes @shipbench/harbor is private and elsewhere.

Two things were wrong for reasons unrelated to Harbor: the OG script comment still said it rebuilds cards for 'site + Harbor' (the Harbor card was deleted during the copy), and the Playwright paragraph still said the harness 'is opt-in and never runs automatically' - which my own CI work made false the day before. Added a Continuous integration section covering all three workflows.

**The branding-doctrine question: keep it public, and say why.** It governs every ShipBench surface including ones not in this repo, and it is the clearest statement anywhere of how the pieces relate, so it belongs where anyone writing copy can find it. Added a line at the top of the section stating that, so it does not read as internal notes left in by accident.

**CONTRIBUTING.md, new.** Says plainly that one person maintains this. Issues welcome; pull requests want an issue first, and the reason given is honest rather than procedural - a lot of what looks like an oversight here is a recorded decision, and discovering that after building something is a bad trade. Cites live examples (dependencies as data not locks, the layout subpath import rule, no Turborepo). Carves out typo and broken-link fixes as not needing an issue. Covers the dev commands, what CI runs, changesets, and the settled non-goals.

**Link check, and a correction to my own method.** First pass reported 51 broken relative links. All 51 were false positives from a naive checker: apps/site content uses /docs/... route URLs resolved by Astro routing rather than the filesystem, and docs/audits uses repo-root-relative paths rather than file-relative ones. Rechecked resolving both ways and skipping site routes: **66 file links, 0 broken, 30 route URLs skipped.**

**Verification.** install --frozen-lockfile, typecheck, lint, 660 tests across 31 files, build - all exit 0.

**Left for the owner:** set the GitHub repository description to the canonical descriptor, 'Git-native project management for solo developers.' That is the last definition-of-done item and it is a settings-page action.
