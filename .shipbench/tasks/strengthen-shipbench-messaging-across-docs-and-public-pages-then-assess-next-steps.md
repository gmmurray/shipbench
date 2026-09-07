---
title: >-
  Strengthen ShipBench messaging across docs and public pages, then assess next
  steps
status: backlog
priority: medium
tags:
  - docs
  - site
  - positioning
created: '2026-09-07T18:28:04.763Z'
updated: '2026-09-07T18:28:04.763Z'
---

Make a first implementation pass on ShipBench's messaging across the repository docs and public site, then assess what work should follow. Strengthen the existing direction rather than repositioning ShipBench as another agentic project-management app.

## Core direction

ShipBench is a project system a solo developer owns: the plan, decisions, and work belong together in the project. Its durable responsibilities include choosing and sequencing work, understanding progress and unresolved questions, and retaining enough context to continue or reconsider decisions over time. Git-native files and optional clients are the mechanisms that support those responsibilities.

Agents are an important part of solo development in 2026, but their current memory, context-window, and orchestration limitations must not define the product's purpose. The explanation should remain useful if agents become substantially more capable. Keep solo developers as the audience, including their writing, documentation, and publishing projects; do not narrow the system to coding-agent workflows.

The owner's observed workflow is valuable evidence: agents consult related tasks, record explanations while working, and later retrieve those explanations to answer why a decision was made. Use this to augment the project-management promise. The tasks used to direct work can also accumulate a readable account of why the project took its current shape. A human or a later agent can inspect and reuse that account. This is a strong demonstration of the system, not its entire identity.

The earlier positioning spike overemphasized this application by recommending an agent-directed hero. Do not carry forward "Give your next agent the reasons behind the work" as an approved primary direction. Keep the useful reasoning-cycle insight without making ShipBench a remedy for temporary agent shortcomings. This task contains the working rationale and must stand alone without docs/positioning-brief.md, which the owner intends to remove. Keep behind-the-scenes positioning analysis in task records rather than adding another public strategy document.

## First pass

- Review README.md, docs/why.md, the site landing page and workspace preview, site metadata, and the immediate documentation entry points such as overview and quickstart. Identify the small set of changes needed for a coherent explanation across those surfaces, then implement them. Adapt the argument to each surface instead of repeating one paragraph everywhere.
- Explain why a visitor should care before explaining where files are stored. Connect task structure and project ownership to concrete actions: choosing the next work, understanding what remains unresolved, inspecting a decision, and continuing or revising the project.
- Bring recorded reasoning into the explanation as a supporting benefit. Where an example fits, follow one decision through consulting earlier work, explicitly recording a reason, and later reading and citing the source. Make capture visible; do not promise automatic, complete, correct, or permanently current documentation.
- Preserve the canonical tagline "Plans that ship with the work." and descriptor "Git-native project management for solo developers.", with the context-specific punctuation rules in AGENTS.md. Preserve ShipBench as the system and ShipBench CLI and ShipBench Harbor as clients, domain-neutral scope, and the current Harbor availability boundary.
- Keep comparisons fair. Markdown, agent access, local workflows, and task reasoning are not established unique advantages. A maintained TODO file, issue tracker, decision record, or agent-memory workflow may already be sufficient. Explain ShipBench's particular combination of a small convention, user-owned process, optional clients, and readable project records without caricaturing alternatives.
- Verify claims against the product as it exists when this task starts. Distinguish storing context from discovering it, committed history from uncommitted work, branch-local state from synchronized state, and independent repo plans from cross-project visibility. Search improvements already have dedicated tasks; treat those as planned or shipped according to their actual status rather than as permanent limitations or assumed capabilities.

## Scope and coordination

This is a bounded messaging implementation, not a product reinvention, a visual redesign, or an exhaustive market investigation. Public rationale should explain the product to its users; internal comparisons and strategic deliberation belong here. Avoid new agent integrations, orchestration, analytics, or recruitment as implied scope.

Coordinate with these existing tasks before editing overlapping surfaces. Record which parts this first pass covers and which remain for those tasks, without silently treating them as completed:

- [Landing-page value demonstration](make-the-landing-page-demonstrate-shipbench-s-distinctive-value.md)
- [Resumption and agent-handoff walkthrough](add-a-complete-project-resumption-and-agent-handoff-walkthrough.md)
- [Continuity claim corrections](make-continuity-claims-precise-without-weakening-shipbench-s-promise.md)
- [CLI reasoning retrieval and shared search contract](make-cli-search-retrieve-recorded-decisions-with-useful-context.md)
- [Board search](make-task-descriptions-discoverable-through-board-search.md)
- [Observation of real project use](spike-evaluate-whether-shipbench-helps-people-resume-real-projects.md)

## Acceptance

- The reviewed public surfaces give a coherent account of ShipBench's enduring purpose, with agent workflows illustrating rather than defining it.
- Messaging improves beyond a feature inventory or a file-placement claim and remains grounded in observable behavior.
- Recorded reasoning has an appropriate place alongside planning, sequencing, and project state; its usefulness is not reduced to compensating for current agent memory.
- Examples, commands, links, naming, and availability claims are accurate. Review changed site surfaces at desktop and mobile sizes and run checks appropriate to the edits.
- The task records the changes made, any surfaces deliberately deferred, and the evidence or uncertainty behind material messaging choices.

## Final action: assess what should come next

After implementing and reviewing the first pass, assess what the clarified promise exposes beyond messaging. Separate remaining communication work, product gaps, onboarding or demonstration needs, and questions requiring observation. Map each to an existing task where possible and propose only concrete missing follow-ups, with rationale and relative priority.

Use this filter: would the work still help a solo developer direct and understand their projects if agents became substantially more capable? Searchable decisions, inspectable history, and clear project state may qualify; features tied to a particular agent's temporary limitations need a specific justification. Distinguish necessary support for the current promise from optional expansion. Record the assessment here and recommend the next action; do not automatically begin a second implementation phase.
