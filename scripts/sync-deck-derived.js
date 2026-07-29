#!/usr/bin/env node
// Generator for `presets/deck/derived.json`.
//
//   node scripts/sync-deck-derived.js            # regenerate the committed overlay
//   node scripts/sync-deck-derived.js --check    # exit 1 if it is stale (CI/hook use)
//
// WHY THIS EXISTS
// The deck's workspace keys stand for the logical workspaces in
// `ffreis-workspace-manager`, which owns BOTH halves of their colour: it assigns
// each workspace an `accent:` NAME in workspace/registry.yaml and defines what
// that name looks like in workspace/palette.json. This repo used to hand-copy
// both — and they diverged: 11 of 12 accents disagreed the first time the two
// lists coexisted. Copying with a drift test is second best; this generates the
// values instead, so there is nothing to keep in sync.
//
// WHY A COMMITTED SNAPSHOT AND NOT A LIVE READ
// This repo is public, MIT and standalone; the registry is in a private sibling
// that is simply absent in CI and in anyone else's clone. A compiler that read
// the registry when present and fell back otherwise would emit DIFFERENT icons
// on different machines from the same commit — the failure mode is silent and
// visual, which is the worst kind. So the build always reads the committed
// snapshot (one source, deterministic, reproducible by anyone), and the ONLY
// thing gated on the fleet being present is the staleness check below plus its
// test — which runs exactly where the registry can change, i.e. next to it.
//
// This is a deck/fleet concern, so it lives in scripts/ and not src/: the
// compiler engine stays generic and knows only "a preset may ship an overlay".
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import yaml from 'js-yaml';
import { DERIVED_FILENAME } from '../src/config/derived.js';

// `import.meta.dirname` needs Node >=20; this repo still runs on 18.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRESET_DIR = join(REPO_ROOT, 'presets', 'deck');
export const DERIVED_PATH = join(PRESET_DIR, DERIVED_FILENAME);

/**
 * Where the private fleet checkout lives. Sibling in the flat workspace by
 * default; overridable so this runs from a git worktree or a different layout.
 */
export function fleetDir() {
  return process.env.FFREIS_WORKSPACE_MANAGER ?? resolve(REPO_ROOT, '..', 'ffreis-workspace-manager');
}

/** True when the registry + palette exports are readable. */
export function fleetPresent(dir = fleetDir()) {
  return existsSync(join(dir, 'workspace', 'registry.yaml')) &&
    existsSync(join(dir, 'workspace', 'palette.json'));
}

/** "#89b4fa" -> "137,180,250". The rgb field is a pure function of hex; never hand-write it. */
function hexToRgb(hex) {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  if (!m) throw new Error(`not a 6-digit hex colour: "${hex}"`);
  return m.slice(1).map((pair) => parseInt(pair, 16)).join(',');
}

/**
 * The deck key id that stands for a registry workspace. The hub has no anchor of
 * its own — it IS the picker's `root` key.
 */
function keyIdFor(workspace, meta) {
  return meta?.hub ? 'ws-root' : workspace;
}

/**
 * Build the overlay from the fleet's exports. Pure w.r.t. the two input files, so
 * the staleness test can call it and compare against the committed copy.
 * @param {string} [dir] fleet checkout root
 * @returns {{_generated: string, source: string, palette: object, accents: object}}
 */
export function buildDerived(dir = fleetDir()) {
  const registry = yaml.load(readFileSync(join(dir, 'workspace', 'registry.yaml'), 'utf8')) ?? {};
  const paletteExport = JSON.parse(readFileSync(join(dir, 'workspace', 'palette.json'), 'utf8'));

  const palette = {};
  for (const [name, spec] of Object.entries(paletteExport.colors ?? {})) {
    palette[name] = { hex: spec.hex.toLowerCase(), rgb: hexToRgb(spec.hex) };
  }

  const accents = {};
  for (const [workspace, meta] of Object.entries(registry.workspaces ?? {})) {
    if (!meta?.accent) continue; // `accent:` is optional upstream
    accents[keyIdFor(workspace, meta)] = meta.accent;
  }

  const unknown = Object.entries(accents)
    .filter(([, accent]) => !palette[accent])
    .map(([id, accent]) => `${id} -> ${accent}`);
  if (unknown.length > 0) {
    throw new Error(
      `registry assigns accents absent from palette.json: ${unknown.join(', ')}\n` +
        `(the registry says accent: is a CLOSED ENUM of palette names — fix it upstream)`,
    );
  }

  return {
    _generated: 'GENERATED — do not edit by hand; run `npm run sync:deck`',
    source: 'ffreis-workspace-manager/workspace/{registry.yaml,palette.json}',
    palette,
    accents,
  };
}

/** Canonical on-disk form, so `--check` compares text and the diff is readable. */
export function serialize(derived) {
  return `${JSON.stringify(derived, null, 2)}\n`;
}

function main() {
  const check = process.argv.includes('--check');
  const dir = fleetDir();

  if (!fleetPresent(dir)) {
    console.error(
      `ffreis-workspace-manager not found at ${dir}\n` +
        `set FFREIS_WORKSPACE_MANAGER=<path> to point at the fleet checkout`,
    );
    process.exit(1);
  }

  const wanted = serialize(buildDerived(dir));
  const current = existsSync(DERIVED_PATH) ? readFileSync(DERIVED_PATH, 'utf8') : '';

  if (check) {
    if (current === wanted) {
      console.log(`OK — presets/deck/${DERIVED_FILENAME} matches the registry`);
      return;
    }
    console.error(
      `presets/deck/${DERIVED_FILENAME} is STALE against ${dir}\n` +
        `run \`npm run sync:deck\` and commit the result`,
    );
    process.exit(1);
  }

  if (current === wanted) {
    console.log(`unchanged — presets/deck/${DERIVED_FILENAME}`);
    return;
  }
  writeFileSync(DERIVED_PATH, wanted);
  console.log(`wrote presets/deck/${DERIVED_FILENAME}`);
}

// Only act when run as a script; importing this module (tests) must be side-effect free.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
