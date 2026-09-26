---
title: 'Spike: investigate task templates in the ShipBench convention'
status: backlog
priority: medium
tags:
  - spike
  - convention
  - agents
  - product
  - templates
created: '2026-09-08T22:34:56.625Z'
updated: '2026-09-26T20:45:01.005Z'
---

## Question

Should ShipBench support task templates, and if so, what form of support would meaningfully improve task authoring and later use?

The owner raised templates as a possible way to keep agent-written tasks more consistent. Existing AGENTS.md guidance can already influence their structure. Investigate what additional value templates or other authoring aids could provide, including whether a convention or product feature is warranted at all.

## Context

In dogfooding, agents consult related tasks, record explanations during work, and later retrieve those explanations to answer why a decision was made. Better task authoring may strengthen that project record. This is a motivation to investigate, not evidence that templates are the right solution.

The owner liked the initial discussion but explicitly requested an open-ended spike: develop an independent recommendation that can be compared with the earlier response. The investigation may revise or reject the initial ideas.

## Possible lines of inquiry

Choose the questions and methods that best inform the recommendation; this is not an exhaustive checklist.

- Where do current tasks fall short for humans or agents, and what information would have made them more useful?
- How do templates compare with examples, AGENTS.md guidance, client assistance, or leaving the convention as it is?
- What degree of structure helps across different kinds and sizes of work? Consider useful consistency, authoring effort, boilerplate, and pressure to invent information that is not yet known.
- Does the need arise at task creation, during decisions and Updates, at review, or across several moments?
- If support is justified, where should it live in the convention and its clients, and what is the smallest useful scope consistent with repo-owned files and agent-independent operation?

Use concrete examples or a small comparison of approaches where helpful. Distinguish observed improvement from assumptions about future use.

## Earlier proposal to compare against

The preceding discussion favored optional repo-local Markdown templates, with change, bug, and spike as possible starters; brief AGENTS.md guidance on choosing and adapting them; and later CLI or Board support based on dogfood friction. It favored allowing unknowns and omitting irrelevant sections, keeping completed tasks self-contained, and capturing decisions through Updates when the reasoning actually exists.

It also questioned whether a creation shortcut that merely copies unanswered prompts helps agents, compared with letting them inspect a template and compose a completed task first.

These are candidate ideas, not requirements. The directory, format, template categories, enforcement level, client behavior, and implementation sequence are all open.

## Expected outcome

Record a recommendation with its supporting evidence, tradeoffs, and remaining uncertainties. Explain where it agrees with, changes, or rejects the earlier proposal, so the owner can compare the reasoning.

If a change is worthwhile, outline a useful next step and the decisions that remain before implementation. A recommendation to improve guidance only, defer support, or make no change is equally valid. This spike does not commit ShipBench to shipping a template feature.

## References

- [Current convention and product spec](../../docs/spec.md)
- [Dogfood agent guidance](../AGENTS.md)
- [Project resumption and agent handoff walkthrough task](add-a-complete-project-resumption-and-agent-handoff-walkthrough.md)

## Task Updates

### 2026-09-26T20:45:01.005Z
A discussion with the owner suggested a different route than the repo-local templates in the earlier proposal: **agent skills, tested by the owner across their own projects before anything is added to ShipBench.** This is a direction to test, not a conclusion.

**The problem, as observed.** When asked to create a spike, agents often look at recent spikes to copy their format. Looking at related tasks is good behaviour, but taking the format from whatever they happen to read means a bad shape can become the standard by chance. The board already shows this. Early titles were lowercase chores or symptoms ("cleanup typecheck warnings", "updating shipbench init with new versions", "Playwright webServer aborts: astro preview now daemonizes"). Later titles describe the outcome ("Stop the Updates parser from rejecting…"). An agent that samples the early tasks copies the early style.

**The proposed split between the project and the skill:**

- The project's `.shipbench/AGENTS.md` and `config.json` stay the only source for mechanics: columns, the review gate, CLI usage, worktree rules. A skill starts by reading them and never restates them. Restating them would drift, and many rules are board-specific. For example, this board sends spikes to `backlog`, but other boards may not have a backlog column.
- The skill owns what doesn't change between projects: judgment about what each kind of task needs (spike, bug, feature), with one written-out example per kind. Agents copy examples far more reliably than they follow rules. The examples should be chosen and edited from the best existing tasks, not taken from the whole board, or they would carry the same accidents.
- The skill should say where the format comes from: read related tasks for context, decisions and `depends_on`, and take structure only from the skill.

**Why test with the owner first.** Using the skills across the owner's own projects separates what is generic from what is the owner's taste before anything becomes a public example. It also produces the "observed improvement" evidence this spike asks for. It fits the spec's position that platform-specific agent tooling lives in this repository as reference files people copy, not in the `init` scaffold.

**The planned test:** user-invoked skills (`disable-model-invocation`, so agents never file tasks unprompted) installed at user level, covering spike and bug creation plus a wrap-up step. The wrap-up step covers the Update-vs-description rule, recording decisions, filing follow-ups instead of expanding scope, and handing off to review. Feature creation, spike closure and review checking come later.

**Tension to resolve.** This spike's questions ask for support that works without any particular agent. Skills are agent-specific, which works against that. Possible answers:

- Skills are the right layer for authoring guidance, and the convention needs nothing new.
- The examples the test settles on later move into the repo as templates or AGENTS.md guidance any agent can read, and skills become thin wrappers around them.
- Both, in that order.

The personal test should show which.

Related: [spike-let-the-owner-s-agents-report-shipbench-issues-from-other-projects](spike-let-the-owner-s-agents-report-shipbench-issues-from-other-projects.md). A user-level bug skill that works from any project and files the task on this board is a candidate for the "smallest form that works" that spike asks about.
