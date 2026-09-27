---
"@shipbench/board": minor
"shipbench": minor
---

The board now asks before you leave a task with unsaved text in the description, the Task Updates box, or an update you're editing. Every way out of the task asks first: the back button, the breadcrumb, previous and next, `j`/`k`, a link to another task, the archive, and Escape. "Keep editing" leaves everything as it was, and "Discard" continues where you were going. With nothing unsaved, you leave at once as before.

While text is unsaved, reloading or closing the tab also shows the browser's leave prompt. The board adds that prompt only while something is unsaved, so an embedding page's unload behavior is otherwise unchanged. Read-only boards have no editors and never ask.
