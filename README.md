# ffreis-icon-compiler

Config-driven **icon compiler**. Each icon is a deterministic HTML/CSS
component (background, frame, glow, label capsule, optional nav badge) wrapped
around a central **`<svg>` glyph**, rendered to a raster **PNG** at a
configurable size via headless Chromium (Playwright).

Modelled on `ffreis-website-compiler`: **templates + a validated data contract +
a build/validate CLI**. The compiler knows nothing product-specific; each
consumer ships a **preset** (definitions + theme + any bespoke glyphs). The
first consumer is the Fifine AmpliGame D6 stream deck (`presets/deck/`).

## Why HTML/CSS + SVG (not Canvas)

The component is authored **once in `rem`** against a 100-unit design, so the
same source renders crisp at 100, 200, 512… (output size is config) and can drop
into a responsive web page later. Glyphs come from pinned icon packages
(Font Awesome Solid, Simple Icons) or bespoke monochrome SVGs authored in-repo.

## Layout

```
src/            compiler engine (CLI, config, glyph resolver, Playwright renderer)
templates/      component templates (deck-key: frame/glow/label, central glyph slot)
presets/        consumer data — deck/{keys.yaml, theme.yaml, glyphs/ai/*.svg}
dist/           build output (git-ignored; committed copy lives in the consumer repo)
test/           schema + golden-render tests
```

## Usage

```bash
npm install
npx playwright install chromium         # one-time browser download
icon-compiler validate --preset deck    # validate config against the schema
icon-compiler build --preset deck --size 100 --out dist/deck/100
icon-compiler preview --preset deck      # render an HTML contact sheet
```

## Glyph sources

| Source        | Package / location                     | For                              |
|---------------|----------------------------------------|----------------------------------|
| `fontawesome` | `@fortawesome/free-solid-svg-icons`    | standard actions (mic, lock, …)  |
| `simpleicons` | `simple-icons`                         | brand marks (github, spotify, …) |
| `ai`          | `presets/<preset>/glyphs/ai/*.svg`     | bespoke monochrome pictograms    |

Bespoke glyph spec: `viewBox="0 0 64 64"`, closed paths, `fill="currentColor"`,
no stroke thinner than 4 units, legible at 40–50px, no background/frame/text,
SVGO-clean.

## License

MIT — see [LICENSE](LICENSE).
