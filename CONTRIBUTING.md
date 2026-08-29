# Contributing

ShipBench is maintained by one person. That shapes what is realistic here, so
this file says it plainly rather than implying a team that does not exist.

## Issues are welcome

Bug reports, questions, and ideas are all genuinely useful — open an issue.

Useful bug reports include the ShipBench version (`shipbench --version`), your
OS, and the smallest `.shipbench/` state that reproduces the problem. A task
file's frontmatter is usually the important part.

Response times are best-effort. Silence means the maintainer is busy, not that
the issue was dismissed.

## Pull requests: open an issue first

Please discuss a change before writing it. This is not gatekeeping — it is that
a lot of what looks like an oversight in this codebase is a recorded decision,
and finding that out after building something is a bad trade for everyone.

A few live examples: dependencies between tasks are deliberately data rather
than locks, so they never gate a write or move a task between columns; the Board
imports ordering helpers from a pure `@shipbench/core/layout` subpath and never
the package root; there is no Turborepo. Each has reasoning attached, usually in
`AGENTS.md` or a task on the board.

Small, obviously-correct fixes — a typo, a broken link, a wrong command in the
docs — do not need an issue. Just open the PR.

## Working on the code

```bash
pnpm install
pnpm build        # core, board, CLI
pnpm test         # vitest across every workspace
pnpm typecheck
pnpm lint         # biome
```

CI runs typecheck, lint, tests, and a build on every pull request. The site's
Playwright harness runs only when `apps/site/**` or `pnpm-lock.yaml` changes —
see [apps/site/e2e/README.md](apps/site/e2e/README.md).

`AGENTS.md` is the orientation document for this repository: layout,
architecture, the `.shipbench/` convention, and the naming rules. It is written
for coding agents but reads fine for humans, and it is the fastest way to
understand how the pieces fit.

## Changesets

Any change that affects a published package needs a changeset:

```bash
pnpm changeset
```

`@shipbench/core`, `@shipbench/board`, and `shipbench` release together at the
same version — see [.changeset/README.md](.changeset/README.md) for why.

## Scope

ShipBench targets solo developers, and some things are settled non-goals rather
than gaps: team collaboration, permissions models, and agent orchestration baked
into the core library. `docs/spec.md` has the full list with reasoning. A
proposal that reopens one of those is not automatically unwelcome, but it needs
to engage with the argument already recorded.

## License

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).
