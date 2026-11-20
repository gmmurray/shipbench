---
'@shipbench/core': minor
---

`initProject` takes a required `version`, which it stamps into the first line of the scaffolded `README.md` and `AGENTS.md`. It rejects an empty value or one containing whitespace or a colon. `InitProjectResult` gains `scaffold`, listing whichever of those two files exist with the version each one's stamp records, or `null` when it has none. The new `readScaffoldStamp(content)` reads the stamp from a file's text.

**Breaking:** pass `version` to `initProject`, normally the version of the ShipBench release your host ships with.
