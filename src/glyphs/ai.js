// Bespoke glyph adapter: loads an in-repo monochrome SVG from the preset's
// glyphs/ai/ dir and holds it to the shared contract (viewBox 0 0 64 64, painted
// with currentColor). Authored SVGs should already meet the spec (see AGENTS.md).
//
// The currentColor half used to be a comment only — nothing enforced it. Every
// committed glyph happens to carry it, so the hole was latent: a new bespoke
// glyph with a hardcoded fill would render the WRONG COLOUR and fail nothing,
// which is the silent-wrong-output class config/derived.js crashes over for
// accents. So: a missing root fill is supplied (normalization), and a hardcoded
// paint is an ERROR rather than a silent rewrite — the author, not the adapter,
// decides what colour a glyph is, and the answer must be "the template's".
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const VIEWBOX = '0 0 64 64';
const FILL = 'currentColor';

/** Paint values that leave the colour to the template (or paint nothing at all). */
const INHERITED_PAINT = new Set(['currentcolor', 'none', 'inherit', 'unset', 'initial', 'revert']);

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

/** Every hardcoded `fill`/`stroke` in the markup, attribute or inline style. */
function hardcodedPaints(svg) {
  const found = [];
  for (const [, attr, value] of svg.matchAll(/\s(fill|stroke)\s*=\s*"([^"]*)"/gi)) {
    if (!INHERITED_PAINT.has(value.trim().toLowerCase())) found.push(`${attr}="${value}"`);
  }
  for (const [, styleValue] of svg.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)) {
    for (const [, , prop, value] of styleValue.matchAll(/(^|;)\s*(fill|stroke)\s*:\s*([^;]+)/gi)) {
      if (!INHERITED_PAINT.has(String(value).trim().toLowerCase())) found.push(`${prop}: ${value}`);
    }
  }
  return found;
}

function assertPaintIsInherited(svg, name) {
  const hardcoded = hardcodedPaints(svg);
  if (hardcoded.length === 0) return;
  throw new Error(
    `ai glyph "${name}" hardcodes a paint: ${hardcoded.join(', ')}. Bespoke glyphs ` +
      `must paint with ${FILL} (or none) so the template owns the colour — a ` +
      `hardcoded one renders the wrong colour and fails nothing.`,
  );
}

/** Force the shared viewBox, and supply `fill` when the root declares none. */
function withRootContract(svg) {
  const root = svg.match(/^<svg\b[^>]*>/i);
  if (!root) return svg;
  let openTag = root[0];
  const rest = svg.slice(openTag.length);
  openTag = /viewBox\s*=/i.test(openTag)
    ? openTag.replace(/viewBox\s*=\s*"[^"]*"/i, `viewBox="${VIEWBOX}"`)
    : openTag.replace(/^<svg/i, `<svg viewBox="${VIEWBOX}"`);
  if (!/\sfill\s*=/i.test(openTag)) {
    openTag = openTag.replace(/^<svg/i, `<svg fill="${FILL}"`);
  }
  return `${openTag}${rest}`;
}

function normalize(raw, name) {
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) throw new Error(`ai glyph is not valid SVG: ${name}`);
  const svg = match[0];
  assertPaintIsInherited(svg, name);
  return withRootContract(svg);
}
