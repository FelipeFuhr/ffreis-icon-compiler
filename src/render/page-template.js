// HTML page builder.
//
// Contract:
//   buildPageHtml({ componentHtml, componentCss, glyphSvg, def, theme }) -> string
//     Wraps the deck-key component + inlined glyph into a full standalone HTML
//     document ready for Playwright to screenshot. Pure: string in, string out —
//     no Playwright here.
//
// Resolution strategy (AA-friendly, resolution-independent):
//   The component is authored in `rem` against a 16rem key. We fix a large design
//   base — DESIGN_PX — and set `:root { font-size: DESIGN_PX/16 px }`, so the key
//   always lays out at DESIGN_PX CSS px regardless of the requested output size.
//   The renderer then rasterizes at `deviceScaleFactor = size / DESIGN_PX`, so the
//   same high-precision layout downscales to exactly size x size device px. Keeping
//   everything in rem means any output size renders crisp from one source.

/**
 * Design edge length in CSS px (the 16rem key lays out at this size). The renderer
 * imports this to compute deviceScaleFactor = size / DESIGN_PX. 256 > the common
 * 100px output, so small sizes downscale from a higher-precision layout.
 */
export const DESIGN_PX = 256;

const REM = 16; // the key is authored at 16rem
const ROOT_FONT_PX = DESIGN_PX / REM; // 256/16 = 16px

/** Minimal HTML-text escape for the label (trusted config, but text content). */
function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** Replace every `{{token}}` occurrence with a literal value (no regex `$` traps). */
function fill(template, token, value) {
  return template.split(`{{${token}}}`).join(value);
}

/**
 * @param {object} args
 * @param {string} args.componentHtml - templates/deck-key/component.html (token source)
 * @param {string} args.componentCss  - templates/deck-key/component.css (inlined <style>)
 * @param {string} args.glyphSvg      - inline <svg viewBox="0 0 64 64" fill="currentColor">…
 * @param {{ id: string, label?: string, accent: string, nav?: boolean }} args.def
 * @param {{ palette: Record<string, { hex: string, rgb: string }> }} args.theme
 * @returns {string} standalone HTML document
 */
export function buildPageHtml({ componentHtml, componentCss, glyphSvg, def, theme }) {
  const accent = theme?.palette?.[def.accent];
  if (!accent) {
    throw new Error(`accent "${def.accent}" not found in theme.palette (key "${def.id}")`);
  }

  let component = componentHtml;
  component = fill(component, 'accentHex', accent.hex);
  component = fill(component, 'accentRgb', accent.rgb);
  component = fill(component, 'navClass', def.nav ? 'deck-key--nav' : '');
  component = fill(component, 'glyphSvg', glyphSvg); // trusted SVG — inject verbatim
  component = fill(component, 'label', escapeHtml(def.label ?? ''));

  // Base layer: reset + resolution-independent rem base + an OVERRIDABLE fallback
  // frame so the key has a defined box even before component.css sizes it. The
  // component stylesheet is inlined AFTER this block, so any rule it declares at
  // equal-or-higher specificity wins the cascade.
  const baseCss = `
* { margin: 0; box-sizing: border-box; }
html, body { overflow: hidden; }
html, body { width: 100%; height: 100%; background: #050b13; }
:root { font-size: ${ROOT_FONT_PX}px; }
body {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: system-ui, "Inter", "Roboto", Arial, sans-serif;
}
/* Fallback design frame — component.css overrides width/height/appearance. */
.deck-key { position: relative; width: 16rem; height: 16rem; }
.deck-key__icon svg { width: 100%; height: 100%; display: block; }
`.trim();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${baseCss}
</style>
<style>
${componentCss}
</style>
</head>
<body>
${component}
</body>
</html>`;
}
