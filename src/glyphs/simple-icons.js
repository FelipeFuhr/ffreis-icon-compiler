// Simple Icons brand-mark adapter.  STUB — implement in subagent B2.
//
// Contract:
//   resolveSimpleIcon(slug: string) -> string
//     returns an inline <svg viewBox="0 0 64 64" fill="currentColor">...</svg>
//     for the Simple Icons brand mark `slug`, with the native 24x24 path
//     re-centered into the shared 0 0 64 64 box.
//
// Source data: the pinned `simple-icons` package. Import the icon by slug; each
// icon exposes `{ path, title, hex, ... }` with a 24x24 path. Scale/translate to
// center in 64x64 and set fill="currentColor" (ignore the brand `hex` — the
// template colors the glyph).
//
// Slugs the deck preset needs (with fallbacks if a slug is missing in the pinned
// version — resolve the first that exists):
//   claude|anthropic  github  grafana  k3s|kubernetes  amazonwebservices|amazonaws
//   spotify
//
// Add a unit test asserting a known slug resolves to an <svg> containing a path.
export function resolveSimpleIcon(slug) {
  throw new Error(`simple-icons adapter not implemented (slug=${slug})`);
}
