---
title: 'Spike: keep scaffolded AGENTS.md and README current across ShipBench releases'
status: backlog
priority: medium
created: '2026-09-21T17:09:42.734Z'
updated: '2026-09-26T21:15:34.808Z'
tags:
  - spike
  - convention
  - agents
  - dx
---

## Question

When a project ran `shipbench init` several releases ago, how should its scaffolded `.shipbench/AGENTS.md` and `.shipbench/README.md` catch up with the ShipBench version it uses now, without losing what the project has written into them?

## Why it matters

An out-of-date README misleads a human, who can notice. An out-of-date AGENTS.md misleads an agent, which follows it: agents miss commands that exist (hand-editing a file where `task edit` would validate) and follow guidance that has since changed. The scaffold changes almost every release, because new CLI features are documented there. Every minor release since 0.1 touched the template, and [.changeset/README.md](../../.changeset/README.md) already requires a changeset for scaffold changes.

Nothing closes the gap today. `init` on an existing project is a byte-for-byte no-op, nothing records which version wrote the files, and nothing tells the user or an agent they are behind.

## What exists today

- `initProject` in `packages/core/src/init.ts` writes five files once: `config.json`, `layout.json`, `README.md`, `AGENTS.md`, and the welcome task. Only README and AGENTS can drift. `config.json` is deep-merged over `DEFAULT_CONFIG` on read, so new fields arrive by default, and the welcome task is meant to be deleted.
- `generateAgentsMd` is one template string. It interpolates the project name and bakes in the *default* statuses and priorities, so a fresh file's "Must be one of" line is already wrong once someone edits the `config.json` columns.
- The docs disagree about who owns the file. [workflows.md](../../apps/site/src/content/docs/workflows.md) says ShipBench owns `.shipbench/AGENTS.md` and project rules go in the root `AGENTS.md`, but also that conventions touching both may live in `.shipbench/AGENTS.md`. [spec.md](../../docs/spec.md) says both files "can be edited freely after generation."

## Evidence from this repository

This repo's own `.shipbench/AGENTS.md` is the first case. Compared with what the current build scaffolds (2026-09-26):

- **It is behind.** It lacks the `shipbench board terminal` operation and some newer template wording.
- **Its customizations are interleaved, not appended.** The backlog rule sits inside "Choosing What to Work On". "Complete a task" (move to `done`) became "Submit a task for review". The status list names this board's five columns, and the example tags changed. Two whole sections (Finishing Work, Working From a Git Worktree) and two Important bullets were added.

So even the project that builds ShipBench edits inside the scaffold, and regenerating over it would erase the review gate. Plain overwrite is ruled out for any file a project has edited. The owner sees the same pattern in other projects: some rules land in `.shipbench/AGENTS.md`, some in the root file, and a new release can make either one wrong.

## Prior art to check

This list comes from general knowledge. Confirm the current state of each during the spike.

- **Record the base, then three-way merge.** Copier stores the template version in `.copier-answers.yml`. `copier update` regenerates the old version, diffs it against the project's copy, and applies that difference to the new version. Cruft does the same for Cookiecutter through `.cruft.json`.
- **Replace untouched files, ask about edited ones.** dpkg compares a conffile against the checksum of what it shipped. An unedited file gets the new version; an edited one prompts, with the new version left beside it. `rails app:update` walks each changed file interactively.
- **Tool-owned regions in a user-owned file.** terraform-docs regenerates only between `<!-- BEGIN_TF_DOCS -->` and `<!-- END_TF_DOCS -->`, and Ansible's `blockinfile` works the same way. Everything outside the markers belongs to the user.
- **Migrations as code.** Angular's `ng update` runs per-version schematics that rewrite project files. Precise, but costly to write every release.
- **Agent instruction files.** AGENTS.md has no include or override mechanism, only nested files with nearest-wins discovery. Claude Code's `CLAUDE.md` supports `@path` imports, which is agent-specific. No standard is known for merging vendor-written and user-written agent instructions; confirm that before designing around its absence.

## Candidate directions

These combine. All of them need the first.

1. **Stamp the scaffold.** Write the generating version, and possibly a hash of the pristine text, into each scaffolded file (for example a first-line HTML comment). It is cheap and invisible in rendered Markdown, and it lets the CLI say "this AGENTS.md was written by 0.2.0; you are running 0.4.0." Existing projects have no stamp, so "no stamp" means "unknown, assume old."
2. **Print the current scaffold.** A read-only command writes the installed version's AGENTS.md or README to stdout, so a human or agent can diff it against the project's copy. No file writes, no merge logic.
3. **Agent-applied update** (the owner's idea in the Update below). Document a procedure: read the stamp, print the current scaffold, read the changelog entries since the stamped version, and carry the changes into the project's file while keeping its customizations. Scaffold changesets would need a consistent marker so the relevant entries can be found. This depends on agent judgment: without the old pristine text, the only way to tell a project's edit from stale base text is the changelog.
4. **Exact three-way merge.** Core keeps each published version's pristine templates (they're small, and they double as release snapshots), so the CLI can compute base → new, apply it to the project's copy, and write conflicts beside the file (`AGENTS.md.new`) rather than inline. This is the most machinery. Prose also merges badly, because each template line is often a whole paragraph.
5. **Ownership split with managed markers.** ShipBench owns a marked region and regenerates it freely. Project rules go outside the markers or in the root `AGENTS.md`. Refresh becomes simple, but the dogfood diff shows the catch: project rules often *contradict* base text ("move to `done`" against "never move to `done`"). Either the base text becomes config-aware (for example, the finishing rule is generated from whether a review column exists), or the file states that project rules override the base and agents reliably honour that.
6. **Thin file, CLI as the source.** `.shipbench/AGENTS.md` shrinks to a pointer plus project rules, and the CLI prints the mechanics on demand, so they always match the installed version. This conflicts with the convention being self-contained. Agents without the CLI, and Harbor's read-only view, need the file itself to explain direct file operations.

## Initial lean, to test rather than adopt

Start with 1 + 2 + 3: stamp, print, and a documented agent procedure. It is small and reversible, and it fits "agents are supported through convention, not infrastructure." Running it on this repo's stale file will show whether agent judgment is enough, or whether an exact base (4) or an ownership change (5) is needed.

Whether any command should *warn* about a stale stamp is a separate call. A warning on every command is noise, and one on `init` only reaches people who re-run it.

## Decisions for the owner

- Who owns `.shipbench/AGENTS.md`: ShipBench (regenerate freely, rules elsewhere), the project (edit freely, update by merge), or a split by markers? Bring spec.md and workflows.md in line with the answer.
- Is README.md in scope, or only AGENTS.md?
- Where the procedure in 3 lives: a docs page, a line in the scaffold itself ("if this file's stamp is older than `shipbench --version`, …"), or a reference skill like those in the templates spike.
- Whether staleness is surfaced proactively, and where.

## Expected outcome

A recommendation on the ownership model and the update mechanism, with tradeoffs, tested by bringing this repo's `.shipbench/AGENTS.md` current with the proposed procedure. If something is worth building, name the smallest next step as a follow-up task. "Document the manual procedure and change nothing else" is a valid conclusion.

Out of scope: `config.json` (already forward-compatible through defaults), the welcome task, and agent tooling that users copy from this repo. The templates spike covers that tooling, and it has the same drift problem.

## References

- [Scaffold templates](../../packages/core/src/init.ts)
- [File ownership and where recipes go](../../apps/site/src/content/docs/workflows.md)
- [Changeset rule for scaffold changes](../../.changeset/README.md)
- [Spec: scaffold generation and non-goals](../../docs/spec.md)
- [Task templates spike](spike-investigate-task-templates-in-the-shipbench-convention.md): the same drift question for skills users copy
- [Cross-project issue reporting spike](spike-let-the-owner-s-agents-report-shipbench-issues-from-other-projects.md): proposes a scaffold line of its own

## Task Updates

### 2026-09-26T21:07:58.174Z
it may be that we build a way for agents working with shipbench (outside of the shipbench project, but obv can still be dogfood) to know how to find the relevant changes and update the docs themselves. not sure if there is a programmatic way to do it otherwise, but still interested in potential industry standards for merging official+user edited AGENTS files
