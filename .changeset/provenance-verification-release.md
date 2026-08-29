---
'@shipbench/core': patch
'@shipbench/board': patch
'shipbench': patch
---

No functional changes. The package contents are identical to 0.1.0.

This release exists to exercise the release pipeline after it moved from a
long-lived npm token to GitHub OIDC trusted publishing, and to attach the
provenance attestations that 0.1.0 shipped without. Attestations are applied at
publish time and published versions are immutable, so verifying the fix required
publishing a version rather than amending one.
