---
"@shipbench/board": minor
"shipbench": minor
---

A page that embeds the board can now fit it under its own app bar or inside a panel by setting two CSS custom properties on the mount element or any ancestor. `--sb-viewport-h` is the height the board treats as its viewport, and defaults to `100vh`. `--sb-sticky-top` is where the board's sticky header and detail panel stop, and defaults to `0px`. With neither set, the board looks exactly as before.
