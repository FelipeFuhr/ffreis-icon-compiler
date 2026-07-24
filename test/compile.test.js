// Smoke test for the full compile() pipeline against a tiny inline fixture preset.
// Exercises the REAL ai glyph resolver + REAL deck-key template and renders one
// key through headless Chromium, asserting a non-empty PNG. If Chromium genuinely
// cannot launch in this environment, ONLY this render test skips — the pure
// page-template tests always run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile } from '../src/compiler.js';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** True when the error is Playwright failing because the browser isn't usable. */
function isBrowserMissing(err) {
  const msg = String(err && err.message);
  return /Executable doesn't exist|playwright install|browserType\.launch|Host system is missing dependencies|no usable sandbox/i.test(
    msg,
  );
}

/** Write a minimal 1-key preset (ai glyph) into a fresh temp dir. */
function writeFixturePreset() {
  const dir = mkdtempSync(join(tmpdir(), 'icon-compiler-fixture-'));
  writeFileSync(
    join(dir, 'theme.yaml'),
    'size: 64\npalette:\n  cyan: { hex: "#22d3ee", rgb: "34,211,238" }\n',
  );
  writeFileSync(
    join(dir, 'keys.yaml'),
    'keys:\n  - { id: fixture, label: FIX, accent: cyan, glyph: { source: ai, name: blip } }\n',
  );
  mkdirSync(join(dir, 'glyphs', 'ai'), { recursive: true });
  writeFileSync(
    join(dir, 'glyphs', 'ai', 'blip.svg'),
    '<svg viewBox="0 0 64 64" fill="currentColor"><circle cx="32" cy="32" r="20"/></svg>\n',
  );
  return dir;
}

test('compile() renders an ai-glyph key to a non-empty PNG', async (t) => {
  const presetDir = writeFixturePreset();
  const outDir = join(presetDir, 'out');
  try {
    let result;
    try {
      result = await compile({ presetDir, size: 64, outDir });
    } catch (err) {
      if (isBrowserMissing(err)) {
        t.skip(`Chromium not launchable in this environment: ${err.message}`);
        return;
      }
      throw err;
    }

    assert.equal(result.written.length, 1, 'expected exactly one written file');
    assert.ok(result.written[0].endsWith('fixture.png'), 'output basename should be <id>.png');

    const png = readFileSync(result.written[0]);
    assert.ok(png.length > 0, 'PNG buffer is empty');
    assert.ok(png.subarray(0, 8).equals(PNG_MAGIC), 'output is not a PNG (bad magic header)');
  } finally {
    rmSync(presetDir, { recursive: true, force: true });
  }
});
