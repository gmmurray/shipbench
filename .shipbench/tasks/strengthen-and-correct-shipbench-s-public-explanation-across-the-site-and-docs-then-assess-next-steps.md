---
title: >-
  Strengthen and correct ShipBench's public explanation across the site and
  docs, then assess next steps
status: todo
priority: high
tags:
  - docs
  - site
  - copy
  - positioning
created: '2026-09-09T04:06:45.565Z'
updated: '2026-09-09T04:06:45.565Z'
---

Make one implementation pass on ShipBench's public explanation across the repository docs and the site, correcting the continuity claims that overstate what the system guarantees, then assess what work should follow. Strengthen the existing direction rather than repositioning ShipBench as another agentic project-management app.

This task replaces three that covered overlapping surfaces with one argument: the landing-page value demonstration, the continuity-claim corrections, and the earlier messaging pass. They are archived; this description carries their substance. Do the whole thing as one pass — the per-surface adaptation this task requires is what made them inseparable.

## Core direction

ShipBench is a project system a solo developer owns: the plan, decisions, and work belong together in the project. Its durable responsibilities include choosing and sequencing work, understanding progress and unresolved questions, and retaining enough context to continue or reconsider decisions over time. Git-native files and optional clients are the mechanisms that support those responsibilities.

Agents are an important part of solo development in 2026, but their current memory, context-window, and orchestration limitations must not define the product's purpose. The explanation should remain useful if agents become substantially more capable. Keep solo developers as the audience, including their writing, documentation, and publishing projects; do not narrow the system to coding-agent workflows.

The owner's observed workflow is valuable evidence: agents consult related tasks, record explanations while working, and later retrieve those explanations to answer why a decision was made. Use this to augment the project-management promise. The tasks used to direct work can also accumulate a readable account of why the project took its current shape. A human or a later agent can inspect and reuse that account. This is a strong demonstration of the system, not its entire identity.

## The hero direction is an open decision

The earlier positioning spike selected "Give your next agent the reasons behind the work" and recorded its reasoning in docs/positioning-brief.md. That direction is **not approved** — it overemphasized the agentic application — and the brief was never committed, so nothing is retrievable from it. Keep the useful reasoning-cycle insight without making ShipBench a remedy for temporary agent shortcomings.

Do not treat any prior wording as settled, including "return to a project". Choose the direction in this task and record:

- the primary visitor and the situation they recognize;
- the promise the current product can keep;
- the reasons to choose ShipBench over their likely alternative;
- the evidence or demonstration that makes the promise credible;
- the next action that lets a visitor experience that benefit.

Keep behind-the-scenes positioning analysis in this task's record rather than adding another public strategy document.

## Surfaces

Review README.md, docs/why.md, the site landing page and workspace preview, site metadata, and the immediate documentation entry points such as overview and quickstart. Identify the small set of changes needed for a coherent explanation across them, then implement them. Adapt the argument to each surface instead of repeating one paragraph everywhere.

Explain why a visitor should care before explaining where files are stored. Connect task structure and project ownership to concrete actions: choosing the next work, understanding what remains unresolved, inspecting a decision, and continuing or revising the project.

### The landing page

Decide which existing sections earn their space and how the page develops the argument without repeating it. Preserve the existing visual language unless a specific content need calls for a change.

The hero should convey a consequential user benefit with enough specificity to distinguish ShipBench from a generic task board. Supporting sections should connect benefits to actual product behavior rather than listing interchangeable features or attacking simplified versions of competing tools.

Where a demonstration fits, follow one decision through time: an agent consults a related task, records why it chose an approach, and a later session answers "why did we do this?" by retrieving and citing that record. Use actual product behavior, make the capture step visible, and show consistent task state across the real interfaces. Do not promise automatic, complete, correct, or permanently current documentation.

The call to action should lead to a usable experience that supports the promise; connect to the resumption walkthrough if the chosen direction warrants it.

### Continuity claims that overstate the guarantee

Three passages give file placement stronger guarantees than the system provides. A checkbox holds state, and a developer can commit an obsolete task description or an incorrect completion status alongside code.

- docs/why.md — "no chance the two have diverged"
- apps/site/src/content/docs/solo-trunk-workflow.md — "it cannot drift from the code"
- README.md — "todo lists sit in the right place but hold no state"

Remove the claims of guaranteed semantic accuracy and the inaccurate assertion that a checklist has no state. Correct them by naming the real advantage — shared structure, validation, queries, accessible context, and convenient joint updates — not by adding a page of qualifications. Identify the intended meaning of each passage before rewriting it, and keep the root rationale, published why page, overview, README, and workflow explanations consistent where they make the affected claims.

When rewriting, distinguish:

- one storage location versus the correctness of the information stored there;
- history and portability versus keeping a plan maintained;
- storing context versus discovering it;
- committed history versus uncommitted work, and branch-local state versus synchronized state;
- independent repository plans versus visibility across projects;
- a recommended agent convention versus enforcement;
- a useful self-documenting workflow versus a guarantee that every decision is captured or that every recorded explanation stays current.

## Constraints

Preserve the canonical tagline "Plans that ship with the work." and descriptor "Git-native project management for solo developers.", with the context-specific punctuation and casing rules in AGENTS.md. Preserve ShipBench as the system and ShipBench CLI and ShipBench Harbor as clients, the umbrella/client relationship, domain-neutral scope, and the current Harbor availability boundary. Follow the mechanism-based copy rules in AGENTS.md, including the problem-statement constraints.

Keep comparisons fair. Markdown, agent access, local workflows, and task reasoning are not established unique advantages. A maintained TODO file, issue tracker, decision record, or agent-memory workflow may already be sufficient. Explain ShipBench's particular combination of a small convention, user-owned process, optional clients, and readable project records without caricaturing alternatives.

Verify claims against the product as it exists when this task starts. Search improvements have their own tasks; treat those as planned or shipped according to their actual status rather than as permanent limitations or assumed capabilities.

## Scope and coordination

This is a bounded messaging implementation, not a product reinvention, a visual redesign, or an exhaustive market investigation. Public rationale should explain the product to its users; internal comparisons and strategic deliberation belong in this task record. Avoid new agent integrations, orchestration, analytics, or recruitment as implied scope.

Coordinate with these before editing overlapping surfaces, and record which parts this pass covers and which remain, without silently treating them as completed:

- [Resumption and agent-handoff walkthrough](add-a-complete-project-resumption-and-agent-handoff-walkthrough.md)
- [Board search](make-task-descriptions-discoverable-through-board-search.md)
- [Observation of real project use](spike-evaluate-whether-shipbench-helps-people-resume-real-projects.md)

## Acceptance

- The reviewed public surfaces give a coherent account of ShipBench's enduring purpose, with agent workflows illustrating rather than defining it.
- The hero conveys a consequential user benefit specific enough to distinguish ShipBench from a generic task board, and the page develops one argument rather than restating it.
- Messaging improves beyond a feature inventory or a file-placement claim and remains grounded in observable behavior.
- The three named overstatements are gone, replaced by concrete mechanisms and user situations rather than qualifications.
- Recorded reasoning has an appropriate place alongside planning, sequencing, and project state; its usefulness is not reduced to compensating for current agent memory.
- The page, search/social description, and immediate documentation entry points carry one argument adapted to each surface.
- Examples, commands, links, naming, and availability claims are accurate. Review changed site surfaces in the browser at desktop and mobile sizes and run the checks appropriate to the edits.
- The task records the changes made, any surfaces deliberately deferred, the direction chosen and the evidence behind it, and what remains a hypothesis for later observation.

## Final action: assess what should come next

After implementing and reviewing the pass, assess what the clarified promise exposes beyond messaging. Separate remaining communication work, product gaps, onboarding or demonstration needs, and questions requiring observation. Map each to an existing task where possible and propose only concrete missing follow-ups, with rationale and relative priority.

Use this filter: would the work still help a solo developer direct and understand their projects if agents became substantially more capable? Searchable decisions, inspectable history, and clear project state may qualify; features tied to a particular agent's temporary limitations need a specific justification. Distinguish necessary support for the current promise from optional expansion. Record the assessment here and recommend the next action; do not automatically begin a second implementation phase.

Sources: [landing page](../../apps/site/src/pages/index.astro), [workspace preview](../../apps/site/src/components/HeroWorkspaceWindow.astro), [site metadata](../../apps/site/src/config/site.ts), [why.md](../../docs/why.md), [solo trunk workflow](../../apps/site/src/content/docs/solo-trunk-workflow.md), [README](../../README.md), and [branding rules](../../AGENTS.md).
