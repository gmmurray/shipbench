---
title: Why ShipBench
description: Why ShipBench exists — the per-project overhead that makes hosted trackers a bad fit for solo developers, and the case for keeping the plan in the repository.
group: Getting Started
order: 0
updated: 2026-08-05
---

## The friction

You start a new project. Before writing a line of code, you go somewhere else to set it up: create the workspace, name the columns, invite yourself, wire up whatever integration lets your coding agent see any of it. Days later you start another project and do it all again.

At team scale that setup cost is invisible. It amortizes across a year of work by a dozen people, and the tool earns its keep by coordinating them. Solo developers working with AI have inverted the ratio — many projects, short cycles, one person. The per-project overhead that used to round to zero becomes the dominant cost of tracking anything at all.

So most projects get nothing. The plan lives in your head, or in a chat log, or in a `TODO.md` that stopped reflecting reality a week ago.

## What actually changed

A solo developer with AI now ships at the scale of a small team: several workstreams in flight, often across several repositories, with real sequencing between them. The output scaled. The management tooling didn't.

Three specific things got harder, and each one is a place todo lists break:

- **Work runs in parallel.** Multiple workstreams mean ordering and dependencies matter. A flat list has no way to say _this before that_.
- **Context dies between sessions.** When work resumes days later — or in a fresh agent session that remembers nothing — the plan has to have been written down, not remembered.
- **Work spans repositories.** One person now maintains several projects at once. A single file in a single project isn't the shape of the problem.

## Why the two obvious answers don't fit

**Hosted project management is overkill.** Tools like Linear and Jira are built to coordinate people, and coordination is most of what you pay for in setup cost and process surface. A solo developer has none of the problems that ceremony solves. Worse, the plan ends up on the far side of a network boundary from the code it describes — so when you want your coding agent to see it, you build a bridge. That bridge is the tell. Wiring an MCP server between an agent and a hosted tracker is a lot of machinery to carry context across a wall that didn't need to exist.

**Todo lists are underkill.** They have the right access model — a file in the repository, readable by anything — and no structure to hold state. No status, no priority, no dependencies, no ordering, no validation. Nothing stops a plan from drifting out of sync with reality, so it does.

## The premise

Your repository already contains your code, your documentation, and your architecture decisions. **ShipBench's premise is that your project plan belongs there too.**

Not adjacent to the repository. Not synced with it. Inside it — a [`.shipbench/` directory](/docs/convention-spec), versioned alongside everything else, structured enough to carry status, priority, and dependencies through an ambitious project, plain enough to stay Markdown in Git.

## What follows from that

**Context switching gets cheap.** This is the benefit that matters day to day when several projects are in flight at once. Open the repository and the plan is already there — what's in flight, what's blocked, what's next. There's no separate tool to open, no mental mapping between a workspace and a working directory, and no chance the two have diverged. The repository is the context.

**Agents read the plan with the access they already have.** No token, no MCP server, no round trip. The agent has the repository checked out, so it has the plan. This falls out of the premise rather than motivating it — the plan sits next to the code, and agents are already good at reading things next to the code. It is a consequence, and a real one, not the reason the system exists.

**Git carries it.** History, branching, and portability come free because the plan is just files. Planning changes ride along with the branch that implements them. Every clone is complete. Nothing is stranded behind a service.

**Multiple repositories work by default.** Each project carries its own plan, so there's no central system to keep in sync and nothing to set up per project beyond [`shipbench init`](/docs/quickstart). Managing more projects costs proportionally more work, not exponentially more overhead.

## What ShipBench declines to decide

ShipBench mandates a format, not a process. The required core is deliberately small: a `.shipbench/` directory, task files with frontmatter, and statuses that match the columns you configured. That's most of it.

Everything above that line is yours, and the system is built to stay out of the way:

- **Columns are configuration**, not a fixed lifecycle. A review gate, a backlog, a triage column — add them if you want them.
- **`depends_on` is data.** It records sequencing and never blocks a write or a move. You decide what to do about a blocked task.
- **`assignee` is a label.** There's no claiming, no locking, no assignment workflow — just a string, because one person doesn't need a permissions model.
- **Unknown frontmatter fields are preserved,** not stripped. If you invent a field, ShipBench passes it through untouched rather than deciding it's invalid.
- **`AGENTS.md` is scaffolded, then yours.** The instructions your agents follow are a file in your repository that you can rewrite.

This is a stance, not an omission. Structure is what todo lists lack; imposed process is what makes hosted tools expensive to adopt. ShipBench aims to supply the first without the second, and to be a foundation you build conventions on top of rather than a workflow you conform to.

## Not only for code

ShipBench doesn't assume a domain any more than it assumes a process. A task is a Markdown file with frontmatter, the columns are whatever you named them, and the repository around it doesn't have to contain a program.

That's more useful than it sounds, because Markdown quietly became the default for everything else too. It was already the working format of technical writing and much of the web. It's what developers reach for when they'd rather stay in their editor than open someone's web app — drafts, notes, documentation. And it is now the native language of AI: the format models read best and produce by default.

The rest follows on its own. Once your work is Markdown files, you want version control, because you want history and you don't want to lose any of it. Once it's in Git, you want to know what state each piece is in and what to pick up next. That's the same problem ShipBench already solves — so solve it in the same place, in the same format, with the same tools.

ShipBench is already used this way. One repository holds creative writing and tracks drafts across states; another holds the posts for a personal site and moves them from idea to published. Same `shipbench init`, same board, same CLI. The only real difference is what the columns are called.

Developers have interests outside of code, and they tend to pursue them with the tools that make them feel most capable — an editor, Git, Markdown, and now an agent. ShipBench works there because it never assumed otherwise.

## Where this came from

ShipBench began with a concrete frustration rather than a market thesis. Standing up a new hosted project for every new repository became cumbersome enough that most projects simply went untracked. Connecting coding agents to that tracker through MCP was inconsistent and disproportionate to the problem it solved. Todo lists were the obvious retreat, and too weak to hold a real project. What kept suggesting itself was portable project management — plans that travel with the work, useful to a developer context switching between repositories and legible to their agents for the same reason.

## Next

- [Overview](/docs/overview) — what ShipBench is and how the project system, CLI, local board, and ShipBench Harbor fit together.
- [Quickstart](/docs/quickstart) — initialize a repository, create a task, and open the local board.
