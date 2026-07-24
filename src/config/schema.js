// Config contract for the icon compiler. theme.yaml + keys.yaml validate against
// these before any render happens (compiler == typed contract, not a script).
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });

/** A theme: palette (named accents) + default output size + rem design base. */
export const themeSchema = {
  $id: 'theme',
  type: 'object',
  additionalProperties: false,
  required: ['palette'],
  properties: {
    // Output edge length in px (also the rem design unit). Default lives in defaults.js.
    size: { type: 'integer', minimum: 16, maximum: 2048 },
    // Named accent colors. hex drives strokes/glyph glow; rgb ("r,g,b") drives rgba() glows.
    palette: {
      type: 'object',
      minProperties: 1,
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        required: ['hex', 'rgb'],
        properties: {
          hex: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
          rgb: { type: 'string', pattern: '^\\d{1,3},\\d{1,3},\\d{1,3}$' },
        },
      },
    },
  },
};

/** A key definition: which glyph, which accent, label + optional nav badge. */
export const keySchema = {
  $id: 'key',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'accent', 'glyph'],
  properties: {
    // Output basename: compiler writes <id>.png. Matches the deck.yaml icon stem.
    id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$' },
    label: { type: 'string', maxLength: 12 },
    accent: { type: 'string' }, // must be a key in theme.palette (checked in compiler)
    nav: { type: 'boolean' }, // draws the page-navigation badge
    glyph: {
      type: 'object',
      additionalProperties: false,
      required: ['source', 'name'],
      properties: {
        source: { type: 'string', enum: ['fontawesome', 'simpleicons', 'ai'] },
        name: { type: 'string', minLength: 1 },
      },
    },
  },
};

export const keysSchema = {
  $id: 'keys',
  type: 'object',
  additionalProperties: false,
  required: ['keys'],
  properties: {
    keys: { type: 'array', minItems: 1, items: keySchema },
  },
};

const compiledTheme = ajv.compile(themeSchema);
const compiledKeys = ajv.compile(keysSchema);

function run(validator, data) {
  const valid = validator(data);
  return { valid, errors: valid ? [] : (validator.errors ?? []) };
}

/** @returns {{valid: boolean, errors: object[]}} */
export const validateTheme = (data) => run(compiledTheme, data);

/** @returns {{valid: boolean, errors: object[]}} */
export const validateKeys = (data) => run(compiledKeys, data);
