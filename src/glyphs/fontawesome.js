// Font Awesome Solid adapter.
//
// Contract:
//   resolveFontAwesome(name: string) -> string
//     returns an inline <svg viewBox="0 0 64 64" fill="currentColor">...</svg>
//     for the FA Solid icon `name` (e.g. "microphone", "power-off"), with the
//     native path re-centered into the shared 0 0 64 64 box.
//
// Source data: the pinned `@fortawesome/free-solid-svg-icons` package. Each icon
// export exposes `{ icon: [width, height, ligatures, unicode, svgPathData] }`
// where svgPathData is a string or (rarely) an array of strings. The requested
// kebab/space name is derived programmatically into the package's camelCase
// `fa*` export name, then the native path is scaled/translated so its
// w x h bounding box is centered in the shared 64x64 viewBox.
import * as freeSolidSvgIcons from '@fortawesome/free-solid-svg-icons';

const VIEWBOX_SIZE = 64;
// Leave a small margin around the glyph inside the 64-unit box.
const TARGET_SIZE = 52;

/**
 * Derive the package's camelCase export name from a kebab/space FA icon name.
 * e.g. "power-off" -> "faPowerOff", "circle-half-stroke" -> "faCircleHalfStroke".
 * @param {string} name
 * @returns {string}
 */
function toExportName(name) {
  const pascalCase = name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
  return `fa${pascalCase}`;
}

/** Round to avoid excessive floating-point noise in the emitted attribute. */
function round(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * @param {string} name - kebab/space FA Solid icon name, e.g. "power-off"
 * @returns {string} inline <svg viewBox="0 0 64 64" fill="currentColor">...</svg>
 */
export function resolveFontAwesome(name) {
  const exportName = toExportName(name);
  const iconDefinition = freeSolidSvgIcons[exportName];
  if (!iconDefinition || !iconDefinition.icon) {
    throw new Error(
      `Unknown Font Awesome Solid icon: "${name}" (expected export "${exportName}" in @fortawesome/free-solid-svg-icons)`,
    );
  }

  const [width, height, , , svgPathData] = iconDefinition.icon;
  const pathDataList = Array.isArray(svgPathData) ? svgPathData : [svgPathData];

  // Uniform scale so the icon's native w x h box fits within TARGET_SIZE,
  // then translate so that scaled box is centered in the 64x64 viewBox.
  const scale = TARGET_SIZE / Math.max(width, height);
  const translateX = round((VIEWBOX_SIZE - width * scale) / 2);
  const translateY = round((VIEWBOX_SIZE - height * scale) / 2);

  const paths = pathDataList.map((d) => `<path d="${d}"/>`).join('');

  return (
    `<svg viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" fill="currentColor" xmlns="http://www.w3.org/2000/svg">` +
    `<g transform="translate(${translateX},${translateY}) scale(${round(scale)})">${paths}</g>` +
    `</svg>`
  );
}
