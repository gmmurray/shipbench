---
title: Update package READMEs and npm descriptions to the approved copy
status: done
priority: low
tags:
  - docs
  - copy
  - packages
depends_on:
  - rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page
created: '2026-09-24T23:00:52.570Z'
updated: '2026-09-26T19:59:13.771Z'
---

Bring the package surfaces in line with the copy approved in [rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page](rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page.md).

- READMEs for `apps/cli`, `packages/core`, and `packages/board`. Board's README has to keep saying it isn't a supported standalone library.
- npm `description` fields in the three `package.json` files. Check [docs/releasing.md](../../docs/releasing.md) for whether a metadata-only change needs a changeset.
- Text for the GitHub repository description. The descriptor is "Git-native project management for solo developers." The owner sets it by hand, so put the proposed text in this task.

Follow AGENTS.md › Naming and branding for the tagline and descriptor.

## Task Updates

### 2026-09-26T19:57:56.397Z
Done, ready for review.

- **`apps/cli/README.md`.** The top now carries the tagline, followed by the descriptor and a plain account of what the CLI does, replacing "one source of truth" and "no service". The command table gains `shipbench board terminal`. The documentation list gains the why page and Tracing a Decision. I checked the table's claims against `--help` output.
- **`packages/core/README.md`.** The opening sentence now matches the approved description. "The board never silently loses work" is now what actually happens: a typo in a hand-edited status doesn't make a task disappear. I checked that every export the README lists exists in `packages/core/src/index.ts`.
- **`packages/board/README.md`.** No change. It already says it isn't a supported standalone library, and that's still accurate.
- **npm descriptions.** The CLI's is now "Git-native project management for solo developers. Each task is a Markdown file in your repository, with a CLI and a local board on top." Core's and board's already describe what the packages are, so I left them alone.
- **No changeset.** Per `.changeset/README.md`, changes that leave published behaviour unchanged don't need one. Seven changesets are already pending, so these README and description edits reach npm with the next release.

**Proposed GitHub repository settings, for the owner to set by hand:**

- Description: `Git-native project management for solo developers.` (the descriptor, as AGENTS.md specifies)
- Website: `https://shipbench.dev`
- Topics: `project-management`, `task-management`, `kanban`, `markdown`, `git`, `cli`, `developer-tools`

The CLI (292), full workspace (766), and site (122) test suites pass.
