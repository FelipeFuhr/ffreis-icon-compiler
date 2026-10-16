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
presets/        consumer data — deck/{keys.yaml, theme.yaml, derived.json, glyphs/ai/*.svg}
scripts/        preset generators (sync-deck-derived.js)
flags/          flags.json — the points of deliberate variation this repo gates
dist/           build output (git-ignored; committed copy lives in the consumer repo)
test/           schema + golden-render tests
```

## Derived preset values (`derived.json`)

A preset may ship a **generated** `derived.json` beside `theme.yaml`/`keys.yaml`
carrying values it does not own — palette entries and per-key accents whose
source of truth lives outside this repo:

```json
{ "palette": { "sky": { "hex": "#89dceb", "rgb": "137,220,235" } },
  "accents": { "ws-website": "sky" } }
```

A key that omits `accent` takes it from `accents[key.id]`; palette entries merge
**over** the compiler defaults and **under** the preset's own `theme.yaml`. A key
with no accent from either source is a hard error — an unset accent would render
an unset CSS var, i.e. a wrong-coloured icon that ships without failing anything.
The file is optional: a preset that owns all of its values omits it.

The deck preset uses this for its `ws-*` workspace keys, whose accent name and
hex are both assigned by `ffreis-workspace-manager`:

```bash
npm run sync:deck          # regenerate presets/deck/derived.json from the registry
npm run sync:deck:check    # exit 1 if the committed copy is stale
```

The build always reads the **committed** snapshot, never the registry, so the
same commit renders the same icons everywhere — including in this public repo's
CI, where the private registry simply isn't there. Only the staleness check needs
it, and it skips when absent.

## Declared typography (`theme.fonts`)

A label is the only text in the output, so the font that renders it is part of
the determinism promise. A theme MAY declare its families — one per entry,
most-preferred first:

```yaml
fonts: [Inter, system-ui, sans-serif]
```

What a declaration buys:

- The declared stack is applied **after** the component stylesheet, so it wins
  the cascade over `component.css`'s own `font-family`.
- Before capture the render awaits `document.fonts.ready`, then **verifies**
  every declared non-system family actually resolved — a family with no
  `@font-face` behind it fails the render instead of silently rasterizing the
  label in a fallback face.

Verification reads the page's `FontFaceSet` entries, **not**
`document.fonts.check()`: `check()` answers "can this text be rendered" and
returns `true` for a family the browser has never heard of, because a fallback
can render it. So only a face the page itself ships counts as resolved — which
is the point, since that is the only kind that rasterizes the same on every
machine.

A theme that declares **no** `fonts`, or only generic/system keywords
(`system-ui`, `sans-serif`, `-apple-system`, `ui-*`), is skipping the check
deliberately: a family with no webfont behind it was chosen on purpose and there
is nothing to verify. The deck preset declares none today.

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
