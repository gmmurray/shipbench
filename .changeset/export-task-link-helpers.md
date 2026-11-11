---
'@shipbench/core': minor
---

`@shipbench/core` exports `taskLinkTargets(markdown)`, which returns the slugs of the task files a Markdown document links to, and `tasksLinkingTo(tasks, slug)`, which returns the tasks whose description or Task Updates link to a slug. They recognise sibling, `archive/`, `../`, and `.shipbench/tasks/` paths, and skip links inside code.
