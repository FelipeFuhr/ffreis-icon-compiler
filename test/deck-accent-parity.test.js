// The deck preset's `ws-*` keys must carry the SAME accent as the logical workspace they
// stand for. The point of the colour is that the key you press and the VS Code window it
// opens read as one thing; two independently-maintained colour lists defeat that, and
// they already did diverge once — 11 of 12 keys disagreed with the registry the first
// time both existed.
//
// `ffreis-workspace-manager` owns the palette and exports `workspace/palette.json`
// exactly so a consumer can check itself against it. This test does that when the fleet
// is on disk, and SKIPS otherwise: this repo is public and standalone, and CI has no
// private registry to read. A skip is honest here — an assertion that silently passes
// because a file is missing would be worse than none.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

// `import.meta.dirname` needs Node >=20; this repo still runs on 18.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Sibling checkout in the flat fleet workspace; overridable so the check is runnable
// from a worktree or a differently-laid-out clone.
const FLEET =
  process.env.FFREIS_WORKSPACE_MANAGER ??
  path.resolve(REPO, "..", "ffreis-workspace-manager");
const PALETTE = path.join(FLEET, "workspace", "palette.json");
const REGISTRY = path.join(FLEET, "workspace", "registry.yaml");

const fleetPresent = fs.existsSync(PALETTE) && fs.existsSync(REGISTRY);

function deckKeys() {
  const doc = yaml.load(fs.readFileSync(path.join(REPO, "presets/deck/keys.yaml"), "utf8"));
  return new Map(doc.keys.filter((k) => k.id.startsWith("ws-")).map((k) => [k.id, k]));
}

function registryAccents() {
  const reg = yaml.load(fs.readFileSync(REGISTRY, "utf8"));
  const out = new Map();
  for (const [ws, meta] of Object.entries(reg.workspaces ?? {})) {
    // The hub IS the picker's `root` key — it has no anchor of its own.
    out.set(meta?.hub ? "ws-root" : ws, meta?.accent);
  }
  return out;
}

test("every deck ws-* key uses the accent the registry assigns that workspace", { skip: !fleetPresent }, () => {
  const keys = deckKeys();
  const wanted = registryAccents();
  const drift = [];
  for (const [id, accent] of wanted) {
    const key = keys.get(id);
    if (!key) {
      drift.push(`${id}: no deck key (workspace exists but has no icon)`);
      continue;
    }
    if (key.accent !== accent) {
      drift.push(`${id}: deck=${key.accent} registry=${accent}`);
    }
  }
  assert.deepEqual(drift, [], `deck accents disagree with the registry:\n  ${drift.join("\n  ")}`);
});

test("every accent the deck preset names exists in the theme palette", () => {
  const theme = yaml.load(fs.readFileSync(path.join(REPO, "presets/deck/theme.yaml"), "utf8"));
  const known = new Set(Object.keys(theme.palette ?? {}));
  const doc = yaml.load(fs.readFileSync(path.join(REPO, "presets/deck/keys.yaml"), "utf8"));
  const missing = doc.keys.filter((k) => !known.has(k.accent)).map((k) => `${k.id}:${k.accent}`);
  // An unknown accent renders the key with an unset CSS var rather than failing, so
  // without this it would ship as a visibly wrong icon nobody caught.
  assert.deepEqual(missing, [], `accents absent from theme.palette: ${missing.join(", ")}`);
});

test("the theme palette carries the registry's hex for every shared colour", { skip: !fleetPresent }, () => {
  const theme = yaml.load(fs.readFileSync(path.join(REPO, "presets/deck/theme.yaml"), "utf8"));
  const palette = JSON.parse(fs.readFileSync(PALETTE, "utf8")).colors ?? {};
  const drift = [];
  for (const [name, spec] of Object.entries(palette)) {
    const local = theme.palette?.[name];
    if (local && local.hex.toLowerCase() !== spec.hex.toLowerCase()) {
      drift.push(`${name}: deck=${local.hex} registry=${spec.hex}`);
    }
  }
  assert.deepEqual(drift, [], `palette hexes drifted:\n  ${drift.join("\n  ")}`);
});
