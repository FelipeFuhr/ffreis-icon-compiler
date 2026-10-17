// Declared-font determinism.
//
// Labels are the only text in the output, and the component's font stack
// (`system-ui, Inter, Roboto, Arial, sans-serif`) ships with no @font-face and
// no font file in the tree — so `Inter`/`Roboto` resolve only on a host that
// happens to have them, and the SAME commit renders different label pixels on
// different machines. That is the failure mode config/derived.js crashes over
// for accents ("silently, and visually", AGENTS.md), in the typography path.
//
// The contract:
//   - A theme MAY declare `fonts: [...]` (config/schema.js). Declaring a family
//     asserts "this is what rendered", so the render VERIFIES it.
//   - Only a family the page itself carries (an @font-face, i.e. a FontFace
//     entry) rasterizes identically everywhere. A generic/system keyword
//     resolves to whatever the host installed, by definition — declaring one is
//     a deliberate opt-out of verification, so it is skipped, not failed.
//   - `document.fonts.check()` cannot implement this. It answers "can this text
//     be rendered" and returns TRUE for a family the browser has never heard
//     of, because a fallback can render it. Measured in this repo's pinned
//     Chromium 131: `check('1em ThisFamilyDoesNotExistAnywhere') === true`, on a
//     page whose FontFaceSet is empty. A guard built on it never fires. So the
//     guard reads the FontFaceSet's own entries instead.

/**
 * Families that resolve to a host font by design: the CSS generic families and
 * the vendor keywords written beside `system-ui`. Declaring only these is the
 * deliberate, declared exception — there is no webfont to verify.
 */
export const SYSTEM_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
  '-apple-system',
  'blinkmacsystemfont',
]);

/** Comparison key for a family name: unquoted, trimmed, case-folded. */
export function normalizeFamily(family) {
  return String(family ?? '')
    .trim()
    .replace(/^["']/, '')
    .replace(/["']$/, '')
    .trim()
    .toLowerCase();
}

/** True for a family that resolves from the host and so cannot be verified. */
export function isSystemFamily(family) {
  return SYSTEM_FAMILIES.has(normalizeFamily(family));
}

/**
 * The declared families a render must verify — every non-system family, once,
 * in declaration order. Empty means the theme declared nothing to verify.
 * @param {string[]} [fonts] theme.fonts
 * @returns {string[]}
 */
export function verifiableFamilies(fonts = []) {
  const seen = new Set();
  const required = [];
  for (const family of fonts) {
    const key = normalizeFamily(family);
    if (key === '' || seen.has(key) || SYSTEM_FAMILIES.has(key)) continue;
    seen.add(key);
    required.push(String(family).trim());
  }
  return required;
}

/**
 * Which required families did NOT resolve: no FontFace entry carries them, or
 * one does but never reached status "loaded" (a face whose source 404'd sits at
 * "error", and the label silently rasterizes in the fallback).
 * @param {string[]} required            from verifiableFamilies()
 * @param {Array<{family: string, status: string}>} [faces] document.fonts entries
 * @returns {Array<{family: string, status: string}>} status "absent" when unmatched
 */
export function unresolvedFamilies(required, faces = []) {
  const byFamily = new Map();
  for (const face of faces) {
    const key = normalizeFamily(face?.family);
    // "loaded" wins over any other status for the same family.
    if (byFamily.get(key) === 'loaded') continue;
    byFamily.set(key, String(face?.status ?? 'unknown'));
  }
  return required
    .map((family) => ({ family, status: byFamily.get(normalizeFamily(family)) ?? 'absent' }))
    .filter(({ status }) => status !== 'loaded');
}

/** One readable message naming what did not resolve and what the page did carry. */
export function fontResolutionMessage(unresolved, faces = []) {
  const lines = unresolved.map(({ family, status }) => `  - "${family}" (${status})`);
  const carried =
    faces.length === 0
      ? '(none — the page ships no @font-face at all)'
      : faces.map((f) => `"${f.family}" (${f.status})`).join(', ');
  return [
    'theme declares font families that did not resolve in Chromium:',
    ...lines,
    `page FontFaceSet carries: ${carried}`,
    'A declared family must be shipped BY THE PAGE (an @font-face the template',
    'inlines), because only then does every machine rasterize the same label. Ship',
    'the face, or drop the declaration — a theme declaring only a system stack',
    'skips this check by design.',
  ].join('\n');
}

/** Render one family for a CSS `font-family` value; generics must stay unquoted. */
function cssFamily(family) {
  const trimmed = String(family).trim();
  if (isSystemFamily(trimmed)) return normalizeFamily(trimmed);
  return `"${trimmed.replaceAll('"', '')}"`;
}

/**
 * The `font-family` value for a theme's declared stack, in declaration order.
 * Empty string when the theme declares none — the caller then emits no rule and
 * the component's own stack stands.
 * @param {string[]} [fonts] theme.fonts
 * @returns {string}
 */
export function fontStack(fonts = []) {
  const declared = fonts.map(cssFamily).filter((f) => f !== '""');
  return declared.join(', ');
}
