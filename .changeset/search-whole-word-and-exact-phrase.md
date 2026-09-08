---
"@shipbench/core": minor
"shipbench": minor
---

`task search` gains two opt-in precision controls. Both narrow how a term matches and leave the corpus, ranking, and result context untouched.

- **Exact phrase.** A double-quoted run in the query — `"token exchange"` — is one term that must match contiguously. Internal whitespace matches any whitespace run, so a phrase still hits when it wraps across a line; an empty or unbalanced quote is dropped. The CLI reads the quote characters from the `<query>` argument literally, so protect them from the shell: `shipbench task search '"token exchange"'`.
- **`--whole-word`.** Matches every term — loose or quoted — on word boundaries, so `ci` stops matching `decision`, `explicit`, and `specific`.

The grammar lives in `searchTasks` in `@shipbench/core`, which now takes an optional third `TaskSearchOptions` argument (`{ wholeWord?: boolean }`); the quote grammar is parsed from the query string. The Board inherits both when it adopts the shared function. Substring, whitespace-delimited matching stays the default.

This completes the whole-word and exact-phrase matching staged by `make-cli-search-retrieve-recorded-decisions-with-useful-context`. Still staged: semantic retrieval.
