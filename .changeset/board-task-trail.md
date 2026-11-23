---
'@shipbench/board': minor
'shipbench': minor
---

After you follow a link from one task to another in the board's detail view, a "Back to *<task title>*" button takes you back to the task you came from, and you can keep going back along the chain. Links in descriptions, Task Updates, and the Related list all count. j/k doesn't add to the trail, and going back skips a task that has since been archived or deleted.

In `shipbench board`, the open task is now part of the URL (`?task=<slug>`). The browser's back and forward buttons move between tasks and the board, a reload keeps the open task, and a link to a task that no longer exists opens the board.

`createBoard` and `<Board>` take a new `navigation` option for hosts that want the open task in their own URL: a starting task, a callback when the board navigates, a way to select a task from outside, and an optional `back`. Without it, the board leaves `window.history` and the URL alone, as before.
