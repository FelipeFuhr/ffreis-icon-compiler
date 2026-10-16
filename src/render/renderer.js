// Playwright renderer.
//
// Contract:
//   createRenderer() -> { renderToPng, close }
//   renderToPng({ html, size, selector = '.deck-key', fonts = [] }) -> Promise<Buffer>
//     Launches (or reuses) ONE headless Chromium, sets page content to `html`,
//     waits for font loading to settle, verifies every family `fonts` declares
//     actually resolved, then screenshots the `selector` element as PNG and
//     returns a size x size Buffer.
//
// Crispness: page-template lays the key out at DESIGN_PX CSS px (16rem key,
// root font-size = DESIGN_PX/16). We rasterize at deviceScaleFactor = size /
// DESIGN_PX, so a DESIGN_PX element captures at exactly `size` device px. The
// deviceScaleFactor is fixed per browser context, so we cache one context per
// distinct size and reuse it (and a single page) across every key in a build.
import { chromium } from 'playwright';
import { DESIGN_PX } from './page-template.js';
import { verifiableFamilies, unresolvedFamilies, fontResolutionMessage } from './fonts.js';

/**
 * Fail the render when a family the theme DECLARED did not actually resolve.
 *
 * Reads the FontFaceSet's entries, not `document.fonts.check()`: check() answers
 * "can this text be rendered" and returns true for an unknown family because a
 * fallback can render it, so a guard built on it never fires (render/fonts.js
 * carries the measurement). A theme that declares nothing, or only a system
 * stack, has nothing verifiable and is skipped on purpose.
 */
async function assertDeclaredFontsResolved(page, fonts) {
  const required = verifiableFamilies(fonts);
  if (required.length === 0) return;
  const faces = await page.evaluate(() =>
    Array.from(document.fonts).map((face) => ({ family: face.family, status: face.status })),
  );
  const unresolved = unresolvedFamilies(required, faces);
  if (unresolved.length > 0) {
    throw new Error(`renderToPng: ${fontResolutionMessage(unresolved, faces)}`);
  }
}

/** @returns {{ renderToPng: (opts: { html: string, size: number, selector?: string, fonts?: string[] }) => Promise<Buffer>, close: () => Promise<void> }} */
export function createRenderer() {
  /** @type {import('playwright').Browser | null} */
  let browser = null;
  /** @type {Map<number, { context: import('playwright').BrowserContext, page: import('playwright').Page }>} */
  const bySize = new Map();

  async function ensureBrowser() {
    if (!browser) {
      browser = await chromium.launch({ headless: true });
    }
    return browser;
  }

  async function contextForSize(size) {
    const existing = bySize.get(size);
    if (existing) return existing;
    const b = await ensureBrowser();
    const deviceScaleFactor = size / DESIGN_PX;
    const context = await b.newContext({
      viewport: { width: DESIGN_PX, height: DESIGN_PX },
      deviceScaleFactor,
    });
    const page = await context.newPage();
    const entry = { context, page };
    bySize.set(size, entry);
    return entry;
  }

  async function renderToPng({ html, size, selector = '.deck-key', fonts = [] }) {
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error(`renderToPng: invalid size ${size}`);
    }
    const { page } = await contextForSize(size);
    await page.setContent(html, { waitUntil: 'load' });
    // 'load' can fire before font loading settles, and capturing then rasterizes
    // the fallback face — the same commit producing different label pixels
    // depending on timing. Await the FontFaceSet before measuring or capturing.
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await assertDeclaredFontsResolved(page, fonts);
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`renderToPng: selector "${selector}" matched no element`);
    }
    // Element screenshot captures the element's box at the context's device scale
    // factor -> DESIGN_PX * (size/DESIGN_PX) = size device px. PNG only (the deck
    // decodes PNG, then re-encodes for the device itself).
    return element.screenshot({ type: 'png' });
  }

  async function close() {
    for (const { context } of bySize.values()) {
      await context.close();
    }
    bySize.clear();
    if (browser) {
      await browser.close();
      browser = null;
    }
  }

  return { renderToPng, close };
}
