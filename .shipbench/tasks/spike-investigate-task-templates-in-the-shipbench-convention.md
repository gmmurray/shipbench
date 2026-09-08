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
updated: '2026-09-08T22:34:56.625Z'
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
