---
title: Resuming a Project
description: Come back to a project after a break, see what finished and what can start, hand the next task to a fresh agent session, and find out why an earlier decision was made.
group: Getting Started
order: 3
updated: 2026-09-27
---

The [quickstart](/docs/quickstart/) gets you to a first task. This page follows a small project through one working session, a two-week break, and the return. It shows what the task files give you when you come back, and what they give a new agent session that knows nothing about the project.

Every command and output below comes from a real run of the ShipBench CLI. The agent sessions are real too, trimmed for length. To follow along, run the commands in an empty Git repository. You don't need to write the expense tracker for the board to end up the same.

## The project

The project is a small command-line expense tracker. It imports the CSV file a bank exports, then totals spending by month. After `init`, delete the welcome task it creates, then plan the work in four tasks:

```bash
shipbench init
shipbench task delete welcome-to-shipbench
git add .
git commit -m "Set up ShipBench"

shipbench task create "Import bank CSV exports" --priority high \
  --body "Read the CSV file the bank exports and append each row to expenses.csv as date, amount, and payee. Importing a date range that overlaps an earlier import must not create duplicates."

shipbench task create "Categorize expenses by payee" --priority low \
  --body "Assign each expense a category from a payee-to-category table kept in categories.csv, which I edit by hand."

shipbench task create "Add a monthly summary" --priority high \
  --depends-on import-bank-csv-exports \
  --body "Print total spending per month from expenses.csv, newest month first. Group by each expense's date as the import writes it; see [Import bank CSV exports](import-bank-csv-exports.md). Categories from [Categorize expenses by payee](categorize-expenses-by-payee.md) can split the totals later, but a first version doesn't need them."

shipbench task create "Chart monthly spending" \
  --depends-on add-a-monthly-summary \
  --body "Draw the monthly totals as a bar chart in the terminal."

git add .
git commit -m "Plan the expense tracker"
```

The tasks are related in two different ways.

- **`--depends-on` sets the order of work.** The summary can't start until the import is done, and the chart waits for the summary. `task list --available` and `task graph` read these.
- **A link in the description says "read this too."** The summary links to the import because it groups by the date the import writes, so whoever builds it needs to know how the import picks that date. It links to the categories task only as a future direction. The summary doesn't wait for categories, so that link has no `depends_on` behind it.

## Session one: work a task and record the decision

The first session takes the import. The task moves to `in-progress` when work starts:

```bash
shipbench task move import-bank-csv-exports --to in-progress
```

Partway through, a problem turns up. Re-importing a date range that overlaps an earlier import adds a second copy of some charges. The bank's export has two dates, a transaction date and a posting date, and the bank rewrites the transaction date when a pending charge settles. The fix is to date and match every expense by its posting date.

After the fix, the code reads the posting-date column, but nothing in it says why. So the reason goes on the task at the moment it's decided:

```bash
shipbench task comment import-bank-csv-exports "Dated each expense by the bank's posting date, not its transaction date. The bank rewrites the transaction date when a pending charge settles, so re-importing an overlapping range added a second copy of every charge that settled in between. The posting date never changes once a charge posts, so expenses now match on posting date, amount, and payee."
```

That's a [Task Update](/docs/convention-spec/#task-updates) rather than an edit to the description because it's a decision tied to a moment. The description says what the task is for, and it's still true. The Update says what happened while doing it. Writing it took one command during the work, not a report afterward.

Under the [solo trunk workflow](/docs/solo-trunk-workflow/), the verified task moves to `done`, and the code and the task file go into one commit:

```bash
shipbench task move import-bank-csv-exports --to done
git add .
git commit -m "Import bank CSV exports"
```

In this project, whoever finishes a task moves it to `done`, whether that's you or an agent. If you want to check an agent's work before it counts as finished, the [human review gate](/docs/recipe-review-gate/) adds a `review` column and reserves `done` for you.

The whole record is one file, `.shipbench/tasks/import-bank-csv-exports.md`:

```markdown
---
title: Import bank CSV exports
status: done
priority: high
created: '2026-09-27T19:05:47.560Z'
updated: '2026-09-27T19:06:05.768Z'
---

Read the CSV file the bank exports and append each row to expenses.csv as date, amount, and payee. Importing a date range that overlaps an earlier import must not create duplicates.

## Task Updates

### 2026-09-27T19:06:05.661Z
Dated each expense by the bank's posting date, not its transaction date. The bank rewrites the transaction date when a pending charge settles, so re-importing an overlapping range added a second copy of every charge that settled in between. The posting date never changes once a charge posts, so expenses now match on posting date, amount, and payee.
```

Then the project sits for two weeks.

## Coming back

Git says what was committed:

```bash
git log --oneline
```

```text
9871f76 Import bank CSV exports
772b04b Plan the expense tracker
e865325 Set up ShipBench
```

The board says where everything stands:

```bash
shipbench task list
```

```text
[todo] Categorize expenses by payee (categorize-expenses-by-payee)
[todo] Add a monthly summary (add-a-monthly-summary)
[todo] Chart monthly spending (chart-monthly-spending)
[done] Import bank CSV exports (import-bank-csv-exports)
```

Two more queries split the `todo` column into what can start and what's waiting:

```bash
shipbench task list --available
```

```text
[todo] Add a monthly summary (add-a-monthly-summary)
[todo] Categorize expenses by payee (categorize-expenses-by-payee)
```

```bash
shipbench task list --blocked
```

```text
[todo] Chart monthly spending (chart-monthly-spending)
```

`--available` lists tasks whose dependencies are all done, ranked by priority and then age. The chart is blocked because the summary isn't done yet. `shipbench task get chart-monthly-spending` shows its `depends_on`, and `shipbench task graph` shows the whole dependency graph. `shipbench board` shows the same state as columns in your browser.

Without the task files, you'd have the commit log and the code. The log says the import happened, and the code says expenses carry the posting date. Neither says what was planned next or what's waiting on what, so you'd have to remember both.

## Hand the next task to a fresh agent

A new agent session knows only what's in the repository. The first thing it needs is `.shipbench/AGENTS.md`, which `shipbench init` wrote. Whether an agent finds that file by itself depends on the tool: some read nested `AGENTS.md` files automatically, and others read only their own root instruction file. So name it in the prompt:

```text
Read .shipbench/AGENTS.md. Then pick the next task from the board, read it
and whatever it links to that you need, and tell me what you'd do first.
Don't start the work yet.
```

To avoid repeating that, add a line pointing to `.shipbench/AGENTS.md` in your repository's root instructions (`AGENTS.md`, `CLAUDE.md`, or whatever your tool reads). That file is yours, and ShipBench doesn't write to it. See [where conventions live](/docs/workflows/#where-conventions-live).

In this run, a fresh session read the instructions and then ran:

```bash
shipbench task list --available --json
shipbench task get add-a-monthly-summary
shipbench task get import-bank-csv-exports
```

The shortlist carries no descriptions, so the session loaded only the task it picked, then followed that task to the import. The import's Update told it what a month means:

> **What the linked import task adds:** its Task Update says `expenses.csv` dates are the bank's **posting date**, not the transaction date. [...] So a "month" in this summary is a posting month. A charge made on Jan 31 that posts on Feb 2 counts in February. The task says to group this way, so I would keep it and not try to recover transaction dates.

A comment in `import.js` could have explained the posting date too, but the session was planning the summary and had no reason to open the import code yet. It found the decision because the summary's description links to the import task.

Its first step was a question for you: what format the date column uses, since the repository holds no sample export. It also noticed that the categories task sits first in the column on the board, while `--available` ranks the summary first, and it went by `--available`. [Available and blocked work](/docs/cli-reference/#available-and-blocked-work) explains the difference.

From here the session works the task the way session one did: move it to `in-progress`, record decisions as Updates while it works, move it to `done`, and commit the code and the task together. To run more than one agent at a time, see [concurrent agents with worktrees](/docs/concurrent-agents/).

## Ask why

A month later, a January 31 dinner shows up dated February 2. The code shows that the import uses the posting date, but not why. You can search the tasks yourself, or ask a fresh session:

```text
Read .shipbench/AGENTS.md first. A dinner I paid for on January 31 shows up
dated February 2 after I import my bank export. Why does the import do that?
Say where your answer comes from.
```

This run's repository had the tracker's code in it. The session searched the tasks, loaded the matching one with `task get`, and read `import.js` to check it against the record. It searched with `--json`. This is the same search in text form, as you'd run it yourself:

```bash
shipbench task search "date"
```

```text
Import bank CSV exports (import-bank-csv-exports) [live · done] [body, updates]
  …and append each row to expenses.csv as date, amount, and payee. Importing a date range that overlaps an earlier import must…
  ↳ update 0 (2026-09-27T19:06:05.661Z): Dated each expense by the bank's posting date, not its transaction date. The bank re…
Add a monthly summary (add-a-monthly-summary) [live · todo] [body]
  …st month first. Group by each expense's date as the import writes it; see [Import bank CSV exports](import-bank-csv-exports.…
```

Its answer gave the reason and cited the Update by task and timestamp:

> The import was changed to work this way to stop duplicates. The bank changes a charge's transaction date when a pending charge settles. [...]
>
> **Task `import-bank-csv-exports` (status `done`), its Task Update dated 2026-09-27T19:06:05.661Z.**

It also marked the part the record didn't cover as its own inference:

> The column it skips is presumably the transaction date. I'm inferring that from the Update, since the code doesn't name that column.

The answer came from one Update written during session one.

## What this relies on

- **Someone wrote it down.** ShipBench records nothing on its own. The decision was findable because the session that made it ran `task comment`.
- **The descriptions stay true.** If the plan changes and the task doesn't, the next session reads the old plan. Keeping them current is still your job, or your agent's.
- **Links carry context.** The handoff session found the posting-date decision because the summary linked to the import. [Tracing a Decision](/docs/decision-trail/) has an instruction block that asks agents to add those links as they work.
