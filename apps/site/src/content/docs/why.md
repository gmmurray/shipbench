---
title: Why ShipBench
description: Why ShipBench exists, what I tried before building it, and what it does instead.
group: Getting Started
order: 0
updated: 2026-09-24
---

I built ShipBench while trying to keep several of my own projects moving at a time when AI coding tools were changing every few months. Most of what I tried along the way was just the newest thing those tools made possible. Each one got me a little closer to what I wanted without quite getting there.

## What I tried first

The first attempt was Linear, connected to the Claude chat app. I knew I wanted AI to create tasks for me, so I'd set up a project and then work with the model on sample tasks and rules it should follow when it added new ones. It sort of worked. Plenty of operations were clumsy through the integration, especially early on, and setting up a Linear project took about as much effort as setting one up for a real project at work. That makes sense, because that's who Linear is for: teams of real people who need integrations, charts, roles, and permissions. I didn't need any of that and still had to configure around it. Linear was probably the closest fit anyway, since it's built with developers in mind. It just isn't built for one developer working with AI.

The next step was more of a half step: the same setup, but with Claude Code and other coding agents reaching Linear over MCP. That put the tasks closer to the code, and the rules for how tasks should be written could live in the repository instead of somewhere in Linear. Otherwise it had the same problems.

At the other end were plain task lists in the repository. Agents were creating these on their own at the time, and the nice side effect was that they lived in version control. But a list has no structure, and agents tended to write far more into it than a list can hold, because a real task needs more context than one line.

Then there were spec and milestone documents, where you lay out the steps to build the whole project up front. That's waterfall to begin with, and once agents start adding their own context it turns into a thousand-line Markdown file that nobody, me included, is ever going to read.

## What ShipBench does instead

ShipBench gives each task its own Markdown file in the project's repository, inside a `.shipbench/` folder. The frontmatter holds what tools need to check and sort: status, priority, tags, dependencies. The body holds whatever the task needs, whether that's one sentence or a few pages. One file per task is big enough that a task's context has somewhere to go, and small enough that no single file grows into the spec nobody reads.

Setting it up is [`shipbench init`](/docs/quickstart/), which I now run about as automatically as `git init` or `pnpm init`. Even a tiny project gets a board, because there's nothing to sign up for and nothing to host. The CLI and the local board read and write the same files, and so do agents, using the instructions `init` writes to `.shipbench/AGENTS.md`. None of that requires an agent. It works the same if you do everything by hand.

It also fixed a smaller annoyance I hadn't thought of as a planning problem. I once tried to build a kind of command center to keep track of all the links for each of my projects, and a hosted board was one more link on that list. When the board lives in the repository, it's already where everything else is. And since tasks are documents, they're a reasonable place to keep those links too.

## What it doesn't decide

ShipBench is opinionated about the file format and not much else. The required part is small: a `.shipbench/` directory, task files with frontmatter, and statuses that match the columns you configured. The rest is up to you.

- **Columns are configuration.** Add a review gate, a backlog, or a triage column if you want one.
- **`depends_on` is data.** It records order and never blocks a write or a move. What to do about a blocked task is your call.
- **`assignee` is a label.** There's no claiming or locking, because one person doesn't need a permissions model.
- **Unknown frontmatter fields are kept.** If you invent a field, ShipBench passes it through untouched.
- **`AGENTS.md` is scaffolded, then yours.** The instructions your agents follow are a file you can rewrite.

The [workflow pages](/docs/workflows/) show what a few of those choices look like once you've made them.

## Not only code

A task is a Markdown file and the columns are whatever you name them, so nothing in ShipBench assumes the repository holds a program. I use it to track creative writing ideas and drafts, and the posts for a personal site move from idea to published on a board too. It's the same `shipbench init`, the same board, and the same CLI. The columns just have different names.

## Something I didn't plan for

One of the most useful things ShipBench does for me now wasn't a reason I built it. When agents write tasks and [Task Updates](/docs/convention-spec/#task-updates), they're good about linking to related tasks and noting where a decision came from. Later I can ask an agent something like "how did we decide to build this in the first place?" It can use [`shipbench task search`](/docs/cli-reference/#shipbench-task-search) and those links to walk back through the tasks that led there, going as deep as the question needs. What comes back is close to documentation of how the project got its shape.

That isn't really a feature. Nothing records it automatically, and it only works as well as what got written down. It comes from tasks being ordinary files with a few rails around them.
