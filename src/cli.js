#!/usr/bin/env node
// CLI entrypoint.  STUB — implement in subagent A1.
//
// Contract (no arg-parsing deps — parse process.argv by hand, keep it small):
//   icon-compiler build   --preset <name> [--size <n>] [--out <dir>] [--only <id,id>]
//   icon-compiler validate --preset <name>
//   icon-compiler preview  --preset <name> [--size <n>] [--out <file.html>]
//
// - `--preset deck` resolves to presets/deck (presetDir).
// - build   -> compile({...}); print the written count + outDir.
// - validate -> load + validateTheme/validateKeys; print OK or the errors; exit 1 on invalid.
// - preview -> render every key and emit one HTML contact sheet (grid of the PNGs
//              or the live components) for eyeballing; print the output path.
// Exit non-zero on any failure so it wires into CI / lefthook.
function main() {
  throw new Error('cli not implemented');
}

main();
