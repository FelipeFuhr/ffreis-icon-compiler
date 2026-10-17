// The bespoke (`ai`) glyph adapter's contract: viewBox 0 0 64 64, painted with
// currentColor. Both halves were comments only; the currentColor half is now
// enforced, and these tests are what keeps it enforced — a glyph that hardcodes
// a colour renders the wrong colour and would otherwise fail nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { createAiResolver } from '../src/glyphs/ai.js';

const here = dirname(fileURLToPath(import.meta.url));
const deckGlyphsDir = join(here, '..', 'presets', 'deck', 'glyphs', 'ai');

/** Resolve one inline SVG string through the real adapter, via a temp glyph dir. */
function resolveSvg(svgSource) {
  const dir = mkdtempSync(join(tmpdir(), 'ai-glyph-'));
  try {
    writeFileSync(join(dir, 'probe.svg'), svgSource);
    return createAiResolver({ glyphsDir: dir })('probe');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('supplies fill=currentColor when the root <svg> declares no fill', () => {
  const svg = resolveSvg('<svg viewBox="0 0 64 64"><path d="M1 1h1z"/></svg>');
  assert.match(svg, /<svg[^>]*fill="currentColor"/, 'root fill was not supplied');
});

test('keeps an already-correct root fill exactly once', () => {
  const svg = resolveSvg('<svg viewBox="0 0 64 64" fill="currentColor"><path d="M1 1h1z"/></svg>');
  assert.equal(svg.match(/fill="currentColor"/g).length, 1, 'fill was duplicated');
});

test('forces the shared viewBox', () => {
  const svg = resolveSvg('<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 1h1z"/></svg>');
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.equal(svg.includes('0 0 24 24'), false, 'original viewBox leaked');
});

test('rejects a child path that hardcodes a fill colour', () => {
  assert.throws(
    () => resolveSvg('<svg viewBox="0 0 64 64" fill="currentColor"><path fill="#ffffff" d="M1 1h1z"/></svg>'),
    /hardcodes a paint: fill="#ffffff"/,
  );
});

test('rejects a root that hardcodes a fill colour instead of silently rewriting it', () => {
  assert.throws(
    () => resolveSvg('<svg viewBox="0 0 64 64" fill="#ff0000"><path d="M1 1h1z"/></svg>'),
    /hardcodes a paint: fill="#ff0000"/,
  );
});

test('rejects a hardcoded stroke colour', () => {
  assert.throws(
    () => resolveSvg('<svg viewBox="0 0 64 64"><path stroke="red" d="M1 1h1z"/></svg>'),
    /hardcodes a paint: stroke="red"/,
  );
});

test('rejects a hardcoded paint hidden in an inline style', () => {
  assert.throws(
    () => resolveSvg('<svg viewBox="0 0 64 64"><path style="opacity:1;fill:#0f0" d="M1 1h1z"/></svg>'),
    /hardcodes a paint: fill: #0f0/,
  );
});

test('accepts fill=none with a currentColor stroke (a legitimate outlined glyph)', () => {
  const svg = resolveSvg(
    '<svg viewBox="0 0 64 64"><path fill="none" stroke="currentColor" stroke-width="4" d="M1 1h1z"/></svg>',
  );
  assert.match(svg, /stroke="currentColor"/);
});

test('does not mistake fill-rule / stroke-width for a hardcoded paint', () => {
  const svg = resolveSvg(
    '<svg viewBox="0 0 64 64" fill="currentColor"><path fill-rule="evenodd" stroke-width="4" d="M1 1h1z"/></svg>',
  );
  assert.match(svg, /fill-rule="evenodd"/);
});

test('every committed deck glyph satisfies the enforced contract', () => {
  const resolve = createAiResolver({ glyphsDir: deckGlyphsDir });
  const names = readdirSync(deckGlyphsDir)
    .filter((f) => f.endsWith('.svg'))
    .map((f) => basename(f, '.svg'));
  assert.ok(names.length > 0, 'no deck glyphs found to check');
  for (const name of names) {
    const svg = resolve(name);
    assert.match(svg, /viewBox="0 0 64 64"/, `${name}: wrong viewBox`);
    assert.match(svg, /<svg[^>]*fill="currentColor"/, `${name}: root not painted with currentColor`);
  }
});
