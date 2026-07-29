# AGENTS.md — ffreis-icon-compiler

Non-obvious constraints and conventions for agents working in this repo. Read
this before your first edit.

## What this is

A **config-driven icon compiler**. Pipeline, per key:

```
definition {glyph:{source,name}, accent, label, badge?, nav?}
  → glyph resolver ({source,name} → inline <svg viewBox="0 0 64 64" fill="currentColor">)
  → template (deck-key HTML/CSS, rem units, --accent/--accent-rgb vars) + glyph
  → Playwright render @ size (rem design; size is config, default 100)
  → PNG  (the deck's draw_icon decodes PNG — output MUST be PNG, not JPEG)
```

The **compiler** (`src/`) is generic. A **preset** (`presets/deck/`) is data:
`keys.yaml` (definitions) + `theme.yaml` (palette + size) + the optional generated
`derived.json` + `glyphs/ai/*.svg` (bespoke). Website presets come later — do not
bake deck assumptions into `src/`.

## Hard constraints

- **Output is PNG.** The Fifine D6 engine (`ffreis-deck`) decodes PNG only, then
  JPEG-encodes for the device itself. Emitting JPEG here breaks the deck.
- **Design in `rem`, not `px`.** The component is authored against a 100-unit
  design where the key is `16rem`. Output size is configurable by scaling the
  root font-size / Playwright `deviceScaleFactor` — never by editing layout.
- **Glyphs are `viewBox="0 0 64 64"`, `fill="currentColor"`.** Every adapter
  (fontawesome, simpleicons, ai) MUST normalize to that box + currentColor so the
  template controls color/size uniformly.
- **Config validates before render.** `src/config/schema.js` is the contract;
  `keys.yaml`/`theme.yaml`/`derived.json` must pass it. Extend the schema
  (upstream) rather than bypassing validation.
- **Never hand-write a value the workspace registry owns.** The deck's `ws-*`
  keys take their accent NAME (registry.yaml) and its hex (palette.json) from
  `ffreis-workspace-manager` via the generated `presets/deck/derived.json`
  (`npm run sync:deck`). `keys.yaml` keeps only what is this repo's: id, label,
  glyph. Adding `accent:` back to a `ws-*` key, or re-listing a registry colour
  in `theme.yaml`, fails a test by name — those two lists diverged (11 of 12)
  the first time they both existed.
- **The build reads the committed snapshot, never the registry.** This repo is
  public and standalone; the private fleet is absent in CI and in other clones.
  Reading it when present would make the same commit render different icons on
  different machines — silently, and visually. Only the staleness check touches
  the fleet, and it skips (with a reason) when it isn't there.

## The contract (owned by the skeleton — build against these)

- `src/config/schema.js` — ajv schemas + `validateTheme` / `validateKeys`.
- `src/glyphs/resolver.js` — `createResolver({ glyphsDir }) → resolve({source,name}) → svgString`.
  Dispatches to `fontawesome.js` / `simple-icons.js` / `ai.js`. Each adapter
  exports the documented signature; fill the stub, keep the signature.
- `src/render/page-template.js`, `src/render/renderer.js`, `src/compiler.js`,
  `src/cli.js` — engine stubs; implement to the documented signatures.
- `templates/deck-key/component.{html,css}` — visual template; central glyph
  slot is `.deck-key__icon`.

## Workspace rules that apply here

- **License: MIT** (public shared package). Keep the MIT `LICENSE`.
- **Draft PRs only** (`gh pr create --draft`); never push to `main` except the
  initial scaffold. Feature branches: `feat/…`, `fix/…`, `chore/…`.
- **GitHub Actions is billing-paused fleet-wide** → the merge gate is LOCAL:
  `npm test` (node built-in test runner) + `node --check` (lefthook pre-commit).
  Actions runs will fail with a billing error — expected noise, not a blocker.
- **Scan-fix markers**: any change made to satisfy a linter/scanner carries a
  `// scan-fix(tool:rule): what — why` marker.

## Follow-ups (tracked, not blockers)

- `ws-tooling` + `ws-dashboard` icons are new here (both workspaces were added
  upstream on 2026-07-29). The deck's own config still has to reference them
  before they appear in the workspace picker — this repo only renders the PNGs.

- Add a `node-package` archetype to `ffreis-project-templates` (this repo was
  hand-scaffolded — no Copier template existed) and backfill `.copier-answers.yaml`.
- SHA-pin `.github/workflows/ci.yml` actions when billing resumes.
- Adopt the fleet standards lefthook `remotes:` block once it has a Node target set.
- Register in `ffreis-workspace-manager` (`ws add ffreis-icon-compiler --to ws-shared`).
