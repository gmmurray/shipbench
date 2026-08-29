---
title: document package publishing process
status: done
priority: medium
created: '2026-08-29T19:16:25.981Z'
updated: '2026-08-29T19:39:26.310Z'
---

## Task Updates

### 2026-08-29T19:31:55.043Z
Done 2026-08-29. New docs/releasing.md as the operational reference, cross-linked from the three places that already touched releases.

The task was a stub, so the scope call was mine: **maintainer-facing release documentation**, not user-facing docs about using ShipBench. Surveyed what already existed before writing so this adds rather than duplicates - .changeset/README.md already covers fixed-mode rationale and the no-token posture, CONTRIBUTING.md covers 'add a changeset'. Neither covers how a release actually runs.

**The gap worth closing: the trusted publisher configuration existed nowhere in the repository.** It is the single most load-bearing piece of the release setup - three per-package entries in npm's web UI - and it was reproducible only from a task update on the board. Nothing local signals when it is missing or wrong. It is now a table in the doc, with the exact fields (provider, owner gmmurray, repository shipbench, workflow release.yml) and the list of changes that invalidate it: repo rename, workflow rename or move, account move, new published package.

**What else the doc covers.** The two-merge flow and how release.yml decides which half it is doing; adding a changeset both interactively and by hand (the CLI needs a TTY, which agents do not have); authentication and why removing the token removes a silent failure rather than just tidying - pnpm falls back to a static token when OIDC is not applicable, so a token present means a broken OIDC setup publishes unattested and green; provenance living in .npmrc rather than NPM_CONFIG_PROVENANCE, with 0.1.0 as the worked example; verification against the registry rather than the workflow, including the npx board check, which is the only thing exercising the CLI resolving @shipbench/board from the registry; four real failure modes with what each actually indicates; and a checklist for adding a publishable package, which is the accumulated shape of what publish-readiness had to fix rather than an invented list.

**Deliberately not duplicated:** the fixed-mode argument stays in .changeset/README.md and is linked, not restated. Two documents explaining the same decision drift apart.

**Verification.** All three scripts the doc names exist and match what it claims they do; .npmrc is present, tracked, and contains provenance=true; the workflow trigger matches the described behaviour. Repo-wide markdown link check passes at 72 relative links resolved, 0 broken (30 site route URLs correctly skipped). Lint and 660 tests pass.

Cross-links added from .changeset/README.md, CONTRIBUTING.md, and AGENTS.md, each pointing at the operational doc from the place a reader would already be.
