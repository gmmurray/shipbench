---
'shipbench': minor
---

`shipbench init` now starts `.shipbench/README.md` and `.shipbench/AGENTS.md` with a comment recording the ShipBench version that wrote them, such as `<!-- shipbench-scaffold 0.11.0: … -->`. Keep that line when you edit either file. It identifies the exact template the file started from, which `npx shipbench@<version> init` can regenerate, so you can tell your edits from template changes after an upgrade.

Running `init` on an existing project still writes nothing. It now also names each of the two files whose stamp records a version other than the one you're running. Files written by earlier versions carry no stamp and aren't mentioned.
