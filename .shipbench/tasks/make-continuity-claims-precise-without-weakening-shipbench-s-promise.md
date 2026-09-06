---
title: Make continuity claims precise without weakening ShipBench's promise
status: todo
priority: medium
tags:
  - docs
  - copy
  - product
created: '2026-09-05T21:33:40.171Z'
updated: '2026-09-06T18:33:34.322Z'
---

The evaluation found arguments that give file placement stronger guarantees than the system provides. The solo workflow says status cannot drift from code; the rationale says there is no chance the plan and repository have diverged, and describes todo lists as holding no state.

A checkbox holds state, and a user can commit an obsolete task description or an incorrect completion status alongside code. ShipBench's demonstrated advantage is shared structure, validation, queries, accessible context, and convenient joint updates. Its explanation should make those mechanisms compelling without promising automatic accuracy.

## Preserve the agentic documentation benefit

The owner reports that tasks already record agent explanations and later supply answers to questions about past decisions. Preserve and explain that concrete benefit while correcting overstatements about automatic accuracy. A strong claim can describe how work leaves a reusable account of its reasoning, with a visible capture-and-retrieval mechanism.

Do not let this accuracy pass preempt the positioning spike's investigation of a more agentic-first explanation. Distinguish a useful self-documenting workflow from a guarantee that every decision is captured or every recorded explanation remains current.

## Decisions before implementation

Distinguish:
- one storage location versus the correctness of the information stored there;
- history and portability versus keeping a plan maintained;
- independent repository plans versus visibility across projects;
- a recommended agent convention versus enforcement.

Identify the intended meaning of each affected passage before rewriting it. Preserve strong, concrete reasons to adopt the product; do not replace them with a page of qualifications.

## Acceptance

- Remove claims of guaranteed semantic accuracy and the inaccurate assertion that a checklist has no state.
- Explain the actual advantage through concrete mechanisms and user situations.
- Keep the root rationale, published why page, overview, README, and workflow explanations consistent where they make the affected claims.
- Follow the current branding rules and preserve the canonical tagline and descriptor.
- Coordinate with the positioning/landing-page work without turning this bounded accuracy correction into a second homepage rewrite.

Evidence starts in [why.md](../../docs/why.md) and [solo trunk workflow](../../apps/site/src/content/docs/solo-trunk-workflow.md).
