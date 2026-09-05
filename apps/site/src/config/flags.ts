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
 * Flipping this to true is the launch step, and it takes two edits Markdown
 * cannot make for itself. Do both; the suite will not hold you to it.
 *
 *   1. src/content/docs/overview.md — restore the Harbor bullet at the foot of
 *      the Reference list, beside the convention-spec and cli-reference ones.
 *   2. The root README — on Harbor's bullet, *replace* the sentence "Not yet
 *      deployed; its page returns once it is." with the [Docs] link to
 *      https://shipbench.dev/docs/harbor. Restoring the link without deleting
 *      that sentence ships a live link next to a denial that the page exists.
 *
 * src/test/docs-routes.test.ts catches the damaging direction — a link to a
 * page this build omits — in every file it scans. The direction it checks back
 * the other way is reachability, not a checklist: one link anywhere satisfies
 * it, so doing step 2 alone turns the suite green with step 1 still undone.
 * Hence the list.
 */
export const HARBOR_ENABLED: boolean = false;
