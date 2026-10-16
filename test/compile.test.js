// Smoke test for the full compile() pipeline against a tiny inline fixture preset.
// Exercises the REAL ai glyph resolver + REAL deck-key template and renders one
// key through headless Chromium, asserting a PNG of exactly the requested
// dimensions. If Chromium genuinely cannot launch in this environment, ONLY the
// render tests skip — the pure page-template/font tests always run.
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

/**
 * Width/height straight out of a PNG's IHDR: bytes 16-19 and 20-23 are
 * big-endian uint32s (8-byte signature, 4-byte length, 4-byte "IHDR" tag).
 * Read from the file itself rather than trusting the renderer's arithmetic —
 * pure stdlib, no image dependency.
 */
function pngSize(buffer) {
  assert.ok(buffer.subarray(0, 8).equals(PNG_MAGIC), 'not a PNG (bad magic header)');
  assert.equal(buffer.subarray(12, 16).toString('latin1'), 'IHDR', 'first chunk is not IHDR');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** Write a minimal 1-key preset (ai glyph) into a fresh temp dir. */
function writeFixturePreset({ fonts } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'icon-compiler-fixture-'));
  const fontsYaml = fonts ? `fonts: [${fonts.map((f) => JSON.stringify(f)).join(', ')}]\n` : '';
  writeFileSync(
    join(dir, 'theme.yaml'),
    `size: 64\n${fontsYaml}palette:\n  cyan: { hex: "#22d3ee", rgb: "34,211,238" }\n`,
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

// The only thing that had ever been asserted about the output bytes was the PNG
// magic header. Geometry was not checked anywhere, and it is fragile by
// construction: deviceScaleFactor is FRACTIONAL at the production size
// (100/256 = 0.390625) over a 16rem box with sub-pixel CSS geometry, and the
// deck consumes a fixed-geometry key — a rounding change would ship silently.
test('compile() writes a PNG of exactly size x size at several sizes', async (t) => {
  const presetDir = writeFixturePreset();
  try {
    for (const size of [64, 100]) {
      let result;
      try {
        result = await compile({ presetDir, size, outDir: join(presetDir, `out-${size}`) });
      } catch (err) {
        if (isBrowserMissing(err)) {
          t.skip(`Chromium not launchable in this environment: ${err.message}`);
          return;
        }
        throw err;
      }
      const { width, height } = pngSize(readFileSync(result.written[0]));
      assert.equal(width, size, `width at size=${size}`);
      assert.equal(height, size, `height at size=${size}`);
    }
  } finally {
    rmSync(presetDir, { recursive: true, force: true });
  }
});

test('compile() fails the render when a declared font family did not resolve', async (t) => {
  // "Inter" has no @font-face and no font file in this tree, so it resolves only
  // on a host that happens to have it installed — the same commit rendering
  // different label pixels on different machines. Declaring it must be an error,
  // not a silent fallback.
  const presetDir = writeFixturePreset({ fonts: ['Inter', 'sans-serif'] });
  try {
    await assert.rejects(
      () => compile({ presetDir, size: 64, outDir: join(presetDir, 'out') }),
      (err) => {
        if (isBrowserMissing(err)) {
          t.skip(`Chromium not launchable in this environment: ${err.message}`);
          return true;
        }
        assert.match(err.message, /did not resolve/);
        assert.match(err.message, /"Inter" \(absent\)/);
        return true;
      },
    );
  } finally {
    rmSync(presetDir, { recursive: true, force: true });
  }
});

test('compile() renders a theme declaring only a system stack (declared exception)', async (t) => {
  // A family with no webfont behind it was chosen DELIBERATELY: there is nothing
  // to verify, so the guard must skip rather than fail. This is also what keeps
  // the deck preset (which declares no font at all) rendering.
  const presetDir = writeFixturePreset({ fonts: ['system-ui', 'sans-serif'] });
  try {
    let result;
    try {
      result = await compile({ presetDir, size: 64, outDir: join(presetDir, 'out') });
    } catch (err) {
      if (isBrowserMissing(err)) {
        t.skip(`Chromium not launchable in this environment: ${err.message}`);
        return;
      }
      throw err;
    }
    const { width, height } = pngSize(readFileSync(result.written[0]));
    assert.deepEqual({ width, height }, { width: 64, height: 64 });
  } finally {
    rmSync(presetDir, { recursive: true, force: true });
  }
});
