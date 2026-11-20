---
'@shipbench/core': minor
---

New `validateProject(adapter, { archived })` returns a `ProjectValidationReport`: every structural problem in the project, each with a `severity` (`error` or `warning`), a stable `code`, the file `path`, and a message. It writes nothing. `resolveConfig` is the non-throwing form of `loadConfig` it builds on, returning each config validation error separately.

`TaskValidationWarning` and `ConfigLoadWarning` gain an optional `code` (`TaskWarningCode`, `ConfigWarningCode`), which core always sets, so a host can tell warnings apart without matching message text.

Task reads now also warn about a missing or blank `title`, a missing or unparseable `created` or `updated`, a `tags` value that is not a list of strings, a `depends_on` list containing non-strings, a task that depends on itself, and one that lists itself in `related`. When a read has consulted the archive, a dangling dependency's message says it matches no live or archived task.
