// The OpenGraph card template. One layout, parameterized by copy — see cards.ts
// for the content and generate.ts for the raster step.
//
// This is HTML/CSS rather than an SVG template. The obvious reason to prefer
// SVG would be renderer-independence, but that is already lost: the brand fonts
// ship from fontsource as woff2 only, and the non-browser rasterizers (resvg's
// fontdb, librsvg via sharp) read TTF/OTF, not woff2. Given a browser has to do
// the rendering either way, HTML buys real line-wrapping and real font metrics
// instead of hand-positioned <text> that silently overflows when copy changes.
//
// Colors are literal rather than tokenized: the card is always dark (it renders
// to a PNG with no page and no theme), and duplicating six hex values here beats
// wiring a build-time dependency on either app's stylesheet.

export interface CardSpec {
  /** Small uppercase mono line above the headline. */
  kicker: string;
  /** The line that carries the message. Wraps; keep it short. */
  headline: string;
  /** Mono line under the rule. Must not restate the headline or og:title. */
  subhead: string;
}

// Doctrine › Palette (dark column).
const CANVAS = '#18171C';
const SURFACE = '#1E1D24';
const DIVIDER = '#2A2F44';
const IRON = '#626B91';
const SILVER = '#AAA7BA';
const FROSTED = '#F7F5F7';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export interface FontFace {
  family: string;
  weight: number;
  /** base64-encoded woff2 */
  data: string;
}

function fontFaceCss(fonts: FontFace[]): string {
  return fonts
    .map(
      font => `@font-face {
      font-family: '${font.family}';
      font-weight: ${font.weight};
      font-style: normal;
      font-display: block;
      src: url(data:font/woff2;base64,${font.data}) format('woff2');
    }`,
    )
    .join('\n');
}

export function buildCardHtml(
  spec: CardSpec,
  markDataUri: string,
  fonts: FontFace[],
): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  ${fontFaceCss(fonts)}

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: ${CARD_WIDTH}px;
    height: ${CARD_HEIGHT}px;
    background-color: ${CANVAS};
    /* Doctrine › Global page background: the same faint blueprint grid the
       apps draw, so a shared card looks like it came off the same bench. */
    background-image:
      linear-gradient(to right, ${DIVIDER}1A 1px, transparent 1px),
      linear-gradient(to bottom, ${DIVIDER}1A 1px, transparent 1px);
    background-size: 40px 40px;
    font-synthesis: none;
    -webkit-font-smoothing: antialiased;
  }

  .card {
    position: absolute;
    inset: 56px;
    display: flex;
    flex-direction: column;
    padding: 40px;
    background: ${SURFACE};
    border: 1px solid ${IRON};
    border-radius: 4px;
  }

  /* align-self is load-bearing: as a column flex item the img otherwise
     stretches to the card width, and the mark's own preserveAspectRatio then
     centers the ship inside that box instead of setting it flush left. */
  .mark { height: 104px; width: auto; align-self: flex-start; }

  .kicker {
    margin-top: 34px;
    font-family: 'Intel One Mono';
    font-weight: 500;
    font-size: 20px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: ${SILVER};
  }

  /* 68px, not the 76px the line would carry, deliberately. At 76px the current
     headline measures 1004.5px inside a 1006px box — visually fine, but 1.5px
     from wrapping, so a Chromium metrics change could silently flip the card to
     two lines between regenerations. 68px leaves ~100px of slack. Longer copy
     still wraps, and text-wrap:balance splits it evenly; the spacer absorbs it. */
  .headline {
    margin-top: 26px;
    font-family: 'IBM Plex Sans';
    font-weight: 600;
    font-size: 68px;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: ${FROSTED};
    text-wrap: balance;
  }

  /* Pins the rule + subhead to the bottom whatever the headline wraps to. */
  .spacer { flex: 1; min-height: 32px; }

  .rule { height: 1px; background: ${DIVIDER}; }

  .subhead {
    margin-top: 26px;
    font-family: 'Intel One Mono';
    font-weight: 400;
    font-size: 22px;
    letter-spacing: 0.01em;
    color: ${SILVER};
  }
</style>
</head>
<body>
  <div class="card">
    <img class="mark" src="${markDataUri}" alt="">
    <p class="kicker">${escapeHtml(spec.kicker)}</p>
    <h1 class="headline">${escapeHtml(spec.headline)}</h1>
    <div class="spacer"></div>
    <div class="rule"></div>
    <p class="subhead">${escapeHtml(spec.subhead)}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
