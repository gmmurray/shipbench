---
title: Make the landing page demonstrate ShipBench's distinctive value
status: todo
priority: high
tags:
  - site
  - copy
  - positioning
  - ux
depends_on:
  - spike-establish-shipbench-s-distinctive-value-and-landing-page-promise
created: '2026-09-05T21:33:42.781Z'
updated: '2026-09-06T18:33:27.406Z'
---

The owner feels the landing page is focused but still generic and undersells ShipBench. Use the differentiation spike's evidence and selected narrative to make the page give visitors a stronger reason to care, believe the promise, and try the product.

This task follows the positioning investigation. It must not infer that "return to a project" is already the selected headline or substitute a fresh wording pass for a decision about the value being communicated.

## Show how agentic work leaves a usable project record

The owner wants the page to convey how tasks accumulate explanations during ordinary agent-assisted work, and how later agents reuse those explanations. Include this as a major candidate in the selected narrative, rather than reducing agent support to the fact that an agent can read a Markdown file.

A suitable demonstration follows one decision through time: an agent consults a related task, records why it chose an approach, and a fresh session later answers "why did we do this?" by retrieving and citing that record. The benefit is useful recorded reasoning across sessions and tools. Use actual product behavior and make the capture step visible. Connect to the positioning spike's evidence and conclusions; the exact headline remains a decision to make.

## Decisions before implementation

Choose the narrative direction from the spike and record:
- the primary visitor and the situation they recognize;
- the promise the current product can keep;
- the reasons to choose ShipBench over their likely alternative;
- the evidence or demonstration that makes the promise credible;
- the next action that lets a visitor experience that benefit.

Decide which existing sections earn their space and how the page develops the argument without repeating it. Preserve the existing visual language unless a specific content need calls for a change.

## Acceptance

- The hero conveys a consequential user benefit with enough specificity to distinguish ShipBench from a generic task board.
- Supporting sections connect benefits to actual product behavior rather than listing interchangeable features or attacking simplified versions of competing tools.
- The demonstration follows a coherent scenario and shows consistent task state across the relevant real interfaces. It should help the visitor understand what using ShipBench changes.
- The call to action leads to a usable experience that supports the promise; connect to the resumption walkthrough if the chosen direction warrants it.
- Coordinate the page, search/social description, and immediate documentation entry points so the visitor encounters one argument adapted to each surface.
- Preserve the canonical tagline and descriptor, umbrella/client relationship, domain-neutral scope, and current Harbor availability boundary. Follow the mechanism-based copy rules in AGENTS.md.
- Review the final page in the browser at desktop and mobile sizes and complete the relevant site checks.
- Record what evidence motivated the selected direction and what remains a hypothesis for later observation.

Sources: [landing page](../../apps/site/src/pages/index.astro), [workspace preview](../../apps/site/src/components/HeroWorkspaceWindow.astro), [site metadata](../../apps/site/src/config/site.ts), [why.md](../../docs/why.md), and [branding rules](../../AGENTS.md).
