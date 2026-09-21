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
updated: '2026-09-20T18:12:47.820Z'
---

Investigate a local client that queries registered repositories' actual working copies while each repository continues to own its tasks. Useful questions include what needs review, where work is available, what changed across projects, and where a related decision was previously recorded.

## Established before the spike starts

A design discussion narrowed this before any investigation ran. These are inputs, not questions to reopen.

**Addressing is already solved; naming is not.** `-C <path>` is an existing global CLI option, resolved in [processCli.ts](../../apps/cli/src/processCli.ts) before the subcommand runs, and every command roots its `FsAdapter` at the result. `shipbench -C ../backend task get setup-auth` works today. The open question is therefore not how a command reaches another repository, but how the caller learns the path.

**The option to beat is zero code.** A project's `.shipbench/AGENTS.md` can name its siblings by relative path and tell an agent to use `-C`. That covers the common two-repository case with nothing built. Any proposal has to beat that, not merely beat nothing.

**A registry does not grant access.** Where an agent's filesystem reach is restricted, a registered path is blocked exactly as a guessed one is — the lookup changes where the path came from, not the syscall. Registration solves discovery and naming only. Access can be relocated but not removed: out-of-process and local (an MCP server or daemon outside the restriction, handing back answers rather than reads), or out-of-process and remote (Harbor, which needs no local reach at all because it reads pushed state through the GitHub API). Do not argue for a registry on sandboxing grounds.

**Paths are machine-local; identity is not.** A relative sibling path committed into a repository is a machine-local claim stored in a machine-independent medium: it travels, and it may be false on arrival. It fails by being present and wrong, and its worst case is resolving to a real but different directory. A registry fails by being absent, which announces itself and is repaired in one command. The shape that follows is portable identity in Git, machine-local resolution outside it — the committed side names which project, the local side says where it is here. Neither layer can do the other's job. A repository with no remote has no portable identity and needs a locally declared fallback id, meaningful only on machines where it was declared.

**A registry would be ShipBench's first machine-global state.** Nothing in core or the CLI reads a home directory today; every path is rooted at a project. Core cannot hold it — it is headless and its adapter is rooted at one project, while a registry decides which root to pass. Nor can it live inside a repository without creating a privileged hub and breaking the symmetry that each `.shipbench/` is independent.

## Investigation

Compare a small project registry and cross-repository CLI queries with a broader local UI. Cover local private repositories and unpushed work without requiring a hosted account. Any index should be derived and rebuildable, not a second authoritative task store. The registry is the exception to that rule and the reason to keep the two apart: declarations are authoritative and precious, a cache is neither.

Work out repository identity, canonical checkout selection, duplicate worktrees, inaccessible projects, and source/freshness labels. Distinguish current local state from committed or remotely pushed state. Preserve independent use of each repository.

Settle where machine-global state lives, weighing one identical path on every platform against per-platform config directories, and account for dotfile syncing carrying a registry to a machine where its paths are wrong. Storing identity alongside path is what lets a dead entry still name which project is missing rather than resolving to nothing.

Examine retrieval of recorded reasoning across projects: results need a precise project/task source, and similarity must not imply that a decision applies in the new context.

## Shape to evaluate first

Offered as the leading candidate to argue with, not a commitment.

- Read-only across projects. Writing nowhere but the current repository removes locking, dirty working trees, and `layout.json` contention in one decision.
- Cross-project search is the only genuinely new capability; `-C` already covers single-project reads, so query is the first surface and a merged board is not. Differing columns and configs make a combined board a display-model problem, not a plumbing one.
- Freshness labels are not polish. A confident answer read from a stale checkout on a feature branch with uncommitted edits is wrong in a way an agent will relay without hedging.

## Deliverables

- Concrete user scenarios and a comparison with today's per-repository CLI and Harbor's documented remote role.
- Options and tradeoffs for project registration, querying, indexing, and presentation.
- A minimal proposed increment or a reason to defer, with prototype observations where useful.
- A clear boundary between local capabilities and Harbor; coordinate with [the Harbor-role spike](spike-define-harbor-s-contribution-to-choosing-and-resuming-projects.md). The working split is that Harbor answers what is on `main` across projects while a local client answers what is on disk right now.
- A decision on whether cross-board writes belong here, since [the cross-project reporting spike](spike-let-the-owner-s-agents-report-shipbench-issues-from-other-projects.md) asks whether its narrow case generalizes into this one.

Cross-repository task dependencies, automatic project discovery, and hosted synchronization are separate decisions, not assumed requirements. Cross-project references in task frontmatter are specifically out of scope: a committed reference that only resolves through an unversioned local registry would break the invariant that a repository's `.shipbench/` is self-contained.

## Task Updates

### 2026-09-20T18:12:47.820Z
Narrowed by a design discussion before any investigation ran. The starting point moved: -C already solves cross-repository addressing, so registration is about naming and identity rather than reach. Recorded the inputs that follow from that, ruled cross-project frontmatter references out of scope, and added a leading candidate shape to argue with. Still undecided whether to build any of it.
