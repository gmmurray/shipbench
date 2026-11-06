---
'shipbench': minor
---

Every `shipbench task` command now accepts `--json`. `task get` used to reject it as an unknown option, even though its output is already JSON. It now accepts the flag and prints the same output either way.

The commands that write a task (`move`, `comment` and its `edit` and `delete`, `flag`, `unflag`, `archive`, and `unarchive`) print the resulting task on stdout with `--json`, in the `task get` shape, instead of the confirmation on stderr. `task archive --done --json` prints an array of the archived tasks, and `task delete --json` prints `{ "slug": "<slug>", "deleted": true }`. Without `--json`, output is unchanged.

The `.shipbench/AGENTS.md` that `shipbench init` writes now mentions the flag. Existing projects keep the file they have.
