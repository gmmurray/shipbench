---
title: >-
  Strengthen and correct ShipBench's public explanation across the site and
  docs, then assess next steps
status: done
priority: high
tags:
  - docs
  - site
  - copy
  - positioning
created: '2026-09-09T04:06:45.565Z'
updated: '2026-09-23T21:51:06.063Z'
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
- Observation of real project use (`spike-evaluate-whether-shipbench-helps-people-resume-real-projects`, deleted before this pass began)

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

## Task Updates

### 2026-09-20T18:56:51.196Z
Implemented the messaging pass and the three claim corrections. Direction chosen with the owner before any editing.

**Direction: "Know where every project stands — and why it got there."**

- *Primary visitor and situation*: one developer running several repositories, opening one after a gap or switching between them, who cannot say from memory what is next, what is blocked, or why the last call went the way it did.
- *Promise the product can keep today*: the plan, its sequencing, and the reasoning behind it are structured files in the repository, so all three are things you look up rather than remember. Nothing is captured automatically; what is findable is what got written.
- *Reasons over the likely alternative*: a hosted tracker is built to coordinate people and is configured again per repository; a TODO file has the right access model and almost no structure — a checked box is the whole record, with nowhere for the reason behind an item. Neither is caricatured, and both remain adequate for some people.
- *Evidence*: `task list --available` (dependency-aware ranking), `task comment` (timestamped capture in the same file), and `task search` over titles, tags, descriptions and Task Updates, live and archived, with per-update snippets. All three shipped before this page claimed them.
- *Next action*: quickstart, which now ends on recording a decision and searching it back.

Rejected the earlier spike's "Give your next agent the reasons behind the work": it framed the system as a remedy for agent memory limits. The reasoning cycle is kept as the page's demonstration and as one bullet in why.md, not as the identity. The explanation survives agents getting substantially better, because a better agent still needs the record to exist.

**Landing page.** New hero (the old one led with file placement, which the page already has a section for). Why-prose rewritten on the todo-list half. Replaced the "Three Local Interfaces" card grid with "A Decision, Followed Through" — three steps against one task file, using real CLI output shapes, with the capture step visible and stated as deliberate. The three surfaces survive as the steps' labels plus a closing note. `LocalInterfaceIcon.astro` and the `.local-interface-*` rules are gone; `.decision-trace` replaces them.

**Hero workspace preview.** Its two tabs described different projects, and its CLI pane printed output the CLI does not produce (`✔ updated status: review`, and a one-line summary for `task graph`, which emits JSON). Both panes now show the same four tasks as the board tab, with real output.

**The three overstatements, plus a fourth.** docs/why.md and the published why page ("no chance the two have diverged") now say there is one location rather than two to reconcile, and state plainly that currency is still the writer's. solo-trunk-workflow.md ("it cannot drift from the code") now claims one commit instead of two systems, and says keeping a description true is still your job. README.md ("hold no state") and docs/spec.md, which carried the same sentence, now name the missing structure instead of denying state.

**Also changed.** `site.ts` description — its second half ended on where tasks are stored, which the `<title>` beside it already implies; it now carries both halves of the promise (144 characters). overview.md gained the "and why" clause. quickstart.md gained step 4, recording a decision and finding it again. Doc `updated` dates bumped. Tagline, descriptor, casing, punctuation, umbrella/client naming, and the Harbor availability boundary are unchanged.

**Verification.** typecheck, lint, 120 vitest, and 100 Playwright tests including axe. Three e2e assertions were updated for the section swap, not worked around: code-block counts 3/2 → 6/5, `.local-interface-card` → `.trace-step`, and the built-output landing assertion now names the trace headings. Landing page reviewed at 1440 and 390 in both themes; the hero's Markdown & CLI tab reviewed separately at both sizes, since no screenshot covers it. Both new doc anchors verified against the built HTML.

**Deferred, not done.** docs/workflows.md, concurrent-agents.md, the three recipe pages, and docs/harbor.md were not reviewed — none carries the corrected claims, and none is an entry point. The landing CTA still goes to the quickstart rather than a resumption walkthrough, because that walkthrough does not exist yet.

**Coordination.** `add-a-complete-project-resumption-and-agent-handoff-walkthrough` and `make-task-descriptions-discoverable-through-board-search` are untouched and now more load-bearing than before — see the assessment. The third coordination link, `spike-evaluate-whether-shipbench-helps-people-resume-real-projects.md`, is dangling: that file was deleted from the working tree before this pass started. Left the description as written rather than editing around the owner's deletion.

**Assessment: what the clarified promise exposes.**

*Product gaps.* Board search reads titles only, so the surface a non-terminal user opens cannot do the retrieval the page demonstrates. This is the widest gap between the claim and the product, and `make-task-descriptions-discoverable-through-board-search` is now unblocked — its dependency landed. Recommend raising it to high. `expose-a-consistent-cli-project-validation-report` supports the "where it stands" half when files drift, and `let-tasks-reference-related-work-without-implying-a-dependency` supports the "why" half, since a decision usually points at sibling work; both stay medium. All three pass the durability filter.

*Communication.* `add-a-complete-project-resumption-and-agent-handoff-walkthrough` is the destination the new CTA wants and does not have. Recommend high. The deferred workflow and recipe pages are low and can ride the next docs pass.

*Cross-project scope.* The hero says "every project" while ShipBench is per-repository. Nothing on the page claims a single pane across repositories, and why.md frames independent plans as the design, so this is not an overstatement — but it does make `spike-explore-a-local-workbench-across-shipbench-repositories` more relevant than it was. Leave in backlog; promote only if the gap is felt in use.

*Onboarding.* One concrete gap with no task: the welcome task `shipbench init` scaffolds shows frontmatter and a description but no Task Update, so a new board never demonstrates the half of the promise this pass just committed to. Small, self-contained, and worth a task. `.shipbench/AGENTS.md` already teaches agents the Update heuristic and `task comment`, so nothing is needed there.

*Open to observation, not buildable.* Whether anyone but the owner writes Updates unprompted remains untested, and the spike that would have observed it was deleted. Whether the "and why" half lands on a visitor who has not felt the problem is also unknown. Both are hypotheses, and neither should be treated as settled by this pass.

*Recommended next action*: board search, then the walkthrough. Do not start a second messaging phase.

### 2026-09-21T00:43:43.785Z
Rebalanced after review. The first draft over-rotated toward recorded reasoning in two places, which made the page's most memorable block read as a decision log with a board attached — the inverse of what ShipBench is.

- The demonstration is now framed around the task, not the decision: badge "One Task, Followed Through", heading "One task, from picked up to explained months later." Same three steps and same evidence; the task is the spine and the reasoning is what it accumulates.
- Step 01 was the thinnest step and the only one about doing the work. It now names the everyday loop and points at the local board as the same question asked visually.
- The closing note gives the board a real sentence — live Kanban over the same files, drag a card and the Markdown changes — instead of a clause. The board had lost its dedicated block when the interface grid went, and was down to a passing mention.
- In both why pages, "Decisions can stay with the task that caused them" moved from slot 2 to slot 4 of "What follows from that", behind context switching, agent access, and Git. It was sitting ahead of three proven structural consequences while being the newest and least-evidenced claim.

The hero, How It Works, the quickstart, the site description, and the three claim corrections are unchanged — those were already task-forward. Checks re-run green: typecheck, lint, 120 vitest, 100 Playwright. Two e2e assertions follow the renamed badge.

### 2026-09-23T21:46:37.377Z
Post-completion review, with fixes applied.

- **The problem statement had become one sentence on four surfaces.** "A checked box is the whole record — nothing to sequence, nothing a tool can validate or query…" appeared almost verbatim in the README, spec.md, the landing page, and both why pages, which is exactly the drift the AGENTS.md problem-statement rule exists to stop. Each surface now takes its own angle. The why pages stay the long form. The landing page describes coming back to a TODO.md a month later. The README says what a line can't express. The spec states the tooling consequence. The landing version's "costs nothing to start" was ledger vocabulary and is gone.
- **The hero subhead claimed capture.** "ShipBench keeps … the decisions behind it" said the system keeps decisions, which it doesn't. It now says each task has room for the reason, and names both halves of the h1 instead of ending on "both".
- **h1: "every project" → "each project".** Plans are per repository and Harbor isn't live, so nothing gives a view across projects. This is the independent-plans-versus-cross-project-visibility distinction the task asked to keep. The owner agreed.
- **The manual-capture caveat is stated once per surface.** The landing page said it three times in one scroll. It now says it once, in step 02, where the capture happens. The why pages drop their second statement of it.
- **The search specimen is verbatim CLI output.** It had a leading ellipsis the CLI doesn't print and was hand-wrapped over two lines, against the `.trace-code` comment's own rule. Printed verbatim, the line ran off the desktop column, so the example entry is now short enough that the CLI prints it whole: "Put fs calls behind a StorageAdapter so the board can run on GitHub too." I checked it by running the transcript against the built CLI. Because the trace blocks scroll, axe then flagged scrollable-region-focusable, so `CodeBlock` gained an opt-in `scrollable` prop that adds `tabindex="0"`, the same treatment Markdown tables already get. The quickstart block also scrolls on phones and doesn't have it yet; axe only runs at desktop width, so it hasn't flagged that.
- **Leftovers.** The CSS header was renamed to match the rebalanced section, the unused `decision-section` class was removed, and the quickstart's frontmatter description now covers step 4.
- **Copy pass.** A humanizer pass removed "X, not Y" kickers and some internal framing that had leaked into public copy ("The task is the spine") from the landing page, solo-trunk-workflow, and why pages.

Follow-ups acted on: `make-task-descriptions-discoverable-through-board-search` and `add-a-complete-project-resumption-and-agent-handoff-walkthrough` were raised to high, as the assessment recommended. The welcome-task proposal is now `show-a-task-update-in-the-welcome-task-shipbench-init-scaffolds`, kept separate from `updating-shipbench-init-with-new-versions` at the owner's direction. The dangling spike link in the description is now plain text noting the deletion.
