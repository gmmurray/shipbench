---
title: >-
  Spike: make project reasoning and implementation reviewable through Git
  history
status: backlog
priority: medium
tags:
  - spike
  - product
  - git
  - history
  - agents
created: '2026-09-06T18:33:01.098Z'
updated: '2026-09-06T18:33:01.098Z'
---

The owner reports that agents already record explanations in tasks and later retrieve them to answer questions about past decisions. Investigate how ShipBench can make that project record easier to inspect over time and alongside the resulting work.

## Investigation

Explore task history and changes to a plan across a branch, release, or user-selected revision. Include description changes, recorded decisions, status changes, archive transitions, and decisions that were subsequently revised.

Evaluate a review experience connecting intended scope, task Updates, relevant artifacts or changes, and verification evidence. Explicit references could help; changes sharing a commit establish association, not proof that all of them implement the task.

Determine how to return precise task/revision/entry sources so an agent can separate the rationale recorded at the time from its own later interpretation. Preserve original evidence rather than replacing it with generated summaries. Use existing Git history where possible instead of maintaining another event database.

## Deliverables

- A small set of realistic review and "why did we do this?" scenarios with observed retrieval friction.
- Options for CLI and board surfaces, source references, task/artifact links, and handling revised decisions.
- A minimal useful increment with tradeoffs and any optional schema changes justified by a specific query.
- Examples spanning code and a non-code deliverable where practical.
- Clear separation of functionality supported by recorded data from judgments an agent or human must make.

Coordinate with [CLI search](make-cli-search-retrieve-recorded-decisions-with-useful-context.md), [the walkthrough](add-a-complete-project-resumption-and-agent-handoff-walkthrough.md), and [positioning](spike-establish-shipbench-s-distinctive-value-and-landing-page-promise.md).
