// Pure unit tests for buildPageHtml — string in, string out, no browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPageHtml, DESIGN_PX } from '../src/render/page-template.js';

// Minimal stand-ins for the real template + contracts.
const componentHtml =
  '<div class="deck-key {{navClass}}" style="--accent: {{accentHex}}; --accent-rgb: {{accentRgb}};">' +
  '<div class="deck-key__icon">{{glyphSvg}}</div>' +
  '<div class="deck-key__label">{{label}}</div>' +
  '</div>';
const componentCss = '.deck-key { border-radius: 2rem; }';
const glyphSvg = '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M1 1h1z"/></svg>';

const theme = {
  size: 100,
  palette: {
    cyan: { hex: '#22d3ee', rgb: '34,211,238' },
    red: { hex: '#ff5d7d', rgb: '255,93,125' },
  },
};

const baseDef = { id: 'mic', label: 'MIC', accent: 'cyan' };

function build(overrides = {}) {
  return buildPageHtml({
    componentHtml,
    componentCss,
    glyphSvg,
    def: { ...baseDef, ...overrides },
    theme,
  });
}

test('fills every token — no {{placeholder}} left in the output', () => {
  const html = build();
  assert.equal(/\{\{[a-zA-Z]+\}\}/.test(html), false, 'unfilled token remained');
});

test('fills accent hex + rgb from theme.palette[def.accent]', () => {
  const html = build({ accent: 'red' });
  assert.ok(html.includes('--accent: #ff5d7d;'), 'accent hex not filled');
  assert.ok(html.includes('--accent-rgb: 255,93,125;'), 'accent rgb not filled');
});

test('injects the glyph SVG verbatim (trusted — not escaped)', () => {
  const html = build();
  assert.ok(html.includes(glyphSvg), 'glyph svg not injected verbatim');
});

test('places the label text', () => {
  const html = build({ label: 'LOCK' });
  assert.ok(html.includes('>LOCK</div>'), 'label not placed');
});

test('empty label when def.label is absent', () => {
  const html = build({ label: undefined });
  assert.ok(html.includes('deck-key__label"></div>'), 'label slot not empty');
});

test('nav class present only when def.nav is true', () => {
  const navOn = build({ nav: true });
  assert.ok(navOn.includes('deck-key--nav'), 'nav class missing when nav=true');

  const navOff = build({ nav: false });
  assert.equal(navOff.includes('deck-key--nav'), false, 'nav class leaked when nav=false');

  const navAbsent = build({});
  assert.equal(navAbsent.includes('deck-key--nav'), false, 'nav class leaked when nav absent');
});

test('sets a resolution-independent rem base (font-size = DESIGN_PX/16) with a 16rem key', () => {
  const html = build();
  assert.ok(html.includes(`font-size: ${DESIGN_PX / 16}px`), 'root font-size not set from DESIGN_PX');
  assert.ok(html.includes('16rem'), 'key not laid out at 16rem');
});

test('inlines componentCss AFTER the base block so the component wins the cascade', () => {
  const html = build();
  const basePos = html.indexOf('font-size:');
  const componentPos = html.indexOf(componentCss);
  assert.ok(componentPos > basePos, 'componentCss must be inlined after the base reset');
});

test('escapes HTML-special characters in the label', () => {
  const html = build({ label: 'A<B&C' });
  assert.ok(html.includes('A&lt;B&amp;C'), 'label not HTML-escaped');
  assert.equal(html.includes('A<B&C</div>'), false, 'raw special chars leaked into label');
});

test('throws a readable error when the accent is not in the palette', () => {
  assert.throws(() => build({ accent: 'chartreuse' }), /accent "chartreuse" not found/);
});
