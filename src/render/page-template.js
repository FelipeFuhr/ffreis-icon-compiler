// HTML page builder.  STUB — implement in subagent A1.
//
// Contract:
//   buildPageHtml({ componentHtml, componentCss, glyphSvg, def, theme }) -> string
//     Wraps the deck-key component + inlined glyph into a full standalone HTML
//     document ready for Playwright to screenshot.
//
// Responsibilities:
//   - Inject `componentCss` in a <style>, plus a CSS reset (margin:0, no scroll).
//   - Set the rem design base so the component renders at `theme.size`px:
//       :root { font-size: (theme.size / 16)px }   // key is authored at 16rem
//     (A1 owns the exact AA strategy — e.g. render at a larger design px and let
//      the renderer downscale via deviceScaleFactor. Keep layout in rem either way.)
//   - Expose per-key values to the component as CSS custom properties on the root
//     or on .deck-key: --accent (hex), --accent-rgb ("r,g,b") from
//     theme.palette[def.accent]; and the label text / nav flag.
//   - Inject `componentHtml` with `glyphSvg` placed in the `.deck-key__icon` slot
//     and `def.label` in the label slot; toggle the nav badge from `def.nav`.
//
// Keep this pure (string in, string out) — no Playwright here.
export function buildPageHtml() {
  throw new Error('buildPageHtml not implemented');
}
