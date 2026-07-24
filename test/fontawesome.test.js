// Contract tests for the Font Awesome Solid adapter: representative names
// resolve to a normalized <svg viewBox="0 0 64 64"> containing a path, unknown
// names throw, and every FA name used by the deck preset resolves (guards the
// preset<->adapter contract so a keys.yaml addition can't silently break render).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';
import { resolveFontAwesome } from '../src/glyphs/fontawesome.js';

const here = dirname(fileURLToPath(import.meta.url));
const keysPath = join(here, '..', 'presets', 'deck', 'keys.yaml');

function deckFontAwesomeNames() {
  const { keys } = yaml.load(readFileSync(keysPath, 'utf8'));
  return keys.filter((k) => k.glyph.source === 'fontawesome').map((k) => k.glyph.name);
}

test('representative FA names resolve to a normalized svg', () => {
  for (const name of ['microphone', 'power-off', 'circle-half-stroke', 'code-pull-request']) {
    const svg = resolveFontAwesome(name);
    assert.match(svg, /^<svg viewBox="0 0 64 64"/, `unexpected svg head for "${name}": ${svg}`);
    assert.match(svg, /<path /, `no <path> in svg for "${name}"`);
  }
});

test('unknown FA name throws', () => {
  assert.throws(() => resolveFontAwesome('not-a-real-icon-xyz'), /Unknown Font Awesome Solid icon/);
});

test('every FA name in the deck preset resolves', () => {
  const names = deckFontAwesomeNames();
  assert.ok(names.length > 0, 'expected at least one fontawesome key in the deck preset');
  for (const name of names) {
    const svg = resolveFontAwesome(name);
    assert.match(svg, /^<svg viewBox="0 0 64 64"/, `unexpected svg head for "${name}"`);
    assert.match(svg, /<path /, `no <path> in svg for "${name}"`);
  }
});
