---
title: Add a complete project-resumption and agent-handoff walkthrough
status: done
priority: high
tags:
  - docs
  - onboarding
  - agents
  - product
created: '2026-09-05T21:33:39.262Z'
updated: '2026-09-27T19:21:54.664Z'
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

## Task Updates

### 2026-09-27T19:09:31.866Z
Added [Resuming a Project](../../apps/site/src/content/docs/resuming-a-project.md) as a linked walkthrough in Getting Started, after the quickstart. The overview's reading order and the quickstart's closing paragraph link to it. I didn't extend the quickstart itself, which stays a few-minute setup.

**Decisions.**

- **Example project.** A four-task expense tracker. The import depends on nothing, the summary depends on the import, and the chart depends on the summary. The decision is dating expenses by posting date because the bank rewrites transaction dates on settlement. The finished code shows the posting date but not the reason. The summary's description links to the import (context it needs) and to categorization (related, with no `depends_on`), to show a link that isn't a dependency.
- **Completion convention.** The default three columns and solo trunk: the finisher moves the task to `done` and commits code and task together. One line points to the review-gate recipe. Worktrees are a link, not a step.
- **Discovery.** The handoff prompt names `.shipbench/AGENTS.md` explicitly, and the page says to add a pointer to your own root instructions if you want one. It doesn't tell ShipBench to write that file, which follows the ownership boundary in workflows.md.

**Verification.** Every command and output on the page comes from a real run of the local CLI (0.5.0 dist) in a scratch repository. Two genuinely fresh agent sessions ran there on the page's exact prompts, with nothing else except the CLI path. The handoff session read the instructions, shortlisted with `task list --available --json`, ran `task get` on the summary, then followed it to the import. From the Update it concluded that a month means a posting month. The "why" session searched, loaded the import task, cited the Update by timestamp, and marked its own inference. The page quotes both, trimmed. Task search now covers Updates, so the description's note that it excludes them is out of date.

**Follow-ups.** The one gap was that `task list --blocked` text output doesn't name what a task waits on. [add-focused-dependency-queries-for-a-single-task](add-focused-dependency-queries-for-a-single-task.md) already covers that, so I filed nothing new. If [let-tasks-reference-related-work-without-implying-a-dependency](let-tasks-reference-related-work-without-implying-a-dependency.md) lands, this page's link-versus-dependency section should move to `related`.
