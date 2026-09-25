---
title: 'Rewrite ShipBench''s public copy from an outline, with a new landing page'
status: done
priority: high
tags:
  - docs
  - site
  - copy
  - design
created: '2026-09-24T19:36:56.397Z'
updated: '2026-09-25T03:13:47.059Z'
---

Rewrite ShipBench's public explanation from scratch, starting from a plain outline of what each surface needs to say rather than from the sentences already there. It covers a new landing page with a new flow and visual treatment, plus the other surfaces that make the argument.

## Why

Previous passes made the copy more accurate, but it still reads as generated. Editing sentence by sentence keeps the original shape, and the shape is part of the problem. The owner's diagnosis, with examples:

- **Cadence.** Paired short sentences ("The output scaled. The tools for tracking it didn't."), aphorisms ("The plan belongs there too."), and setups like "That leaves two bad fits." Each line is fine on its own. Together they sound like nobody.
- **The argument is a rebuttal.** Most of the why section explains what ShipBench isn't (a hosted tracker, a TODO file). The owner's own workflow, which is the real reason the project exists, comes in late as supporting evidence and reads as dropped in.
- **Too smooth.** Phrases like "sits in the right place and takes a minute to start" have no rough edges, no specifics, and no speaker.
- **Defensive comments in the markup.** Comments like "Deliberately the one section…" and "No problem clause here on purpose…" argue for the copy instead of explaining the code.

## Phase 1: outline and voice

Stop for owner review at the end of this phase. Nothing in phase 2 starts until the outline and the voice decision are approved.

**The outline.** Write it in this task's record. For each in-scope surface, give:

- who is reading it and what they are trying to find out;
- the one point it has to land;
- each claim, with its evidence: a command and its real output, a behaviour, a file, or the owner's workflow;
- where the reader goes next.

Write plain statements such as "a task can hold timestamped updates; `task search` finds them later; nothing records them automatically." Don't write copy-ready phrasing, because anything polished in the outline ends up in the copy.

Sources are the current surfaces (as a record of what is claimed now, not as prose to keep), `docs/why.md`, `docs/spec.md`, the Task Updates on [the previous messaging task](strengthen-and-correct-shipbench-s-public-explanation-across-the-site-and-docs-then-assess-next-steps.md), which hold the chosen direction and its evidence, and the product itself. Run commands rather than trusting the docs.

**The landing page flow.** Propose the section order in the outline, with a rough text wireframe: what each section says, and what it shows (a preview, a transcript, a diagram, or nothing). The hero workspace preview, the task trace, and the system-facts strip can each be kept, reworked, or removed. None of them is fixed.

**Voice.** The owner will provide writing samples. Decide per surface between first person (the owner's voice, built on the actual workflow) and a plain product voice, and record the decision. The working suggestion is first person for the why page and the root README, and plain product voice for the landing page and docs. Treat it as a suggestion, not settled. Use the samples for rhythm and vocabulary; don't lift sentences from them.

**AGENTS.md copy rules.** Cut "Naming and branding" down to hard constraints:

- the tagline and descriptor strings, with their casing and punctuation rules;
- the umbrella and client naming, and the package names;
- the domain;
- the meta description carries a reason, not the descriptor;
- no claim of guaranteed accuracy, automatic capture, or cross-project visibility the product doesn't have.

Remove the problem-statement style guidance. Do this in phase 1 so phase 2 is written under the new rules, and have the owner approve the diff.

## Phase 2: write

- **Landing page v2.** New flow and new visuals. The design doctrine (`docs/design-doctrine.md`) stays ground truth. Build new layouts, compositions, and visual devices from its tokens, type, geometry, and components. If the page needs something the doctrine doesn't allow, propose a doctrine change for the owner to approve rather than creating a parallel style. Keep the Harbor section gated on `harborEnabled`.
- **Root README**, both why pages (`apps/site/src/content/docs/why.md` and `docs/why.md`; decide whether they stay mirrored), the overview, the quickstart's opening prose, the `site.ts` description, and the motivation paragraph in `docs/spec.md`.
- **Comments.** Strip rationale comments from every file this task rewrites. Keep a comment only if it prevents a real bug, such as a11y structure, the skip-link `tabindex`, or why a panel uses `hidden`. The reasoning behind copy decisions goes in this task's record.

## Constraints carried forward

- The tagline "Plans that ship with the work." and the descriptor "Git-native project management for solo developers." don't change. ShipBench is the system; the ShipBench CLI and ShipBench Harbor are clients.
- Harbor is not live. Don't link to it or imply it works until the flag flips.
- The scope stays domain-neutral: writing and publishing projects as well as code. Agents are one example of use, not what defines the product.
- Accuracy distinctions from the previous task still hold. Plans are per repository, with no view across projects. Updates are written by someone, never captured automatically. Keeping a plan current is still the writer's job. The agent convention is a recommendation, not something enforced.
- Every command and output shown must be real. Run it.

## Follow-ups, not in this task

Create these once the voice is approved, so they use it rather than evolve alongside it:

- **Guide docs:** workflows, solo-trunk-workflow, concurrent-agents, the three recipes, harbor.md, and the prose parts of convention-spec.
- **Package surfaces:** the READMEs for `apps/cli`, `packages/core`, and `packages/board`; the npm `description` fields (check [docs/releasing.md](../../docs/releasing.md) for whether a metadata change needs a changeset); and text for the GitHub repository description, which the owner sets by hand.
- **Rationale comments** in site files this task doesn't rewrite.

Out of scope entirely: the body of cli-reference, the README and AGENTS.md that `shipbench init` scaffolds, CLI help text, Harbor's own copy (it lives in another repository), and the OG card. The card only carries the tagline, unless the new landing visuals give a reason to revisit it.

## Acceptance

- Phase 1's outline, voice decision, landing flow, and AGENTS.md diff are recorded here and approved by the owner before phase 2 begins.
- The in-scope surfaces are rewritten from the outline, not edited from the previous copy, and each one does its own job instead of restating another.
- The landing page follows the approved flow, meets the design doctrine or an approved change to it, and works at desktop and mobile widths in both themes.
- The e2e assertions that encoded the old page structure are rewritten, not deleted. Coverage stays for axe, first-paint theme, mobile overflow, copy behaviour, and search.
- Typecheck, lint, vitest, and Playwright pass. The changed pages are reviewed in a browser at desktop and mobile widths.
- The follow-up tasks exist once the voice is approved.

## Task Updates

### 2026-09-24T22:30:03.207Z
Phase 1 outline, for owner review. These are plain statements of what each surface has to say, not draft copy.

#### What ShipBench is, in plain terms

ShipBench is a small convention for keeping a project's tasks as Markdown files in that project's own repository, plus a CLI and a board that read and write them.

It came out of one developer tracking several AI-assisted projects at once. The hosted tracker was built for teams, had to be set up again for each project, and was awkward for agents to reach. Notes kept in the repository were easy to reach but had no structure: a list was too small to hold a task's context, and a spec document grew until nobody read it.

A task file sits between those. It is cheap to create for any project, structured enough for tools to check and query, and it holds one task's context. ShipBench works well with agents and works without them.

#### Positioning decisions

- **Not an AI task management system.** It's a task management system that works well with AI. Agents show up in how it grew and as one way to use it. They are not the headline and not the subject of the page.
- **Origin.** It grew out of agent-assisted solo work, and then into other uses: creative writing, and posts for a personal site. Say this plainly, once, where the story is told (the why page). Don't lead with it.
- **State the problem generally.** Don't make it a TODO.md joke or any single tool's failing. The general problem is that one person's project plan had no home the right size. Hosted trackers put it outside the repo and behind setup built for teams. Files inside the repo were either too thin to hold context or grew too big to read. Linear is described fairly: good at what it's for, and closest to what was wanted, but built for teams.
- **Decision chains are a use case, not a feature.** Agents writing links between tasks and Task Updates, then following them later to answer "how did we decide to build X?", is a consequence of free-form files plus a few rails. It shows up in the use-cases section with the explicit caveat that it depends on links and updates someone actually wrote.
- **Format, not process.** The convention is opinionated about keeping you free to have your own opinions, and it shows what applying them looks like. That becomes a landing-page section on things you can build with it.
- **Reopen the hero.** "Know where each project stands. And why it got there." is withdrawn. Its second half was built on the decision-recording example, which isn't why ShipBench exists. The new hero states what ShipBench is and where it lives, clearly enough that a visitor can tell whether it's for them.

#### Evidence, claim by claim

I checked each item against the product on 2026-09-24.

1. **Setup is one command.** `shipbench init` writes `.shipbench/` with the config, a README, AGENTS.md, and a welcome task. It is non-destructive: it leaves a valid project unchanged and refuses to overwrite a broken one.
2. **A task is one Markdown file with YAML frontmatter.** Core generates the slug from the title and handles collisions. Status must match a configured column, and an invalid status or priority is rejected on write.
3. **The board comes in two forms.** `shipbench board` (web, with live updates when files change on disk) and `shipbench board terminal` (read-only, live).
4. **CLI.** `task create`, `edit`, `comment`, `get`, `move`, `list`, `search`, `graph`, `archive`, `unarchive`, `delete`. `task list --available` ranks the default column's tasks whose dependencies are done, by priority and then age. Most commands take `--json`.
5. **Agents.** `init` scaffolds `.shipbench/AGENTS.md`, which teaches the schema and the CLI. Agents use the same CLI and files as a person. Nothing requires an agent.
6. **Context.** A description, a timestamped Task Updates section (`task comment`), and ordinary Markdown links between tasks. `task search` covers titles, tags, descriptions, and updates, in both live and archived tasks. `depends_on` records order and never blocks a write or a move.
7. **Decision chains are real on this board.** For example, this task links to the previous messaging task. That task links to the walkthrough and board-search tasks, and its description records the three tasks it replaced. 12 of the 55 live task files link to other tasks. None of those links were created automatically.
8. **Freedom.** Columns are configuration. Unknown frontmatter fields are preserved. The scaffolded AGENTS.md belongs to the project and can be rewritten. Published workflow pages: solo trunk and concurrent agents. Published recipes: human review gate, multi-agent worktree rules, and gitignoring `layout.json`.
9. **Not only code.** The owner uses it for a creative-writing repository and for a personal site's posts. `docs/why.md` already says so.
10. **Git.** History and branches carry plan changes, and every clone is complete. Status only means something on the branch you're looking at.
11. **Limits that copy must respect.**
    - Plans are per repository, with no view across projects.
    - Nothing is recorded automatically.
    - Keeping a plan current is the writer's job.
    - Board search matches titles only today. `make-task-descriptions-discoverable-through-board-search` is still todo, so no surface may say the board searches descriptions.
    - Harbor isn't live.

#### Surfaces

**Landing page**

- **Reader:** a developer arriving from a link or a search who has never heard of ShipBench. They want to know what it is, whether it's for them, and how to try it.
- **The one point:** your project's tasks live in the repository as Markdown files. The CLI, the board, your editor, and your agents all work from those files, and you choose the process.
- **Next step:** the quickstart. GitHub is the secondary link.
- **Proposed flow** (text wireframe):
  1. **Hero.** Tagline badge. A plain statement of what ShipBench is and where it lives, then one sentence on who it's for. Quickstart and GitHub buttons. On the right, or behind the text, an experimental abstract animation: marks moving across a few lanes into a final one, standing for tasks moving through states to done. No UI mockup.
  2. **How it works.** Three facts: a folder, a file per task, and clients on top (CLI, board in the browser or terminal, editor, agents). At most one small real task file as a specimen.
  3. **Why it exists.** Short, product voice, with the problem stated generally. Links to the first-person why page.
  4. **What you can build with it.** A grid of real setups, each linking to the doc that shows it:
     - working straight on main;
     - a human review gate;
     - parallel agents in worktrees;
     - writing and publishing projects;
     - a decision trail through links and Task Updates;
     - your own columns and fields.

     This section replaces the task trace. It is where "format, not process" gets shown rather than claimed.
  5. **Works with agents.** Agents read the same files through the same CLI, and `init` gives them instructions. ShipBench doesn't need them.
  6. **Quickstart.** Three copyable commands.
  7. **Harbor.** Unchanged gating.
  8. **Footer.**
- **Removed:** the hero workspace preview and the task trace transcripts. Following the owner's point that task-management demonstrations get visually disorienting, the page shows at most one file specimen and the quickstart commands.
- **Design:** the current page is the doctrine applied as a skin. The new one makes layout decisions: a much larger type scale for the hero, fewer boxed sections, more space, and the grid background used on purpose. The Axiom-style split hero is the default proposal, with Fiberplane-style full-width type as the alternative.

**Root README**

- **Reader:** a GitHub visitor deciding whether to try ShipBench, or a returning user looking for a command.
- **Points:** the tagline, the descriptor, and what ShipBench is in two or three sentences; install and the first three commands; what's in this repository (core, board, CLI, site); links to the docs and the why page.
- **Voice:** product voice, with one short first-person paragraph on why it exists that links to the why page.

**Why page** (site and `docs/why.md`)

- **Reader:** someone deciding whether the idea holds up, or the owner's peers.
- **Points:**
  - the progression: Linear through Claude's web chat and MCP; then Claude Code with MCP to Linear; then agent-written lists in the repo; then spec and milestone documents that grew past the point of reading;
  - what each one got right, stated fairly;
  - what ShipBench does instead;
  - what it declines to decide (keep the substance of the current section);
  - uses beyond code;
  - what turned out to matter later and wasn't planned: decision chains through links and updates.
- **Voice:** first person, the owner's.
- **Mirroring:** make `docs/why.md` a short pointer to the published page, so there's one copy to maintain. The alternative is keeping two copies in sync.

**Overview**

- **Reader:** someone who just opened the docs.
- **Points:** the pieces (the convention, CLI, board, agents, and Harbor if the flag is on) and which page to read for what.
- **Voice:** product voice. Short.

**Quickstart opening**

- One or two sentences on what you'll have at the end: a repository with a board, a first task, and the board open.

**`site.ts` description**

- A reason to click, within about 155 characters. The substance: tasks as Markdown in your repository, a CLI and board on top, one command to set up, no account.

**`docs/spec.md` motivation**

- Engineering register. The problem stated generally in one paragraph, then the premise, with a link to the why page.

#### Voice

- **The why page is first person and in the owner's voice.** Longer sentences are fine. Name the real tools and situations, allow honest uncertainty, and take small detours. No aphorisms.
- **The README is product voice** with one first-person paragraph.
- **The landing page, overview, quickstart, and spec are plain product voice.** Declarative and specific, with short-to-medium sentences.
- **Patterns banned on every surface.** These are the ones found in the old copy:
  - "the plan belongs there too" kinds of aphorism;
  - paired short sentences as a punchline ("The output scaled. The tools didn't.");
  - "That leaves…" setups;
  - "not X, but Y" sentence endings;
  - "sits in the right place";
  - "deliberately" and "load-bearing" in copy;
  - more than one caveat about the same limit on a single surface.
- **Samples are for rhythm only.** No sentence is lifted from them. The origin facts on the why page are paraphrased for the owner to check.

#### Proposed design doctrine amendment (made in phase 2 once approved)

Add a scoped exception to Motion & feedback, for the home page only:

- one ambient animation, abstract and symbolic, with no UI mockup;
- neutral and accent colours only, flat, with no glow, shadow, or blur;
- slow and non-attention-grabbing, and paused when off screen;
- replaced by a static final frame under `prefers-reduced-motion: reduce`.

Everything else in the doctrine applies to the landing page unchanged.

#### Reversals, recorded on purpose

- **AGENTS.md "Naming and branding" is cut to hard constraints** (the diff is in the working tree for review). This reverses decision 4 of `settle-the-branding-doctrine-questions-the-homepage-pass-surfaced`, the problem-statement constraints. They made every new sentence argue with a rulebook, and the sentences that came out were the slop this task exists to fix. The rule that stays is the one that matters: say only what the product does today.
- **A rule added to AGENTS.md › Code conventions:** comments explain code, not copy.
- **The previous task's hero and task-trace demonstration are withdrawn.**

#### Open for the owner

1. `docs/why.md`: pointer (recommended) or kept as a mirror?
2. Does the README get a first-person paragraph?
3. Hero layout: Axiom-style split (recommended) or Fiberplane-style full-width type?
4. Should any use case be added to or removed from section 4 of the landing flow?
5. Is the origin summary above accurate, and is there anything in it you'd rather not have public?

### 2026-09-24T23:01:11.664Z
Phase 2 done. Owner decisions on the outline:

- The AGENTS.md diff is approved.
- `docs/why.md` becomes a pointer to the published page.
- The README gets a first-person paragraph.
- The hero uses the split layout.
- The landing grid shows real use cases, not setups, with the decision trail as one of them and a link to the workflow docs.
- The origin summary is accurate.
- The animation is in, as an experiment.

**Landing page.** Rebuilt from the outline in this order: hero, how it works, ways to use it, why it exists, quickstart, then Harbor behind its flag.

- The tagline is now the h1 instead of a badge above one, with a plain lead underneath.
- `HeroWorkspaceWindow` and the task trace are removed, along with their CSS.
- `HeroLanes.astro` is the abstract animation. Marks move one lane per step, and the moving mark is in accent. Done marks clear off the panel and come back one at a time. It pauses off screen and when the tab is hidden, and holds still under reduced motion.
- Every section uses the same layout: heading on the left, content on the right. There are no eyebrow labels, and mono is used only for identifiers.
- "Works with agents" is one of the eight use cases rather than its own section, which avoids saying it twice.

**Doctrine.** A scoped "The home page" subsection covers the display type scale, section headings without eyebrows, and the one ambient animation.

**Copy rewritten from the outline:**

- the landing page;
- the `site.ts` description;
- the README;
- the why page, in the owner's voice, with a `#not-only-code` anchor that the landing page links to;
- `docs/why.md`, now a pointer;
- the overview;
- the quickstart opening;
- the `docs/spec.md` motivation, which also fixed a reference to CLAUDE.md that should point to AGENTS.md;
- the header's "Get started" casing.

Rationale comments were stripped from every file touched.

**Tests.** The landing assertions in `built-output.spec.ts` were rewritten, and `homepage.spec.ts` now covers copy behaviour, the use-case grid stacking without mobile overflow, and the animation. For the animation it checks `aria-hidden`, movement when motion is allowed, and a static frame under reduced motion. The hero tablist tests were removed along with the widget. The clipped-focus-ring test now targets the quickstart copy button inside `.code-block-shell`. That exposed a real bug on every page with a code block: the button had 1px of clearance, so its focus ring was clipped. `.code-block-head` now has 4px of vertical padding.

**Verification.** Typecheck, lint, 120 vitest tests, and Playwright (99 passed, 1 skipped as before, axe included) all pass. I reviewed the landing page at 1440 and 390 in both themes, and the why page on desktop. I sampled the animation over 30 seconds: no lane exceeded its visible rows.

**Follow-ups created:**

- `rewrite-the-guide-docs-in-the-approved-voice`, which includes a possible decision-trail guide for the "Finding out why" card to link to;
- `update-package-readmes-and-npm-descriptions-to-the-approved-copy`;
- `strip-rationale-comments-from-the-rest-of-the-site`.

**Open for the owner.** Whether the animation stays. It's the one experimental piece, and removing it means deleting `HeroLanes.astro` and giving the hero a single-column layout.

### 2026-09-25T03:10:36.682Z
The owner reviewed phase 2 and approved it. The hero animation stays, so the question left open in the previous update is settled. The home-page exception in the design doctrine stands as written.
