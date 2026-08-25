---
title: Rewrite the public repo's docs surface for a standalone project
status: todo
priority: medium
tags:
  - docs
  - distribution
  - split
created: '2026-08-22T20:35:22.967Z'
updated: '2026-08-22T20:35:22.967Z'
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
