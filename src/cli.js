#!/usr/bin/env node
// CLI entrypoint. Hand-rolled argv parsing (no arg deps).
//
//   icon-compiler build    --preset <name> [--size <n>] [--out <dir>] [--only <id,id>]
//   icon-compiler validate --preset <name> [--size <n>]
//   icon-compiler preview  --preset <name> [--size <n>] [--out <file.html>] [--only <id,id>]
//
// `--preset deck` resolves to presets/deck. Exit non-zero on any failure so it
// wires into CI / lefthook.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compile, renderAll, validatePreset } from './compiler.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `icon-compiler <command> [options]

Commands:
  build    --preset <name> [--size <n>] [--out <dir>] [--only <id,id>]
  validate --preset <name> [--size <n>]
  preview  --preset <name> [--size <n>] [--out <file.html>] [--only <id,id>]`;

/** Parse "--key value" / "--key=value" flags into an object. */
function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[arg.slice(2)] = next;
        i += 1;
      } else {
        flags[arg.slice(2)] = true; // bare boolean flag
      }
    }
  }
  return flags;
}

function requirePreset(flags) {
  if (!flags.preset || flags.preset === true) {
    throw new Error('missing required --preset <name>');
  }
  return join(REPO_ROOT, 'presets', flags.preset);
}

function parseSize(flags) {
  if (flags.size === undefined) return undefined;
  const n = Number(flags.size);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`--size must be a positive integer (got "${flags.size}")`);
  }
  return n;
}

function parseOnly(flags) {
  if (!flags.only || flags.only === true) return undefined;
  return String(flags.only)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Build one self-contained HTML contact sheet embedding each PNG as a data URI. */
function contactSheet(results, presetName) {
  const cells = results
    .map(({ id, png }) => {
      const src = `data:image/png;base64,${png.toString('base64')}`;
      return `    <figure><img alt="${id}" src="${src}"><figcaption>${id}</figcaption></figure>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>icon-compiler preview — ${presetName}</title>
<style>
  body { margin: 0; padding: 2rem; background: #0b1220; color: #e6edf6;
         font-family: system-ui, Arial, sans-serif; }
  h1 { font-size: 1.1rem; font-weight: 700; margin: 0 0 1.5rem; }
  .grid { display: grid; gap: 1.25rem;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
  figure { margin: 0; text-align: center; }
  figure img { width: 100px; height: 100px; image-rendering: auto;
               background: #050b13; border-radius: 12px; }
  figcaption { margin-top: 0.5rem; font-size: 0.75rem; color: #9fb0c3; }
</style>
</head>
<body>
  <h1>${presetName} — ${results.length} keys</h1>
  <div class="grid">
${cells}
  </div>
</body>
</html>`;
}

async function cmdBuild(flags) {
  const presetDir = requirePreset(flags);
  const { written } = await compile({
    presetDir,
    size: parseSize(flags),
    outDir: flags.out && flags.out !== true ? flags.out : undefined,
    only: parseOnly(flags),
  });
  const outDir = written.length > 0 ? dirname(written[0]) : (flags.out ?? '(none)');
  console.log(`Wrote ${written.length} icons to ${outDir}`);
}

function cmdValidate(flags) {
  const presetDir = requirePreset(flags);
  const { valid, message } = validatePreset({ presetDir, size: parseSize(flags) });
  if (valid) {
    console.log(`OK — ${flags.preset} preset is valid`);
    return;
  }
  console.error(message);
  process.exit(1);
}

async function cmdPreview(flags) {
  const presetDir = requirePreset(flags);
  const results = await renderAll({
    presetDir,
    size: parseSize(flags),
    only: parseOnly(flags),
  });
  const outFile =
    flags.out && flags.out !== true
      ? flags.out
      : join(REPO_ROOT, 'dist', flags.preset, 'preview.html');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, contactSheet(results, flags.preset));
  console.log(`Preview written to ${outFile} (${results.length} keys)`);
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const flags = parseFlags(rest);

  switch (command) {
    case 'build':
      await cmdBuild(flags);
      break;
    case 'validate':
      cmdValidate(flags);
      break;
    case 'preview':
      await cmdPreview(flags);
      break;
    case undefined:
    case '-h':
    case '--help':
    case 'help':
      console.log(USAGE);
      break;
    default:
      console.error(`Unknown command: ${command}\n\n${USAGE}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exit(1);
});
