// Optional browser regression check: install Playwright and run with NODE_PATH set to its node_modules.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.CATALOG_URL || 'http://127.0.0.1:8765');
      await page.waitForFunction(() => document.querySelector('#counter').textContent === 'Page 1 of 48');
      await page.waitForTimeout(300);
      // Sample each animation frame: transformed corners must not enlarge the document.
      await page.evaluate(() => {
        window.layoutSamples = [];
        window.sampleLayout = true;
        function sample() {
          const root = document.documentElement;
          const box = document.querySelector('#book').getBoundingClientRect();
          window.layoutSamples.push([root.scrollWidth, root.scrollHeight, box.width, box.height]);
          if (window.sampleLayout) requestAnimationFrame(sample);
        }
        sample();
      });
      for (let spread = 0; spread < 2; spread++) {
        const visible = page.locator('.page:visible').last();
        const box = await visible.boundingBox();
        for (const y of [box.y + 3, box.y + box.height - 3]) {
          await page.mouse.move(box.x + box.width - 3, y);
          await page.waitForTimeout(800);
          await page.mouse.move(10, 10);
          await page.waitForTimeout(800);
        }
        assert.equal(await page.locator('.page.--hard').count(), 0, 'all pages, including covers, must be flexible');
        await page.locator('#next').click();
        await page.waitForTimeout(800);
      }
      const samples = await page.evaluate(() => { window.sampleLayout = false; return window.layoutSamples; });
      for (const sample of samples) assert.deepEqual(sample, samples[0], 'hover/flip must not change document or book dimensions');
      assert(samples[0][0] <= viewport.width, 'no horizontal scrollbar');
      assert(samples[0][1] <= viewport.height, 'no vertical scrollbar at this viewport');
      assert.deepEqual(errors, []);
      console.log(`PASS: stable corners, flexible covers and navigation at ${viewport.width}px`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
