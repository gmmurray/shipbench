---
'shipbench': minor
---

`shipbench connect` and `shipbench init --harbor` are removed. ShipBench Harbor, the hosted client they connected a repository to, was retired before it launched, so neither command had a working destination. The CLI now makes no outbound network requests.

**Breaking:** scripts that call `shipbench connect` now fail with an unknown-command error, and `shipbench init --harbor <url>` fails with an unknown-option error. Drop the call, or run plain `shipbench init`. Exit codes 3 and 4, which only the connect request used, no longer occur.

`init` refusals now read `ShipBench files were not modified.` without the old note that Harbor was not contacted. The `README.md` that `shipbench init` scaffolds no longer lists Harbor among the ways to work with the board.
