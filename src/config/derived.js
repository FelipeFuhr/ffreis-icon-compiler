// Derived preset overlay — the values a preset does NOT own.
//
// A preset may ship a GENERATED `derived.json` beside theme.yaml / keys.yaml,
// carrying values whose source of truth lives outside this repo so the preset
// never hand-copies them:
//
//   {
//     "_generated": "…",                  // provenance, for humans
//     "source": "…",                      // what generated it
//     "palette": { "<name>": { "hex": "#rrggbb", "rgb": "r,g,b" } },
//     "accents": { "<key id>": "<palette name>" }
//   }
//
// Contract:
//   - The file is OPTIONAL. A preset that owns all of its values omits it and
//     nothing changes.
//   - `palette` merges OVER the compiler defaults and UNDER the preset's own
//     theme.yaml palette, so a preset can still add colours of its own — while a
//     preset that *redefines* a derived colour is doing so visibly (and a preset
//     test can forbid it, which is how the duplication stays gone).
//   - A key that omits `accent` takes it from `accents[key.id]`. A key with no
//     accent from EITHER source is a hard error — never a silent default. An
//     unset accent renders an unset CSS var: a wrong-coloured icon that ships
//     without failing anything, which is the one outcome worth crashing over.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateDerived } from './schema.js';

/** Conventional filename inside a preset dir (like theme.yaml / keys.yaml). */
export const DERIVED_FILENAME = 'derived.json';

/** Shape returned when a preset ships no overlay — every lookup misses. */
export const EMPTY_DERIVED = Object.freeze({ palette: {}, accents: {} });

/**
 * Load a preset's derived overlay, or EMPTY_DERIVED when it ships none.
 * @param {string} presetDir
 * @returns {{ palette: Record<string, {hex: string, rgb: string}>, accents: Record<string, string> }}
 */
export function loadDerived(presetDir) {
  const file = join(presetDir, DERIVED_FILENAME);
  if (!existsSync(file)) return EMPTY_DERIVED;

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${DERIVED_FILENAME} is not valid JSON: ${err.message}`);
  }

  const { valid, errors } = validateDerived(parsed);
  if (!valid) {
    const lines = errors.map((e) => `  - ${e.instancePath || '/'} ${e.message}`);
    throw new Error(`${DERIVED_FILENAME} is invalid:\n${lines.join('\n')}`);
  }

  return { palette: parsed.palette ?? {}, accents: parsed.accents ?? {} };
}

/**
 * Materialize each key's accent from the key itself or the overlay.
 * Returns NEW key objects so downstream code (template, renderer) keeps seeing a
 * plain `def.accent` string and needs to know nothing about where it came from.
 * @param {Array<object>} keys
 * @param {{ accents?: Record<string, string> }} [derived]
 * @returns {Array<object>}
 */
export function withResolvedAccents(keys, derived = EMPTY_DERIVED) {
  const accents = derived?.accents ?? {};
  return keys.map((key) => {
    if (key.accent) return key;
    const accent = accents[key.id];
    if (!accent) {
      throw new Error(
        `key "${key.id}" has no accent: none in keys.yaml and no "${key.id}" entry in ` +
          `${DERIVED_FILENAME} (regenerate the overlay, or give the key an explicit accent)`,
      );
    }
    return { ...key, accent };
  });
}
