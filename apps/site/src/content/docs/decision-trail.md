---
title: Tracing a Decision
description: Link related tasks and record decisions as Task Updates, so you or an agent can later work out why the project took the shape it did.
group: Guides
order: 3
updated: 2026-09-24
---

Months into a project, the question is often "why did we build it this way?" If the tasks that directed the work link to each other and record their decisions as they happen, you can answer that from the board. An agent can search for the right starting task, then follow links back through the earlier ones for as long as the question needs.

ShipBench doesn't record any of this for you. It gives you plain Markdown links between task files, a timestamped [Task Updates](/docs/convention-spec/#task-updates) section on every task, and search across both. The trail is only as good as what gets written.

## Link related tasks

Link to another task with an ordinary Markdown link to its file. Task files sit side by side in `.shipbench/tasks/`, so the path is the slug plus `.md`:

```markdown
Uses the store chosen in [Choose a storage layer](choose-a-storage-layer.md).
```

Put links wherever they explain something: in the description when the relationship is permanent, or in an Update when it arose at a particular moment. In the local board, clicking a link to a live task opens that task.

A link says the tasks are related. It doesn't say one has to finish first. For ordering, use [`depends_on`](/docs/convention-spec/#slugs-and-dependencies), which `task list --available` and `task graph` read.

## Record the decision when you make it

When a choice only makes sense against the moment it was made, append an Update to the task you were working from:

```bash
shipbench task comment choose-a-storage-layer \
  "Picked SQLite over Postgres: one file, no server, and the sync service only needs one writer."
```

A useful Update names what was decided and why, and links to any task that prompted it. It doesn't need to be long. If the fact would still be true without its date, it belongs in the description instead.

## Find it later

`task search` covers titles, tags, descriptions, and Updates, and reports which one matched. Add `--all` to include archived tasks, which is usually where old decisions end up:

```bash
shipbench task search "SQLite" --all
```

```text
Choose a storage layer (choose-a-storage-layer) [archive · done] [updates]
  ↳ update 0 (2026-09-24T18:02:11.000Z): Picked SQLite over Postgres: one file, no server, and the sync service only needs one writer.
```

Searching for a slug finds the tasks that link to it, because the link text contains the slug:

```bash
shipbench task search "choose-a-storage-layer" --all
```

From there, `shipbench task get <slug>` loads a task in full, including its links, and you can follow them one step at a time.

## Let an agent follow the trail

An agent with the repository checked out can do all of the above. A question like "how did we decide to use SQLite?" is enough: the agent searches, reads the matching task, follows its links, and stops when it has an answer.

For the trail to exist, agents also have to write it. The instructions `shipbench init` scaffolds teach Task Updates but say nothing about linking tasks. If you want agents to link as they go, paste this into your repository's root `AGENTS.md`:

```text
## Task board: leave a trail

When you create a task or write a Task Update:

- Link to related tasks with a relative Markdown link to their file, for
  example [Choose a storage layer](choose-a-storage-layer.md).
- When you make a decision, record it as a Task Update on the task you are
  working from: what you decided, why, and links to any task that led to it.

When asked why something was built a certain way, start with
`shipbench task search "<term>" --all`, read the matching tasks with
`shipbench task get <slug>`, and follow their links as far as the question
needs. Say where the answer came from, and say so plainly if the record
doesn't cover it.
```

## Limits

- Nothing is captured automatically. Decisions that weren't written down can't be found.
- Updates record what someone believed at the time. A later Update can correct an earlier one, and it's worth doing when a decision changes.
- Links to a task point at its path in `tasks/`. Once that task is archived it moves to `tasks/archive/`, so the link stops opening it on the board. `task search --all` still finds it by slug.
- The local board's search matches task titles only. Use the CLI to search descriptions and Updates.
