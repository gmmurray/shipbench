---
"@shipbench/core": minor
"shipbench": minor
---

Stop an unreadable Updates section from eating the description it sits under. When the trailing `## Task Updates` section did not parse, core returned the entire raw body as `Task.body` — the field documented as "Timeless task description, excluding the reserved trailing Task Updates section" — and every consumer that trusted that comment inherited the damage.

The sharpest consequence was silent data loss: `task edit --body` on such a task succeeded, reported success, and deleted the whole section, good entries included, because the raw text lived in `body` and the write serialized an empty `comments` over it. The description guard could not catch it, since the incoming body was clean. Git was the only trail.

Core now keeps the split it already computed. `Task.body` is the description above the marker; the section is quarantined verbatim on a new optional `Task.unreadableUpdates` (`{ text, reason }`) and written back byte-identical on every write. A frontmatter or description edit can no longer drop it, the Board's description editor holds a real description again, and `task search` stops matching broken entry text as if it were the description. Comment mutations still refuse a task in this state — appending to a section that cannot be read would leave it just as unreadable.

The warning now names the line that broke the parse rather than only the rule, and `unreadableUpdatesWarning` builds it from a single task, so `shipbench task get` reports it too. That was the narrowest read — the one agents are told to prefer — and it used to say nothing at all, because validation ran only over a whole directory. `task get --json` carries the quarantined section as `unreadable_updates`.

Consumers reading `Task.body` for a malformed task will see a shorter string than before: the description, without the section appended.
