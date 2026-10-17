// Pure unit tests for the declared-font capability: the schema accepts a
// declaration, withDefaults carries it, and the matcher decides what must be
// verified / what did not resolve. No browser — the browser half is exercised
// end-to-end in compile.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifiableFamilies,
  unresolvedFamilies,
  fontResolutionMessage,
  fontStack,
  isSystemFamily,
} from '../src/render/fonts.js';
import { validateTheme } from '../src/config/schema.js';
import { withDefaults } from '../src/config/defaults.js';

const palette = { cyan: { hex: '#22d3ee', rgb: '34,211,238' } };

test('themeSchema accepts a declared font stack', () => {
  const { valid, errors } = validateTheme({ size: 100, palette, fonts: ['Inter', 'system-ui'] });
  assert.ok(valid, JSON.stringify(errors, null, 2));
});

test('themeSchema still accepts a theme that declares no fonts', () => {
  const { valid, errors } = validateTheme({ size: 100, palette });
  assert.ok(valid, JSON.stringify(errors, null, 2));
});

test('themeSchema rejects a comma-separated stack crammed into one entry', () => {
  // One family per entry: a comma would otherwise smuggle a whole CSS fragment
  // past the per-family verification.
  const { valid } = validateTheme({ palette, fonts: ['Inter, Roboto, sans-serif'] });
  assert.equal(valid, false, 'a comma-separated entry must not validate');
});

test('themeSchema rejects a font entry carrying CSS punctuation', () => {
  const { valid } = validateTheme({ palette, fonts: ['Inter"; color: red'] });
  assert.equal(valid, false, 'CSS punctuation must not validate');
});

test('withDefaults carries a declared font stack through the merge', () => {
  // themeSchema is additionalProperties:false and withDefaults rebuilds the
  // object, so a dropped key here would silently disarm the whole guard.
  const theme = withDefaults({ palette, fonts: ['Inter'] });
  assert.deepEqual(theme.fonts, ['Inter']);
});

test('withDefaults invents no default font stack', () => {
  const theme = withDefaults({ palette });
  assert.equal('fonts' in theme, false, 'absent must stay absent (= declared nothing)');
});

test('verifiableFamilies: a system stack declares nothing to verify', () => {
  assert.deepEqual(verifiableFamilies(['system-ui', 'sans-serif']), []);
  assert.deepEqual(verifiableFamilies([]), []);
  assert.deepEqual(verifiableFamilies(undefined), []);
});

test('verifiableFamilies: a named family must be verified, generics around it skipped', () => {
  assert.deepEqual(verifiableFamilies(['system-ui', 'Inter', 'sans-serif']), ['Inter']);
});

test('verifiableFamilies: dedupes case- and quote-insensitively, keeps order', () => {
  assert.deepEqual(verifiableFamilies(['Inter', '"inter"', 'Roboto']), ['Inter', 'Roboto']);
});

test('isSystemFamily covers the CSS generics and the system-ui vendor aliases', () => {
  for (const family of ['system-ui', 'sans-serif', 'monospace', '-apple-system', 'ui-rounded']) {
    assert.ok(isSystemFamily(family), `${family} should count as a system family`);
  }
  assert.equal(isSystemFamily('Inter'), false, 'a named family is not a system family');
});

test('unresolvedFamilies: a loaded FontFace resolves the declaration', () => {
  const faces = [{ family: 'Inter', status: 'loaded' }];
  assert.deepEqual(unresolvedFamilies(['Inter'], faces), []);
});

test('unresolvedFamilies: matches a FontFace whose family is quoted / differently cased', () => {
  const faces = [{ family: '"inter"', status: 'loaded' }];
  assert.deepEqual(unresolvedFamilies(['Inter'], faces), []);
});

test('unresolvedFamilies: an empty FontFaceSet leaves the declaration absent', () => {
  // The exact state measured on this repo's page today: font-family names Inter,
  // document.fonts is empty, and check() nonetheless answers true.
  assert.deepEqual(unresolvedFamilies(['Inter'], []), [{ family: 'Inter', status: 'absent' }]);
});

test('unresolvedFamilies: a face that never loaded does NOT count as resolved', () => {
  const faces = [{ family: 'Inter', status: 'error' }];
  assert.deepEqual(unresolvedFamilies(['Inter'], faces), [{ family: 'Inter', status: 'error' }]);
});

test('unresolvedFamilies: one loaded face among several statuses resolves the family', () => {
  const faces = [
    { family: 'Inter', status: 'unloaded' },
    { family: 'Inter', status: 'loaded' },
  ];
  assert.deepEqual(unresolvedFamilies(['Inter'], faces), []);
});

test('fontResolutionMessage names the family, its status and what the page carried', () => {
  const message = fontResolutionMessage([{ family: 'Inter', status: 'absent' }], []);
  assert.match(message, /did not resolve/);
  assert.match(message, /"Inter" \(absent\)/);
  assert.match(message, /ships no @font-face at all/);
});

test('fontStack quotes named families and leaves generics bare', () => {
  assert.equal(fontStack(['Inter', 'system-ui', 'sans-serif']), '"Inter", system-ui, sans-serif');
});

test('fontStack is empty when the theme declares nothing', () => {
  assert.equal(fontStack([]), '');
  assert.equal(fontStack(undefined), '');
});
