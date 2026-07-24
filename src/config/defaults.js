// Baseline defaults merged under a preset's theme.yaml. The palette here mirrors
// the deck design; presets may override any accent or add new ones.
export const DEFAULT_SIZE = 100;

export const DEFAULT_PALETTE = {
  cyan: { hex: '#22d3ee', rgb: '34,211,238' },
  violet: { hex: '#a876ff', rgb: '168,118,255' },
  green: { hex: '#43e29b', rgb: '67,226,155' },
  amber: { hex: '#ffbd4a', rgb: '255,189,74' },
  red: { hex: '#ff5d7d', rgb: '255,93,125' },
};

export const DEFAULT_THEME = {
  size: DEFAULT_SIZE,
  palette: DEFAULT_PALETTE,
};

/** Merge a preset theme over the defaults (shallow palette merge). */
export function withDefaults(theme = {}) {
  return {
    size: theme.size ?? DEFAULT_THEME.size,
    palette: { ...DEFAULT_PALETTE, ...(theme.palette ?? {}) },
  };
}
