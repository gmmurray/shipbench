---
"@shipbench/board": minor
"shipbench": minor
---

The board's search box now finds tasks by their descriptions and Task Updates, as well as their titles, slugs, assignees, and tags. It matches the way `shipbench task search` does: every term, or double-quoted phrase, has to appear somewhere in the task.

When a match is only in a task's content, the card shows where it was found: a snippet of the description, or the matching Update's excerpt and timestamp, with a count of any other matching Updates. Search still hides cards without reordering columns. The empty state now lists what search covers, and the archive view's filter works the same way.
