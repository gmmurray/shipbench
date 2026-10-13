---
'shipbench': patch
---

`task create --tags` now accepts the flag more than once, like `task edit --tags` and `--depends-on`. `--tags a --tags b` used to keep only `b`; it now writes both. Tags that differ only by case are kept once, matching `task edit --tags`.
