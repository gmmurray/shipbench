---
'shipbench': patch
---

Clearing a task's priority or assignee on the board served by `shipbench board` now saves. Before, the field emptied and then came straight back, because the change never reached the file.
