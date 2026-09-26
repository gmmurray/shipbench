---
"@shipbench/core": patch
"shipbench": patch
---

Confine task slugs to the tasks directory. Core built every task path by pasting the slug into `.shipbench/tasks/<slug>.md`, and nothing checked that the slug was a single path segment, so a slug containing `../` could reach any `.md` file relative to the tasks directory, inside the repository or outside it. `shipbench task delete ../../README` deleted the README, and the board server, which decodes `%2F` in its task routes, could be sent `POST /api/tasks/..%2F..%2FREADME/unarchive` to move it out of the repository.

Every core function that turns a slug into a path (`getTask`, `updateTask`, `addComment`, `editComment`, `deleteComment`, `reorderTask`, `moveTask`, `deleteTask`, `archiveTask`, `unarchiveTask`) now rejects an empty slug, `.`, `..`, and anything containing `/`, `\`, or NUL before touching storage, with an error beginning `Invalid task slug`. The board server answers these with 400. A slug does not have to look like `slugify` output: a hand-created `My_Task.md` stays readable, movable, and deletable.

`FsAdapter` also refuses a path that resolves outside its root, for reads, writes, deletes, and listings, as a second line of defense for anything that reaches the adapter without going through core's task functions.
