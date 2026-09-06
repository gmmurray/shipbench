---
title: 'Spike: evaluate whether ShipBench helps people resume real projects'
status: backlog
priority: medium
tags:
  - spike
  - product
  - research
  - onboarding
created: '2026-09-05T21:33:41.018Z'
updated: '2026-09-06T18:33:30.834Z'
---

The evaluation exercised the software and found a plausible benefit, but it did not establish whether people sustain the habit of maintaining useful task context. Investigate that with real project resumptions before treating it as validated or using it to justify a broader feature set.

## Existing dogfood evidence to investigate

The owner reports that agents already consult related tasks while picking up work and later answer questions about past decisions by finding explanations in tasks. Start with representative examples of that behavior. Distinguish this evidence of utility in the owner's workflow from evidence of adoption by other developers.

Add questions about the full capture-and-reuse cycle: which explanations get recorded naturally, whether later agents find the right source, whether the explanation remains applicable, and whether the human needs to reconstruct missing context. Include an example where the earlier decision was later revised, to see whether an agent mistakes an old rationale for the current one.

Assess the useful record left by ordinary work, rather than rewarding long task bodies or more frequent Updates. Compare accurate, source-supported answers with plausible reconstructions from code or chat history.

## Investigation

Prepare a small study for developers who intermittently return to their own projects. Compare with each person's existing habit rather than an artificially weak baseline.

Observe:
- what they reconstruct from chat history, code, or memory when returning;
- whether descriptions and Updates answer their questions;
- whether they can find relevant context and available work;
- what a fresh agent fails to discover or misunderstands;
- which task updates become burdensome or stop happening;
- whether they voluntarily continue using ShipBench or adopt it in another repository.

Separate single-checkout use from concurrent work and local use from expectations about several projects. Distinguish time-to-first-card from successful resumption and continued use.

## Deliverables and boundaries

- A practical protocol, participant criteria, observation checklist, and proposed success/failure signals, without false numerical precision.
- An internal rehearsal using an available real project, with limitations recorded.
- Findings from owner-arranged participants if available; otherwise an explicit account of the evidence still missing and the next observation needed.
- Concrete recommendations tied to observed behavior, including evidence against the continuity hypothesis.
- Keep recruitment and external outreach for the owner to arrange or authorize. Do not install analytics or contact people as an inferred part of this task.

The differentiation spike can use available evidence immediately; this longitudinal investigation must not block its initial brief. Later findings should be able to revise the positioning rather than merely confirm it.
