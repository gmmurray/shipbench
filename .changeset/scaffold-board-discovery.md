---
'shipbench': patch
---

The `.shipbench/AGENTS.md` that `shipbench init` writes now tells agents that commands work from any subdirectory of the board, and that `-C <path>` names a board's directory exactly. Existing projects keep the file they have; add the line by hand if you want it.
