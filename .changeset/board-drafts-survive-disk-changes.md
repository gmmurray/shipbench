---
"@shipbench/board": patch
"shipbench": patch
---

The board no longer loses what you're typing when the open task changes on disk. If you have unsaved changes to a title, description, or Task Update and the task file changes underneath you, the board keeps your text and says the task changed. You can load the new version, which discards your text, or keep yours. An editor with no unsaved changes still picks up the new version silently.

Editing a Task Update now stays attached to that entry when another entry is added or deleted on disk, so a save can no longer land on a different update. If the entry you're editing is itself deleted, the board keeps your text and won't save it. A pending delete confirmation also stays on the update you chose.
