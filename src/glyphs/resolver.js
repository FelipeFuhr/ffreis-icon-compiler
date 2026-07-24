// Glyph resolver: {source, name} -> inline <svg viewBox="0 0 64 64" fill="currentColor">.
// The template controls color (currentColor) and size, so every adapter MUST
// return that normalized box. This module owns dispatch; adapters own resolution.
import { resolveFontAwesome } from './fontawesome.js';
import { resolveSimpleIcon } from './simple-icons.js';
import { createAiResolver } from './ai.js';

/**
 * @param {{ glyphsDir: string }} opts - directory holding the preset's bespoke ai/*.svg
 * @returns {(glyph: { source: string, name: string }) => string} resolve()
 */
export function createResolver({ glyphsDir }) {
  const resolveAi = createAiResolver({ glyphsDir });
  return function resolve(glyph) {
    const { source, name } = glyph;
    switch (source) {
      case 'fontawesome':
        return resolveFontAwesome(name);
      case 'simpleicons':
        return resolveSimpleIcon(name);
      case 'ai':
        return resolveAi(name);
      default:
        throw new Error(`Unknown glyph source: ${source} (name=${name})`);
    }
  };
}
