// Simple Icons brand-mark adapter.
//
// Contract:
//   resolveSimpleIcon(slug: string) -> string
//     returns an inline <svg viewBox="0 0 64 64" fill="currentColor">...</svg>
//     for the Simple Icons brand mark `slug`, with the native 24x24 path
//     re-centered into the shared 0 0 64 64 box.
//
// Source data: the pinned `simple-icons` package (13.21.0). That version does
// not expose a per-icon subpath module (`./icons/*` in its package.json
// `exports` map only reaches the raw *.svg* assets, not a JS module with path
// data), so we import the full index and build a slug -> icon lookup once.
// Each icon object exposes `{ slug, title, path, hex, ... }` with a 24x24
// `path`. The brand `hex` is intentionally ignored — the template colors the
// glyph via `fill="currentColor"`.
import * as simpleIcons from 'simple-icons';

const VIEWBOX_SIZE = 64;
const NATIVE_SIZE = 24;
const TARGET_SIZE = 52; // re-centered glyph occupies ~52 of the 64 box
const SCALE = TARGET_SIZE / NATIVE_SIZE;
const OFFSET = (VIEWBOX_SIZE - TARGET_SIZE) / 2;

// Fallback chain: the deck preset (presets/deck/keys.yaml) references these
// primary slugs. Some may be absent from the pinned simple-icons version (a
// rename/split upstream), so each primary maps to the next slug to try.
// Resolve the first that exists; throw only if none do.
const FALLBACKS = {
  claude: 'anthropic',
  k3s: 'kubernetes',
  amazonwebservices: 'amazonaws',
};

let slugIndex;

function getSlugIndex() {
  if (!slugIndex) {
    slugIndex = new Map();
    for (const icon of Object.values(simpleIcons)) {
      if (icon && typeof icon.slug === 'string' && typeof icon.path === 'string') {
        slugIndex.set(icon.slug, icon);
      }
    }
  }
  return slugIndex;
}

function toSvg(path) {
  return (
    `<svg viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" fill="currentColor" ` +
    `xmlns="http://www.w3.org/2000/svg">` +
    `<g transform="translate(${OFFSET},${OFFSET}) scale(${SCALE})">` +
    `<path d="${path}"/>` +
    `</g></svg>`
  );
}

/** @param {string} slug - Simple Icons brand slug (e.g. "github", "claude") */
export function resolveSimpleIcon(slug) {
  const index = getSlugIndex();
  const tried = [slug];
  let icon = index.get(slug);

  if (!icon && FALLBACKS[slug]) {
    const fallbackSlug = FALLBACKS[slug];
    tried.push(fallbackSlug);
    icon = index.get(fallbackSlug);
    if (icon) {
      // eslint-disable-next-line no-console -- deliberate: surface silent alias use
      console.warn(
        `[glyphs/simple-icons] slug "${slug}" not found in pinned simple-icons; ` +
          `using fallback "${fallbackSlug}"`,
      );
    }
  }

  if (!icon) {
    throw new Error(
      `simple-icons: no icon found for slug "${slug}" (tried: ${tried.join(', ')})`,
    );
  }

  return toSvg(icon.path);
}
