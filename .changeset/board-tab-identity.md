---
"@shipbench/board": minor
---

Name the browser tab after the project and ship a favicon, so boards open for several repos are distinguishable. The name is `config.name` — the same value the header breadcrumb renders — and the new `documentTitle` option keeps the behavior opt-in, so embedded hosts that own their own routing and tab title are unaffected.
