# Multiple boards in one repository: spike

**Date:** 2026-09-26
**Task:** `spike-run-multiple-shipbench-boards-in-one-repository`
**Scope:** what happens when one Git repository holds more than one
`.shipbench/` directory, across every CLI command, the browser and terminal
boards, `init` and `connect`, Harbor's reads, and agent instructions. Views
across repositories belong to
[the local workbench spike](../../.shipbench/tasks/spike-explore-a-local-workbench-across-shipbench-repositories.md).
**Method:** probed against the CLI rebuilt at `21822ab` (0.4.0) in a throwaway
repository with a root board, `packages/api/.shipbench/`, and
`site/.shipbench/`, plus a second repository whose only board is nested. Code
read where probing could not reach: `apps/cli/src/processCli.ts`,
`boardServer.ts`, `harborConnect.ts`, `tui/watch.ts`, core's path constants,
`packages/board/src/utils/links.ts`. Harbor's source is not in this repository,
so its behavior is inferred from what `connect` sends and what core's
`GitHubAdapter` can read.

---

## Verdict

**Nested `.shipbench/` directories are the shape, and they already work in
every local client with no code changes.** Don't build several boards inside one
`.shipbench/`, and don't build a board registry or selector.

A board is already defined by the directory its adapter is rooted at. Core never
learns where the Git root is, so a board in `packages/api/` is as complete and
independent as one at the root. `init` creates one, `-C` reaches one, and two can
be served at once. Nothing in core has to change.

Three things are worth doing:

1. **Fix `connect` and `init --harbor` from a nested board.** This is a real
   defect. Run from a subdirectory, they check the wrong path, connect the
   repository anyway, and leave the user thinking Harbor will show a board it
   cannot read. (Section 3.)
2. **Document the pattern.** It works, but nothing says so, and the part that
   makes it usable with agents (a routing note in the root instructions) is not
   obvious. (Section 5.)
3. **Decide on nearest-board discovery.** The CLI only looks in the current
   directory, so running inside `packages/api/src/` fails with a raw `ENOENT`.
   That already hurts single-board repositories. Nested boards make it more
   visible. This one changes behavior for every user, so it goes to the backlog
   as a decision rather than a build. (Section 4.)

---

## 1. What each surface does today

| Surface | Behavior with nested boards | How established |
| --- | --- | --- |
| `init` in a subdirectory, or `-C sub init` | Creates an independent board named after the directory (`api`, `site`). Says nothing about a board in a parent directory. | Probed |
| `task *` with `-C packages/api`, or run from `packages/api/` | Reads and writes that board only | Probed |
| `task *` from a directory with no `.shipbench/` of its own, including `packages/api/src/` | Fails with a raw `ENOENT ... packages\api\src\.shipbench\config.json`. No stray files are written, `task create` included. | Probed |
| Root board `task list` / `task search` | Never sees nested tasks | Probed |
| `depends_on` naming a task on a sibling board | Rejected: `Unknown dependency "api-task"` | Probed |
| Slugs | Independent namespaces. Each board has its own `welcome-to-shipbench`. | Probed |
| `board` twice | The second server falls back from 4321 to 4322. Each serves its own tasks, and editing the api board fires `tasks-changed` only on the api board's event stream. | Probed |
| Board window title | Comes from `config.name`, which defaults to the directory name, so two tabs are distinguishable | Code |
| `board terminal` outside a board | Friendly message: `No .shipbench/config.json found. Run shipbench init first.` | Probed |
| Board theme preference | Stored per origin, so per port. The board that starts first gets 4321 and whatever theme was saved there. | Code |
| `connect` / `init --harbor` from a subdirectory | Checks the repository root's `.shipbench/config.json`, then connects the whole repository | Probed (Git check), code (request) |
| Harbor | Reads `.shipbench/` at the repository root. Nested boards are invisible. | Code; Harbor not in this repo |
| Scaffolded `AGENTS.md` | Assumes the agent runs at the board root and never mentions `-C` | Code |

Worktrees need nothing new. The canonical checkout target gets a subdirectory
(`-C ../main/packages/api`), and each board stays branch-local under the same
rules. Not probed, because it's the same `-C` path arithmetic the root board
already uses.

---

## 2. The shapes compared

### A. Nested `.shipbench/` per directory (recommended)

- **Convention:** unchanged. Each board is a normal `.shipbench/` directory.
- **Core:** unchanged. The adapter root is the board root.
- **CLI and Board:** unchanged, except for the `connect` defect and the discovery
  question.
- **Costs:** Harbor sees only the root board. Agents need to be told which board
  owns which code. Tasks can't depend on a task on another board.

### B. Several boards inside one `.shipbench/` (for example `.shipbench/boards/<id>/`)

This rewrites the convention's one fixed fact: tasks live at
`.shipbench/tasks/`. That path is hard-coded in core (`tasks.ts`, `config.ts`,
`init.ts`), in the CLI (`tui/paths.ts`, `tui/watch.ts`, `harborConnect.ts`), and
in the Board's link resolver (`TASK_DIR`). It is also hard-coded in every
`AGENTS.md` an agent follows and in every hand edit a person makes. Every command
would need a board selector. Every existing reader, including an agent working
from plain files, would read the new layout wrong until updated.

The only thing B fixes that A doesn't is Harbor discovery, and it does that by
moving a path problem into the convention. Rejected.

### C. One board partitioned by tag

This works today: `--tag` on `task list`, `task search`, and `board terminal`,
and Board search matches tags. It is the right answer when the parts share one
workflow and have dependencies between them, because `depends_on` only works
inside one board.

It is the wrong answer when the parts need different columns, a separate `done`
history, or different agent instructions. There is only one `config.json`, one
done cap, and one `AGENTS.md`.

### The rule the docs should give users

Use **one board with tags** when the work shares a workflow and has
dependencies across parts. Use **nested boards** when the parts differ in
columns, cadence, or agent instructions, and accept that they can refer to each
other only in prose.

---

## 3. The `connect` defect

`collectGitVisibilityWarnings` runs `git cat-file -e HEAD:.shipbench/config.json`
with the project directory as its working directory. Git resolves a `HEAD:path`
spec from the repository root, not from that directory. The request then sends
only `{ remote_url }`, and Harbor reads the root `.shipbench/`.

This produces two failure modes. Both were verified at the Git level.

- **Nested board only.** From `packages/api/`, `HEAD:.shipbench/config.json`
  fails even though `packages/api/.shipbench/config.json` is committed
  (`HEAD:./.shipbench/config.json` succeeds). The user gets a false "absent from
  HEAD" warning. The repository connects anyway, and Harbor shows setup
  instructions for a root board that doesn't exist.
- **Root and nested boards.** From `packages/api/`, the check passes against the
  root board. The repository connects, Harbor shows the root board, and the user
  believes they connected `api`.

`init --harbor` has the same flaw, and it would first create the nested board.

**Fix:** before contacting Harbor, and before `init --harbor` writes anything,
refuse when the project directory is not `git rev-parse --show-toplevel`. Say
that Harbor reads the board at the repository root. Use exit 2, like the other
pre-flight refusals. Correcting the path spec alone would silence the false
warning but still connect the wrong board.

If Harbor ever reads nested boards, core's part is small: an optional base path
on `GitHubAdapter`. Harbor would also need a board path stored per project. That
is Harbor's decision, and it belongs with
[the Harbor-role spike](../../.shipbench/tasks/spike-define-harbor-s-contribution-to-choosing-and-resuming-projects.md).
Nothing here should build ahead of it.

---

## 4. Discovery: the CLI only looks in the current directory

`resolveProjectDirectory` returns the shell's working directory, or the `-C`
target, and never walks up. `git` finds its repository from any subdirectory,
and users expect the same here. An agent editing `packages/api/src/` that runs
`shipbench task list` gets an `ENOENT` stack message rather than the api board.

The obvious design is to find the nearest ancestor with `.shipbench/config.json`,
stopping at the Git worktree top level. With nested boards, that routes an agent
to the right board by where it is working, which is most of what the routing
note in Section 5 does by hand. Open questions:

- Should writes say which board they resolved to? Without that, a write from a
  directory with no board of its own lands on an ancestor board silently.
- `init` must not walk up. It creates a board where it runs. Should it mention
  an ancestor board, since running `init` in a subdirectory by mistake creates a
  second board without any warning today?
- Does `-C` set the start of the walk, or name the board exactly? Exact is
  safer for agents that already use `-C` to reach the canonical checkout.
- Does the Board server's `Serving .shipbench/ from <dir>` line already cover
  the "which board" question for `board`?

Whatever is decided, the raw `ENOENT` should become the message `board` already
prints.

---

## 5. Agents: the zero-code routing note

Each board's `.shipbench/AGENTS.md` is correct for that board, but an agent
starting at the repository root reads the root instructions. Whether it ever
sees a nested `AGENTS.md` depends on the tool. The root instructions need a
short routing block, which is the same zero-code option the workbench spike
names for sibling repositories:

```markdown
## Task boards

This repository has two ShipBench boards. Use the one that owns the code you
are changing, and follow that board's `.shipbench/AGENTS.md`:

- `packages/api/`: `shipbench -C packages/api task list --available --json`
- `site/`: `shipbench -C site task list --available --json`

A task on one board cannot depend on a task on the other. Link to it in the
description instead.
```

---

## 6. Relationships across boards

`depends_on` across boards is rejected, and that is the right boundary. The
rule that each `.shipbench/` is self-contained is what makes a nested board
indistinguishable from a root board to core, and a cross-board slug would break
it.

Inside one repository, a relative Markdown link to a sibling board's task file
is stable. Both files are in the same commit and travel together, which is not
true across repositories. That link is the sanctioned way to point across
boards. The docs should say so.

One latent assumption to record: the Board resolves links against the **board**
root, calls the result "repo-root-relative", and clamps `..` at that root. For a
root board the two roots are the same. For a nested board they are not, but
nested boards only render in the CLI, where links show as plain paths. This
matters only if Harbor starts reading nested boards.

---

## 7. Where this meets the workbench spike

A machine-local registry keyed by repository identity would need to know that a
repository can hold several boards. The identity becomes (repository, board
path), not repository alone. Cross-board queries inside one repository are the
same problem as queries across repositories, so they belong to that spike, not
this one.

---

## Follow-ups

- `refuse-to-connect-a-board-below-the-repository-root-to-harbor`: `todo`.
  Section 3.
- `document-running-several-shipbench-boards-in-one-repository`: `todo`.
  Sections 2, 5, and 6.
- `decide-whether-the-cli-finds-the-nearest-board-above-the-current-directory`:
  `backlog`. Section 4.
