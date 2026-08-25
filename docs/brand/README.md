# Brand assets

`logo-mark.svg` is the ShipBench mark on no ground — the source every shipped
form is cut from. Nothing renders this file directly; it exists so the paths
have one home when the mark is redrawn or handed to a designer.

Three forms derive from it. The standalone and raster forms are generated; the
in-page symbol mirrors the same geometry with theme-token fills:

| Form | Lives in | Ground | Colors |
| ---- | -------- | ------ | ------ |
| Source | `docs/brand/logo-mark.svg` | none | dark-theme values |
| In-page | the `#logo` symbol in `apps/site/src/components/IconSymbols.astro` | none | theme tokens — inverts with the theme |
| Standalone | `apps/site/public/logo.svg` | `canvas` tile | baked, generated |
| Raster | the site's platform icon PNGs | `canvas` tile | baked, generated |

Harbor lives in its own repository and keeps its own generated set cut from the
same source. The mark is the shared artifact; the generators are not.

The split exists because an `<img src="/logo.svg">` is an isolated document: it
inherits neither custom properties nor `currentColor`, so a mark used that way
cannot follow the theme. Contexts with a page use the symbol; contexts without
one (favicon, social image, README embed) use the standalone file and pay for it
with baked colors. See [design-doctrine.md](../design-doctrine.md) › Iconography.

## Generated brand assets

Everything with baked colors derives from `logo-mark.svg`:

```bash
pnpm --filter @shipbench/site exec playwright install chromium   # once
pnpm generate:brand
```

`generate:brand` runs both focused generators. Use `pnpm generate:icons` for the
standalone SVGs and platform icon sets, or `pnpm generate:og` for the social
cards. The inputs and renderers live in [`scripts/brand/`](../../scripts/brand/)
and [`scripts/og/`](../../scripts/og/). Outputs are committed and deliberately
not wired into either app build: changing a mark should require an explicit,
reviewable regeneration, while ordinary builds should not require Chromium.

The site ships a 32px PNG favicon alongside its preferred SVG one, the 180px
Apple touch icon, and 192px/512px manifest icons. There is intentionally no 16px
output: 20px is the mark's documented floor, and the owner chose omission over
an invented optical variant. There is no `.ico` either — the site never needed
one, and the encoder that built Harbor's went with Harbor.

## OpenGraph cards

`apps/site/public/opengraph.png` is **generated**, not hand-exported:

```bash
pnpm --filter @shipbench/site exec playwright install chromium   # once
pnpm generate:og
```

The inputs live in [`scripts/og/`](../../scripts/og/) — `cards.ts` holds the
copy and output paths, `template.ts` holds the one shared layout, and the mark
comes from `logo-mark.svg` in this directory. Edit copy in `cards.ts`, re-run,
commit the PNGs. It is not wired into `astro build`: the cards change a few
times a year, and building the site should not require a Chromium download.

The template is HTML/CSS rather than SVG because the brand fonts ship as woff2
only, which the non-browser rasterizers can't read — so a browser has to render
it either way, and HTML buys real wrapping instead of `<text>` that silently
overflows when copy changes.

Each card's `og:image:alt` lives with the app that serves it, not in `cards.ts`.
Changing a headline means updating the matching alt; `cards.ts` notes where.

**20px is the mark's floor.** Below that the sails merge and the two-tone
separation is lost; smaller slots take a Radix glyph instead.
