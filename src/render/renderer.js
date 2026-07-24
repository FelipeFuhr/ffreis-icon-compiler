// Playwright renderer.
//
// Contract:
//   createRenderer() -> { renderToPng, close }
//   renderToPng({ html, size, selector = '.deck-key' }) -> Promise<Buffer>
//     Launches (or reuses) ONE headless Chromium, sets page content to `html`,
//     screenshots the `selector` element as PNG, and returns a size x size Buffer.
//
// Crispness: page-template lays the key out at DESIGN_PX CSS px (16rem key,
// root font-size = DESIGN_PX/16). We rasterize at deviceScaleFactor = size /
// DESIGN_PX, so a DESIGN_PX element captures at exactly `size` device px. The
// deviceScaleFactor is fixed per browser context, so we cache one context per
// distinct size and reuse it (and a single page) across every key in a build.
import { chromium } from 'playwright';
import { DESIGN_PX } from './page-template.js';

/** @returns {{ renderToPng: (opts: { html: string, size: number, selector?: string }) => Promise<Buffer>, close: () => Promise<void> }} */
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

  async function renderToPng({ html, size, selector = '.deck-key' }) {
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error(`renderToPng: invalid size ${size}`);
    }
    const { page } = await contextForSize(size);
    await page.setContent(html, { waitUntil: 'load' });
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
