---
'shipbench': minor
---

Running `shipbench init` on an existing project now also names a scaffolded `.shipbench/README.md` or `.shipbench/AGENTS.md` that carries no version stamp, which is every file written before this release. Whenever it names a file, it links to [Upgrading ShipBench](https://shipbench.dev/docs/upgrading/), which explains how to bring the file up to date by merging in the new template, keeping your edits. The scaffold's stamp line links to the same page.
