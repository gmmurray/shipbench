---
"shipbench": minor
---

The welcome task that `shipbench init` writes now ends with a Task Updates entry, timestamped when the board was created, and its next steps include `shipbench task comment`. A new board shows what an Update looks like and which command adds one.

Only newly initialized boards change. `init` still leaves an existing project untouched.

A fresh welcome task now starts with one Update, so an entry you append to it sits at index 1, not 0. Scripts that seed a board with `init` and then edit or delete Updates by index should account for it.
