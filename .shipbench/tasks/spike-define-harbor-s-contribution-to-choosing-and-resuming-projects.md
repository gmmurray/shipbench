---
title: 'Spike: define Harbor''s contribution to choosing and resuming projects'
status: review
priority: medium
tags:
  - spike
  - harbor
  - product
  - research
created: '2026-09-05T21:33:41.892Z'
updated: '2026-10-26T00:28:21.356Z'
---

A plan inside every repository helps after a developer chooses a project. It does not by itself answer which project deserves attention. Investigate the distinct role ShipBench Harbor should play in that decision, and where continuity between ideas, repositories, and ongoing work matters.

The September 5 evaluation inspected only the public repository's documentation, not Harbor's private implementation. The site flag described Harbor as not yet deployed. Documented behavior is public-repository, read-only board access at the last pushed state; ideas live in Harbor, and promotion creates a linked project record without writing project files. Verify current facts before drawing implementation conclusions.

## Questions

- What concrete decisions should a person make in Harbor before opening a local repository?
- Is the intended value idea development, choosing among projects, observing pushed boards, or a particular combination? Which is useful within the existing permission model?
- How should the experience distinguish a recent fetch from recent underlying work, including uncommitted and unpushed changes?
- How do private projects affect the usefulness of the proposed view? Do not assume that broader permissions or private-repository support is the answer.
- Which pre-project decisions need to travel into the repository when an idea becomes work? Is a hosted source-idea link sufficient for a fresh local agent, or is some portable brief needed?
- Which expectations should the public site create about the local system and the optional hosted client?

## Deliverables

Produce a concise product brief with supported use cases, current boundaries, gaps that matter to those use cases, options with tradeoffs, and a recommended next decision. Separate confirmed behavior, documentation drift, and hypotheses.

Keep tasks in repositories and preserve Harbor's status as an optional client. This repository does not contain or deploy Harbor. Any implementation follow-ups belong in the appropriate repository after the product decision.

Start with [Harbor guide](../../apps/site/src/content/docs/harbor.md), [site flags](../../apps/site/src/config/flags.ts), [product spec](../../docs/spec.md), and [why.md](../../docs/why.md).

## Task Updates

### 2026-10-26T00:28:21.273Z
Outcome: Harbor is retired. It will not be deployed, and its surface comes out of this repository under [remove-shipbench-harbor-from-the-cli-packages-site-and-docs](remove-shipbench-harbor-from-the-cli-packages-site-and-docs.md). Harbor was never live, so no user loses anything.

**Choosing and resuming projects is already answered locally.** The owner uses [Radar](https://github.com/gmmurray/shipbench-radar) daily: registered repositories, each board read from its working copy, live updates, and a marker on projects that changed. That shows what is on disk now, uncommitted work included. Harbor could only show what was last pushed to a public repository's `main`. For deciding what deserves attention, the local view is the more accurate one.

**Freshness and private repositories.** Both questions favoured a local reader. Harbor's view was public-only and as stale as the last push. A local reader has neither problem, and widening Harbor's permissions was never the answer.

**Remote and mobile observation isn't worth a hosted service.** GitHub already renders `.shipbench/` on any device, and a Git-aware agent can summarize a board on request. Watching agents work from a phone was the one thing only Harbor offered. That loss is accepted.

**Ideas are still wanted, but not in a hosted database.** The leading candidate is a private ideas repository that is itself a ShipBench board: columns for idea statuses, tags, custom fields for tech stack, and links for related ideas. Promoting an idea would write a brief task into the new repository. That settles the question of a hosted source link versus a portable brief: the brief, because a fresh local agent can read it. Nothing is committed yet, and no task exists for it.

**Public expectations.** ShipBench is the convention, the CLI, and the local board. There is no hosted client. Radar is a personal tool, not a ShipBench product, so public copy should still describe no view across projects.

**Outside this repository (owner):** archive the private Harbor repository, and remove any Cloudflare, Clerk, and `harbor.shipbench.dev` DNS resources it created.
