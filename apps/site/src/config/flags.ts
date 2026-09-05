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
 * ShipBench Harbor is built but not yet deployed. While this is false the site
 * makes no promise it cannot keep: nothing links to `harborUrl`, the landing
 * page's Harbor section does not render, and /docs/harbor/ is left out of the
 * build — and so out of the sidebar, the sitemap, and Pagefind's index with it.
 * Pagefind indexes `dist/`, so not building the page is what removes it from
 * search; there is no second switch to remember.
 *
 * Harbor's other appearances in the docs stay either way. They explain the
 * system's shape rather than sending anyone anywhere: `init --harbor` and
 * `connect --harbor` are real commands today, and the reason to commit
 * layout.json is Harbor-shaped whether or not Harbor is reachable.
 *
 * Flipping this to true is the launch step. Two companion edits Markdown cannot
 * do for itself go with it — restore the Harbor bullet in the Reference list at
 * the foot of src/content/docs/overview.md, and the [Docs] link on Harbor's
 * bullet in the root README — but neither is yours to remember:
 * src/test/docs-routes.test.ts holds both directions, so flip the flag, run the
 * suite, and it names whatever prose still has to follow.
 */
export const HARBOR_ENABLED: boolean = false;
