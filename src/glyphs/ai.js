// Bespoke glyph adapter: loads an in-repo monochrome SVG from the preset's
// glyphs/ai/ dir and normalizes it to the shared contract (viewBox 0 0 64 64,
// fill=currentColor). Authored SVGs should already meet the spec (see AGENTS.md);
// this normalization is a safety net, not a transform pipeline.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const VIEWBOX = '0 0 64 64';

/** @param {{ glyphsDir: string }} opts */
export function createAiResolver({ glyphsDir }) {
  return function resolveAi(name) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
      throw new Error(`Invalid ai glyph name: ${name}`);
    }
    const path = join(glyphsDir, `${name}.svg`);
    let raw;
    try {
      raw = readFileSync(path, 'utf8');
    } catch (err) {
      throw new Error(`ai glyph not found: ${name} (${path}): ${err.message}`);
    }
    return normalize(raw, name);
  };
}

function normalize(raw, name) {
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) throw new Error(`ai glyph is not valid SVG: ${name}`);
  let svg = match[0];
  // Force the shared viewBox + currentColor fill on the root element.
  svg = svg.replace(/viewBox="[^"]*"/i, `viewBox="${VIEWBOX}"`);
  if (!/viewBox=/i.test(svg)) {
    svg = svg.replace(/<svg/i, `<svg viewBox="${VIEWBOX}"`);
  }
  return svg;
}
