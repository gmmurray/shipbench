---
title: 'Spike: define Harbor''s contribution to choosing and resuming projects'
status: backlog
priority: medium
tags:
  - spike
  - harbor
  - product
  - research
created: '2026-09-05T21:33:41.892Z'
updated: '2026-09-05T21:33:41.892Z'
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
