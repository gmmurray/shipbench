---
title: Update package READMEs and npm descriptions to the approved copy
status: todo
priority: low
tags:
  - docs
  - copy
  - packages
depends_on:
  - rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page
created: '2026-09-24T23:00:52.570Z'
updated: '2026-09-24T23:00:52.570Z'
---

Bring the package surfaces in line with the copy approved in [rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page](rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page.md).

- READMEs for `apps/cli`, `packages/core`, and `packages/board`. Board's README has to keep saying it isn't a supported standalone library.
- npm `description` fields in the three `package.json` files. Check [docs/releasing.md](../../docs/releasing.md) for whether a metadata-only change needs a changeset.
- Text for the GitHub repository description. The descriptor is "Git-native project management for solo developers." The owner sets it by hand, so put the proposed text in this task.

Follow AGENTS.md › Naming and branding for the tagline and descriptor.
