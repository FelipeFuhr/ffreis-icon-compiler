// Playwright renderer.  STUB — implement in subagent A1.
//
// Contract:
//   createRenderer() -> { renderToPng, close }
//   renderToPng({ html, size, selector = '.deck-key' }) -> Promise<Buffer>
//     Launches (or reuses) a headless Chromium, sets the page content to `html`,
//     screenshots the `selector` element, and returns a `size`x`size` PNG Buffer.
//
// Notes:
//   - Reuse ONE browser/context across all keys in a build (launch is the cost);
//     `close()` tears it down at the end.
//   - Crisp output: render at deviceScaleFactor = size / designPx (the design px
//     set by page-template's root font-size) so the element rasterizes at exactly
//     size x size device pixels. type: 'png' (the deck decodes PNG only).
//   - No transparency needed (the component paints an opaque rounded surface);
//     omit `omitBackground` unless a preset asks for it.
export function createRenderer() {
  throw new Error('createRenderer not implemented');
}
