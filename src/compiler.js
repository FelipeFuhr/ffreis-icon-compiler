// Compiler orchestration.  STUB — implement in subagent A1.
//
// Contract:
//   compile({ presetDir, size, outDir, only }) -> Promise<{ written: string[] }>
//     1. Load presetDir/theme.yaml + keys.yaml (js-yaml).
//     2. Merge theme with defaults (withDefaults); apply `size` override if given.
//     3. Validate: validateTheme(theme), validateKeys(keys) — throw on !valid with
//        readable messages. Also assert every key.accent exists in theme.palette
//        and every key.id is unique.
//     4. createResolver({ glyphsDir: presetDir/glyphs/ai }).
//     5. Load templates/deck-key/component.{html,css} once.
//     6. createRenderer(); for each key (optionally filtered by `only`): resolve
//        glyph -> buildPageHtml(...) -> renderToPng -> write outDir/<id>.png.
//     7. close() the renderer; return the list of written paths.
//
// Keep template/preset paths injectable (default to repo-relative) so tests can
// point at fixtures. This is the module the CLI calls.
export async function compile() {
  throw new Error('compile not implemented');
}
