/**
 * Feature flags for the site.
 *
 * Separate from site.ts on purpose: that module reads `__SHIPBENCH_VERSION__`,
 * a build-time define Astro injects and vitest does not, so importing it from a
 * test throws before a single assertion runs. Flags are plain data with no such
 * dependency, and both the pages and the source-convention tests need them.
 *
 * Annotated `boolean` rather than inferred. A literal `false` would make every
 * `harborEnabled &&` branch dead code to the typechecker, including the ones
 * that have to keep compiling for the day the flag flips.
 */

/**
 * ShipBench Harbor is built but not yet deployed. While this is false, the site
 * doesn't describe or link to it:
 *
 * - /docs/harbor/ is left out of the build, and so out of the sidebar, the
 *   sitemap, and Pagefind's index.
 * - `:::harbor` blocks in the docs are dropped at build time by
 *   src/utils/satteri-harbor-gate.mjs, so no other page mentions Harbor.
 * - The landing page's Harbor section and the footer's Harbor link don't
 *   render, and nothing links to `harborUrl`.
 *
 * Flipping this to true is the launch step. The one place it can't reach is
 * the root README, which GitHub renders directly: on Harbor's bullet, replace
 * "Harbor isn't deployed yet." with a link to https://shipbench.dev/docs/harbor/.
 *
 * src/test/harbor-gate.test.ts fails if a docs page mentions Harbor outside a
 * `:::harbor` block, and src/test/docs-routes.test.ts fails on any link to a
 * page this build leaves out.
 */
export const HARBOR_ENABLED: boolean = false;
