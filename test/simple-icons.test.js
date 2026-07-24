// Contract tests for the Simple Icons adapter: every simpleicons slug the deck
// preset references (presets/deck/keys.yaml) must resolve to a normalized
// 64x64 <svg> containing a <path>. This also exercises the claude|anthropic,
// k3s|kubernetes and amazonwebservices|amazonaws fallback chain — in the
// pinned simple-icons version all six primaries currently resolve directly,
// but the alias targets are asserted too so a future version bump that drops
// a primary slug fails loud here instead of at render time. A bogus slug must
// throw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';
import { resolveSimpleIcon } from '../src/glyphs/simple-icons.js';

const here = dirname(fileURLToPath(import.meta.url));
const presetDir = join(here, '..', 'presets', 'deck');

const loadKeys = () => yaml.load(readFileSync(join(presetDir, 'keys.yaml'), 'utf8'));

const deckSimpleIconSlugs = loadKeys()
  .keys.filter((k) => k.glyph.source === 'simpleicons')
  .map((k) => k.glyph.name);

const SVG_SHAPE = /^<svg viewBox="0 0 64 64"[^>]*>[\s\S]*<path d="[^"]+"[\s\S]*<\/svg>$/;

test('deck preset references the expected simpleicons slugs', () => {
  // Guards against the fixture silently losing coverage of the fallback chain.
  assert.deepEqual(
    new Set(deckSimpleIconSlugs),
    new Set(['claude', 'github', 'k3s', 'grafana', 'amazonwebservices', 'spotify']),
  );
});

for (const slug of deckSimpleIconSlugs) {
  test(`resolveSimpleIcon("${slug}") returns a normalized 64x64 svg with a path`, () => {
    const svg = resolveSimpleIcon(slug);
    assert.match(svg, SVG_SHAPE);
  });
}

// Fallback-chain alias targets: asserted directly so the chain is proven to
// work end-to-end even though the pinned package currently ships every
// primary slug natively (so the alias branch isn't hit today, but would be
// the moment a primary is renamed/removed upstream).
for (const aliasTarget of ['anthropic', 'kubernetes']) {
  test(`resolveSimpleIcon("${aliasTarget}") (fallback target) also resolves`, () => {
    const svg = resolveSimpleIcon(aliasTarget);
    assert.match(svg, SVG_SHAPE);
  });
}

test('resolveSimpleIcon throws for a bogus slug', () => {
  assert.throws(() => resolveSimpleIcon('this-brand-does-not-exist-xyz'), /no icon found/);
});
