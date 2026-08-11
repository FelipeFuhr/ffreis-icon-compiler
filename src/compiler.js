// Compiler orchestration — the module the CLI calls.
//
// Contract:
//   compile({ presetDir, size, outDir, only, templateDir }) -> Promise<{ written: string[] }>
//     1. Load presetDir/theme.yaml + keys.yaml (js-yaml) + the optional generated
//        presetDir/derived.json overlay (config/derived.js).
//     2. Merge theme with defaults + the overlay palette (withDefaults); apply
//        `size` override if given.
//     3. Validate: validateTheme / validateKeys — throw readable errors on invalid.
//        Resolve each key's accent (own, else overlay); assert it exists in
//        theme.palette and that every key.id is unique.
//     4. createResolver({ glyphsDir: presetDir/glyphs/ai }).
//     5. Load templates/deck-key/component.{html,css} once.
//     6. createRenderer(); per key (optionally filtered by `only`): resolve glyph ->
//        buildPageHtml -> renderToPng -> write outDir/<id>.png.
//     7. close() the renderer; return the written paths.
//
// renderAll() exposes the same pipeline returning in-memory buffers (used by the
// preview contact sheet) so the browser and validation aren't duplicated.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import yaml from 'js-yaml';
import { validateTheme, validateKeys } from './config/schema.js';
import { withDefaults } from './config/defaults.js';
import { loadDerived, withResolvedAccents } from './config/derived.js';
import { createResolver } from './glyphs/resolver.js';
import { buildPageHtml } from './render/page-template.js';
import { createRenderer } from './render/renderer.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PRESET_DIR = join(REPO_ROOT, 'presets', 'deck');
const DEFAULT_TEMPLATE_DIR = join(REPO_ROOT, 'templates', 'deck-key');

/** Turn ajv errors into a single readable, multi-line message. */
function formatErrors(kind, errors) {
  const lines = errors.map((e) => `  - ${e.instancePath || '/'} ${e.message}`);
  return `${kind} config is invalid:\n${lines.join('\n')}`;
}

/** Load + validate theme/keys, build the resolver, read the templates once. */
function prepare({ presetDir = DEFAULT_PRESET_DIR, size, templateDir = DEFAULT_TEMPLATE_DIR } = {}) {
  const rawTheme = yaml.load(readFileSync(join(presetDir, 'theme.yaml'), 'utf8')) ?? {};
  const rawKeys = yaml.load(readFileSync(join(presetDir, 'keys.yaml'), 'utf8')) ?? {};
  const derived = loadDerived(presetDir);

  const theme = withDefaults(rawTheme, derived.palette);
  if (size !== undefined && size !== null) {
    theme.size = size;
  }

  const themeResult = validateTheme(theme);
  if (!themeResult.valid) {
    throw new Error(formatErrors('theme', themeResult.errors));
  }
  const keysResult = validateKeys(rawKeys);
  if (!keysResult.valid) {
    throw new Error(formatErrors('keys', keysResult.errors));
  }

  // Materialize each accent from the key or the overlay — throws if neither has one.
  const keys = withResolvedAccents(rawKeys.keys, derived);

  // Unique ids.
  const seen = new Set();
  for (const key of keys) {
    if (seen.has(key.id)) {
      throw new Error(`duplicate key id: "${key.id}"`);
    }
    seen.add(key.id);
  }
  // Accents must exist in the palette. An unknown one would render an unset CSS
  // var — a wrong-coloured icon that ships without failing anything.
  for (const key of keys) {
    if (!theme.palette[key.accent]) {
      throw new Error(`key "${key.id}" uses accent "${key.accent}" not in theme.palette`);
    }
  }

  const resolve = createResolver({ glyphsDir: join(presetDir, 'glyphs', 'ai') });
  const componentHtml = readFileSync(join(templateDir, 'component.html'), 'utf8');
  const componentCss = readFileSync(join(templateDir, 'component.css'), 'utf8');

  return { theme, keys, resolve, componentHtml, componentCss };
}

/** Keep only the keys whose id is in `only` (array of ids); pass-through if empty. */
function filterKeys(keys, only) {
  if (!only || only.length === 0) return keys;
  const wanted = new Set(only);
  return keys.filter((k) => wanted.has(k.id));
}

/**
 * Render each selected key to a PNG buffer, reusing a single browser. A key
 * flagged `active: true` renders TWICE — its normal look plus a second pass with
 * `activeVariant: true`, written under the sibling id `<id>-active` — so callers
 * (and `compile()`'s writer, keyed purely off each result's `id`) never need to
 * know about the active-variant convention themselves.
 */
async function renderList(prepared, only) {
  const { theme, resolve, componentHtml, componentCss } = prepared;
  const keys = filterKeys(prepared.keys, only);
  const renderer = createRenderer();
  try {
    const results = [];
    for (const def of keys) {
      const glyphSvg = resolve(def.glyph);
      const html = buildPageHtml({ componentHtml, componentCss, glyphSvg, def, theme });
      const png = await renderer.renderToPng({ html, size: theme.size, selector: '.deck-key' });
      results.push({ id: def.id, png });

      if (def.active) {
        const activeHtml = buildPageHtml({
          componentHtml,
          componentCss,
          glyphSvg,
          def,
          theme,
          activeVariant: true,
        });
        const activePng = await renderer.renderToPng({
          html: activeHtml,
          size: theme.size,
          selector: '.deck-key',
        });
        results.push({ id: `${def.id}-active`, png: activePng });
      }
    }
    return results;
  } finally {
    await renderer.close();
  }
}

/**
 * Load + validate a preset without rendering (no browser). Used by `validate`.
 * @returns {{ valid: boolean, message: string }}
 */
export function validatePreset({ presetDir, size, templateDir } = {}) {
  try {
    prepare({ presetDir, size, templateDir });
    return { valid: true, message: 'OK' };
  } catch (err) {
    return { valid: false, message: err.message };
  }
}

/**
 * Render every (or `only`) key to a PNG buffer in memory. Same validation +
 * pipeline as compile(), without touching disk. Used by the preview contact sheet.
 * @returns {Promise<Array<{ id: string, png: Buffer }>>}
 */
export async function renderAll({ presetDir, size, only, templateDir } = {}) {
  const prepared = prepare({ presetDir, size, templateDir });
  return renderList(prepared, only);
}

/**
 * Compile a preset's keys to PNG files on disk.
 * @param {object} [opts]
 * @param {string} [opts.presetDir]   preset root (theme.yaml + keys.yaml + glyphs/ai)
 * @param {number} [opts.size]        output edge length override (else theme.size)
 * @param {string} [opts.outDir]      output dir (default dist/<preset>/<size>)
 * @param {string[]} [opts.only]      restrict to these key ids
 * @param {string} [opts.templateDir] deck-key template dir (default templates/deck-key)
 * @returns {Promise<{ written: string[] }>}
 */
export async function compile({ presetDir, size, outDir, only, templateDir } = {}) {
  const resolvedPresetDir = presetDir ?? DEFAULT_PRESET_DIR;
  const prepared = prepare({ presetDir: resolvedPresetDir, size, templateDir });
  const finalOutDir =
    outDir ?? join(REPO_ROOT, 'dist', basename(resolvedPresetDir), String(prepared.theme.size));

  const results = await renderList(prepared, only);

  mkdirSync(finalOutDir, { recursive: true });
  const written = [];
  for (const { id, png } of results) {
    const outPath = join(finalOutDir, `${id}.png`);
    writeFileSync(outPath, png);
    written.push(outPath);
  }
  return { written };
}
