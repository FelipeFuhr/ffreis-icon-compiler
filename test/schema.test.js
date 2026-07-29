// Contract tests: the deck preset must validate against the schema, ids unique,
// accents defined. Runs green from the skeleton (real preset, real schema) and
// gives the fan-out a stable target. Extend as engine/glyph modules land.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';
import { validateTheme, validateKeys } from '../src/config/schema.js';
import { withDefaults } from '../src/config/defaults.js';
import { loadDerived, withResolvedAccents } from '../src/config/derived.js';

const here = dirname(fileURLToPath(import.meta.url));
const presetDir = join(here, '..', 'presets', 'deck');

const loadDerivedOverlay = () => loadDerived(presetDir);
const loadTheme = () =>
  withDefaults(
    yaml.load(readFileSync(join(presetDir, 'theme.yaml'), 'utf8')),
    loadDerivedOverlay().palette,
  );
const loadKeys = () => yaml.load(readFileSync(join(presetDir, 'keys.yaml'), 'utf8'));

test('deck theme validates', () => {
  const { valid, errors } = validateTheme(loadTheme());
  assert.ok(valid, JSON.stringify(errors, null, 2));
});

test('deck keys validate', () => {
  const { valid, errors } = validateKeys(loadKeys());
  assert.ok(valid, JSON.stringify(errors, null, 2));
});

test('deck key ids are unique', () => {
  const ids = loadKeys().keys.map((k) => k.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id present');
});

test('deck derived overlay validates', () => {
  // loadDerived() validates against derivedSchema and throws with the ajv errors.
  assert.doesNotThrow(() => loadDerivedOverlay());
});

test('every deck key accent exists in the theme palette', () => {
  // Accents resolve from the key OR the generated overlay — check the same way
  // the compiler does, so a derived accent is not read as a missing one.
  const theme = loadTheme();
  for (const k of withResolvedAccents(loadKeys().keys, loadDerivedOverlay())) {
    assert.ok(theme.palette[k.accent], `unknown accent "${k.accent}" on key "${k.id}"`);
  }
});
