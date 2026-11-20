---
'shipbench': minor
---

New `shipbench validate` checks a project's structure after hand edits, a merge, or a batch of agent changes, and writes nothing. It reports problems in `config.json`, `layout.json`, and each task file, grouped by file, with a repair command where one exists. Beyond the warnings `task list` prints, it finds dependency cycles of any length, a slug used both live and in the archive, non-`.md` files in `tasks/`, and unknown config keys. `--archived` adds the archive; `--json` prints only the report on stdout.

It exits `0` when nothing is an error, `1` when anything is, and `2` when it cannot run. Warnings, such as a preserved unknown field, do not fail it.

Task read warnings now also cover a missing `title`, a malformed `created` or `updated`, non-list `tags`, and a task that depends on or relates to itself. `task edit` now repairs a `tags`, `depends_on`, or `related` value that isn't a list, instead of failing or ignoring the request.

The `.shipbench/AGENTS.md` that `shipbench init` writes now lists the command. Existing projects keep their file.
