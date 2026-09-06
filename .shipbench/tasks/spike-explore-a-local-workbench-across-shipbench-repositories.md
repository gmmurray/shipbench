---
title: 'Spike: explore a local workbench across ShipBench repositories'
status: backlog
priority: medium
tags:
  - spike
  - product
  - cli
  - multi-repo
created: '2026-09-06T18:33:00.222Z'
updated: '2026-09-06T18:33:00.222Z'
---

Investigate a local client that queries registered repositories' actual working copies while each repository continues to own its tasks. Useful questions include what needs review, where work is available, what changed across projects, and where a related decision was previously recorded.

## Investigation

Compare a small project registry and cross-repository CLI queries with a broader local UI. Cover local private repositories and unpushed work without requiring a hosted account. Any index should be derived and rebuildable, not a second authoritative task store.

Work out repository identity, canonical checkout selection, duplicate worktrees, inaccessible projects, and source/freshness labels. Distinguish current local state from committed or remotely pushed state. Preserve independent use of each repository.

Examine retrieval of recorded reasoning across projects: results need a precise project/task source, and similarity must not imply that a decision applies in the new context.

## Deliverables

- Concrete user scenarios and a comparison with today's per-repository CLI and Harbor's documented remote role.
- Options and tradeoffs for project registration, querying, indexing, and presentation.
- A minimal proposed increment or a reason to defer, with prototype observations where useful.
- A clear boundary between local capabilities and Harbor; coordinate with [the Harbor-role spike](spike-define-harbor-s-contribution-to-choosing-and-resuming-projects.md).

Cross-repository task dependencies, automatic project discovery, and hosted synchronization are separate decisions, not assumed requirements.
