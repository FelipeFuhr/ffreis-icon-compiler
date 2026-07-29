// The deck's `ws-*` keys must carry the SAME accent as the logical workspace they
// stand for: the point of the colour is that the key you press and the VS Code
// window it opens read as one thing. `ffreis-workspace-manager` owns that decision
// (an accent NAME per workspace in registry.yaml, the hex for that name in
// palette.json) — so this preset no longer stores either. Both are GENERATED into
// `presets/deck/derived.json` by `npm run sync:deck`.
//
// That makes the old "do the two lists agree?" assertions tautological, so each is
// replaced here by the invariant it was really protecting. What is left is FOUR
// guards, three of which need no fleet checkout at all:
//
//   1. every accent a key resolves to exists in the palette   [was: kept as-is]
//      An unknown accent renders an UNSET CSS var, not an error: a visibly wrong
//      icon that ships green. This is the guard that must never go away.
//   2. every workspace the overlay names has a deck key       [was: half of test 1]
//      Deriving the colour does not derive the icon — a new workspace still needs
//      a glyph and a label, which are this repo's to choose. Nothing else notices
//      a missing one: the picker just has a workspace with no key.
//   3. theme.yaml does not redefine a derived colour          [was: test 3]
//      theme.yaml wins the palette merge, so re-listing `sky:` there would
//      reinstate the hand-copied hex — the exact drift this removed — while every
//      other check still passed.
//   4. the committed overlay matches the registry             [new: staleness]
//      The one guard that needs the fleet, and the only one that can: it is the
//      cost of the snapshot. It SKIPS when the fleet is absent, because this repo
//      is public and standalone and there is then nothing to be stale against —
//      the icons are exactly what the repo declares. See scripts/sync-deck-derived.js
//      for why the build reads the snapshot rather than the registry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { withDefaults } from '../src/config/defaults.js';
import { loadDerived, withResolvedAccents } from '../src/config/derived.js';
import { buildDerived, fleetDir, fleetPresent, serialize, DERIVED_PATH } from '../scripts/sync-deck-derived.js';

// `import.meta.dirname` needs Node >=20; this repo still runs on 18.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRESET = path.join(REPO, 'presets', 'deck');

const rawTheme = () => yaml.load(fs.readFileSync(path.join(PRESET, 'theme.yaml'), 'utf8'));
const rawKeys = () => yaml.load(fs.readFileSync(path.join(PRESET, 'keys.yaml'), 'utf8')).keys;

test('every accent a deck key resolves to exists in the merged palette', () => {
  const derived = loadDerived(PRESET);
  const palette = withDefaults(rawTheme(), derived.palette).palette;
  const missing = withResolvedAccents(rawKeys(), derived)
    .filter((k) => !palette[k.accent])
    .map((k) => `${k.id}:${k.accent}`);
  assert.deepEqual(missing, [], `accents absent from the palette: ${missing.join(', ')}`);
});

test('every workspace the derived overlay names has a deck key', () => {
  const named = Object.keys(loadDerived(PRESET).accents);
  const ids = new Set(rawKeys().map((k) => k.id));
  const uncovered = named.filter((id) => !ids.has(id));
  assert.deepEqual(
    uncovered,
    [],
    `workspaces with an accent but no icon (add a key with a glyph + label): ${uncovered.join(', ')}`,
  );
});

test('every ws-* deck key is a workspace the derived overlay names', () => {
  const named = loadDerived(PRESET).accents;
  const orphans = rawKeys()
    .filter((k) => k.id.startsWith('ws-') && !named[k.id])
    .map((k) => k.id);
  assert.deepEqual(orphans, [], `ws-* keys with no workspace behind them: ${orphans.join(', ')}`);
});

test('no ws-* deck key hardcodes an accent the registry owns', () => {
  const hardcoded = rawKeys()
    .filter((k) => k.id.startsWith('ws-') && k.accent)
    .map((k) => `${k.id}:${k.accent}`);
  assert.deepEqual(
    hardcoded,
    [],
    `these re-introduce the hand-copied accent the overlay exists to remove: ${hardcoded.join(', ')}`,
  );
});

test('theme.yaml does not redefine a colour the derived overlay owns', () => {
  const derivedNames = new Set(Object.keys(loadDerived(PRESET).palette));
  const shadowed = Object.keys(rawTheme().palette ?? {}).filter((name) => derivedNames.has(name));
  assert.deepEqual(
    shadowed,
    [],
    `theme.yaml wins the palette merge, so these silently override the registry: ${shadowed.join(', ')}`,
  );
});

test(
  'the committed derived.json matches the registry',
  { skip: fleetPresent() ? false : `ffreis-workspace-manager not at ${fleetDir()}` },
  () => {
    assert.equal(
      fs.readFileSync(DERIVED_PATH, 'utf8'),
      serialize(buildDerived()),
      'presets/deck/derived.json is stale — run `npm run sync:deck` and commit the result',
    );
  },
);
