---
title: 'Spike: establish ShipBench''s distinctive value and landing-page promise'
status: todo
priority: high
tags:
  - spike
  - product
  - positioning
  - site
created: '2026-09-05T21:33:20.357Z'
updated: '2026-09-06T19:40:33.150Z'
---

The September 5 product evaluation found a credible local system, but the feature inventory alone does not explain why someone should choose ShipBench. The owner feels the landing page is focused yet generic and undersells the project. Investigate the value deeply enough to make a stronger, more intriguing promise that the actual product can demonstrate.

## Project reasoning recorded during agentic work

The owner reports an existing dogfood pattern: agents consult related tasks when picking up work, explain decisions in tasks as they work, and later retrieve those explanations when asked why something was done. This is owner-observed behavior, not merely the evaluation's hypothesis about returning after an interruption.

Investigate this as a central positioning direction: the same tasks used to plan and execute work accumulate a readable, reusable account of why the project took its current shape. Examine the complete cycle of consulting earlier work, recording a decision, and answering a later question from a fresh session with a source.

Include a narrative direction that leads with this benefit for developers working through agents. Assess existing project-memory tools, decision records, and chat history as alternatives alongside task managers. Determine what ShipBench contributes to capturing, organizing, retrieving, and preserving that reasoning as agents change or improve.

Revisit the current rationale's choice to present agent access primarily as a consequence of file placement. The owner's new observation is reason to examine whether agentic work deserves a more central place in the explanation, while preserving the convention/client architecture and domain-neutral scope. Treat self-documenting as a concrete workflow to demonstrate, rather than a promise that installing ShipBench automatically produces complete or correct documentation.

## Questions to investigate

- Which situations make ShipBench materially useful, and for whom? Examine interruptions, several repositories, human/agent handoffs, parallel work, and writing or publishing projects. Treat these as hypotheses; do not assume that returning to a project is the winning position or redefine the audience before gathering evidence.
- What would those people otherwise use: an existing TODO.md habit, hosted issues or project tools, Backlog.md, Beads, or nothing? Compare actual workflows and adoption friction, not just feature checkboxes. Refresh claims against current primary sources and date the observations.
- Which advantages come from the category and which come from ShipBench's particular choices? Investigate the small file convention, user-owned process, optional clients, human-readable context, domain neutrality, and persistence across tools. A useful combination need not contain a globally unique feature.
- What becomes possible or easier once someone adopts it? Connect each promising benefit to a mechanism, a concrete user situation, and an observable demonstration.
- Where do current limitations qualify the promise: branch-local state, instruction discovery, search coverage, and the distinction between independent repo plans and cross-project visibility?

## Deliverables

Produce a positioning brief with:
- a comparison of the most relevant alternatives in a small set of realistic scenarios, with evidence and uncertainties distinguished;
- a recommended primary audience and job, reasons to choose ShipBench, and conditions where another approach is sufficient;
- two or three distinct landing-page narrative directions, each with a candidate hero message, supporting benefits, proof or demo concept, and its tradeoffs;
- a recommendation explaining which direction is strongest and what remains a hypothesis requiring user observation.

Success means answering why a visitor should care and believe the page, beyond learning where task files are stored. More intriguing should mean more specific and consequential, not inflated claims.

## Boundaries and references

Read [why.md](../../docs/why.md), [the current landing page](../../apps/site/src/pages/index.astro), [the workspace preview](../../apps/site/src/components/HeroWorkspaceWindow.astro), and [the naming and branding rules](../../AGENTS.md). Preserve the canonical tagline and descriptor and the ShipBench/client relationship. This is a positioning investigation, distinct from the completed branding-doctrine cleanup.

Research leads from the evaluation: [Backlog.md](https://github.com/MrLesk/Backlog.md) and [Beads](https://github.com/gastownhall/beads). Their descriptions are starting points, not a completed competitive analysis. Select and record a narrative direction before the dependent landing-page implementation.

## Task Updates

### 2026-09-06T18:33:35.159Z
The owner highlighted an existing agentic workflow: agents consult related tasks, record explanations during work, and later retrieve those explanations to answer why a decision was made. Expanded this spike and the related landing-page, walkthrough, research, search, and claims tickets to investigate and demonstrate that self-documenting value. Added CLI retrieval and maintenance tasks plus future spikes for a local workbench, Git history and review, and outcomes. Treat this as observed dogfood evidence and a central positioning direction; broader adoption remains to be investigated.
