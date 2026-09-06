---
title: Add a complete project-resumption and agent-handoff walkthrough
status: todo
priority: medium
tags:
  - docs
  - onboarding
  - agents
  - product
created: '2026-09-05T21:33:39.262Z'
updated: '2026-09-06T18:33:29.092Z'
---

The quickstart successfully gets a user to their first card. Add a reference workflow showing what recorded task context enables after an interruption: understand the state, recover the relevant decision, select available work, and hand it to a fresh agent.

This is a practical demonstration to evaluate and teach. Whether it should become the main landing-page narrative remains a question for the differentiation spike.

## Demonstrate rationale retrieval as well as resumption

Extend the example to include the owner's observed pattern: an agent uses related tasks as context, records a consequential explanation during work, and a later fresh session answers a human's "why did we do this?" question from that task.

Choose a question whose answer requires the recorded decision rather than simply inspecting the finished artifact or its status. Have the later answer identify its source and distinguish the recorded rationale from a new inference. Show a related task that matters for context without implying that every contextual relationship is a dependency.

Keep the durable facts in the description and time-dependent decisions in Updates according to the existing convention. Demonstrate useful capture as part of working the task, without requiring a separate transcript or a new mandatory reporting ceremony. Verify the retrieval path against current capabilities; the CLI already searches descriptions but currently excludes Updates.

## Decisions before implementation

Choose the smallest realistic project and a suitable documentation location: extend onboarding or add a linked walkthrough. Use one consistent task and its dependencies across the Markdown, CLI, and board views, so the reader can see the same context throughout.

Decide how the fresh agent is directed to the project's board instructions. Current init creates .shipbench/AGENTS.md, and automatic discovery varies by tool. Follow the existing root-instruction ownership boundary; do not assume permission to modify user instruction files or install platform integrations.

## Acceptance

- A reproducible example records a description, a dependency, and a decision whose reason would otherwise be lost between sessions.
- The returning human can identify what happened, what is still blocked, and what can start next.
- A genuinely fresh agent session can discover the instructions, shortlist tasks without loading every body, retrieve the chosen task, and explain the next action from repository context.
- The walkthrough makes the explicit discovery step visible and demonstrates the selected review/completion convention.
- Show an honest before/after benefit with commands and results from the real product. Do not simulate an interface or command that does not exist.
- Use a simple sequential workflow for the main example; link to concurrent work rather than making worktrees an onboarding prerequisite.
- If the exercise exposes missing product behavior, record bounded follow-up work rather than silently widening this task.

Start with [quickstart](../../apps/site/src/content/docs/quickstart.md), [workflows](../../apps/site/src/content/docs/workflows.md), and [the generated guidance](../../packages/core/src/init.ts).
