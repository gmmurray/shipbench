---
"@shipbench/board": minor
---

Show an unreadable Updates section in the task detail view instead of an empty one. A task whose `## Task Updates` section will not parse used to render as "Task Updates 0" with nothing to explain it, because the Board displayed only `depends_on` warnings — so the corruption was invisible in the Board and in Harbor, which inherits the same rendering and is read-only.

The section now reports itself: the count reads `unreadable`, the reason the parse failed is announced as an alert, and the preserved text is shown verbatim in a `pre` rather than rendered as Markdown, since rendering it would hide the very markup that broke it. The add-update form is hidden while the section is in this state, matching core, which refuses those mutations until it parses.

The read-only shortcut that hid an empty Updates section no longer applies when the section is unreadable. Harbor is read-only everywhere, which makes it the host that most needs this to stay visible.
