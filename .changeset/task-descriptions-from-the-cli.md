---
"@shipbench/core": minor
"shipbench": minor
---

Let a task's description be written and revised without hand-editing the file. `createTask` now takes an optional body, and the CLI exposes it as `shipbench task create --body <text>` / `--body-file <path>` (`-` reads stdin) alongside a new `shipbench task edit <slug>` that replaces a description whole — an empty value clears it. Both paths preserve `created`, bump `updated`, and leave `## Task Updates` alone, which removes the read-modify-write against the file the CLI just wrote.

`--body-file` is the path to prefer for anything multi-line: ShipBench opens the file itself and reads it as UTF-8, so the description never passes through shell quoting or a shell's encoding — on Windows, both a quoted argument and a pipe go through PowerShell's Windows-1252 decode and corrupt every non-ASCII character.

`createTask` and `updateTask` now reject a body containing an unfenced `## Task Updates` heading, naming `task comment` instead. Serialization writes the body verbatim, so such a heading previously turned part of a description into comments on the next read — reachable today through the Board's description editor, not only through the new flags.
