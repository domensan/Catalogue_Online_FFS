const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const stored = [];
      let failNext = true;
      const sent = [];
      const tokens = new Map();
      await context.route('https://script.google.com/macros/s/**', async route => {
        if (route.request().method() === 'POST') {
          const note = route.request().postDataJSON();
          if (note.action === 'delete') {
            if (tokens.get(note.id) !== note.ownerToken) return route.fulfill({json:{ok:false}});
            const index = stored.findIndex(n => n.id === note.id);
            if (index !== -1) stored.splice(index, 1);
            return route.fulfill({json:{ok:true, id:note.id, deleted:true}});
          }
          tokens.set(note.id, note.ownerToken);
          sent.push(note);
          if (!stored.some(n => n.id === note.id)) stored.push({ id:note.id, page:note.page, x:note.x, y:note.y, name:note.name, text:note.text, createdAt: '2026-09-24T12:00:00Z' });
          if (failNext) { failNext = false; return route.abort(); }
          return route.fulfill({ json: { ok: true, id: note.id } });
        }
        return route.fulfill({ json: { ok: true, version: 2, comments: stored } });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:8765');
      await page.locator('#review-toggle').click();
      await page.waitForFunction(() => document.querySelector('#review-status').textContent.startsWith('Shared comments'));
      await page.locator('.review-surface').first().click({ position: { x: 100, y: 100 } });
      await page.locator('#note-name').fill('Reviewer');
      await page.locator('#note-text').fill('Review <b>this</b> image');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.note-error').textContent.startsWith('Save not confirmed'));
      assert.equal(await page.locator('#note-text').inputValue(), 'Review <b>this</b> image');
      await page.getByRole('button', { name: 'Retry save' }).click();
      await page.waitForFunction(() => document.querySelector('#review-status').textContent.startsWith('Saved to'));
      assert.deepEqual(sent[0], sent[1]);
      assert.equal(stored.length, 1);
      await page.reload();
      await page.locator('#review-toggle').click();
      await page.locator('.review-pin').click();
      assert.equal(await page.locator('#note-text').inputValue(), 'Review <b>this</b> image');
      assert(await page.locator('#note-text').evaluate(el => el.readOnly));
      assert.equal(await page.locator('dialog b').count(), 0);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      stored[0].resolved = true;
      await page.getByRole('button', { name: 'Refresh comments' }).click();
      await page.locator('.review-pin.resolved').waitFor();
      await page.locator('#next').click();
      await page.waitForFunction(() => !document.querySelector('.review-pin'));
      await page.locator('#previous').click();
      await page.locator('.review-pin').waitFor();
      // A different browser can read the note but must not offer deletion.
      const strangerContext = await browser.newContext();
      await strangerContext.route('https://script.google.com/macros/s/**', route => route.fulfill({json:{ok:true, version:2, comments:stored}}));
      const stranger = await strangerContext.newPage();
      await stranger.goto('http://127.0.0.1:8765');
      await stranger.locator('#review-toggle').click();
      await stranger.locator('.review-pin').click();
      assert(await stranger.locator('[data-action="delete"]').isHidden());
      await strangerContext.close();
      await page.locator('.review-pin').click();
      assert(await page.locator('[data-action="delete"]').isVisible());
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', {name:'Delete comment', exact:true}).click();
      await page.waitForFunction(() => document.querySelector('#review-status').textContent.startsWith('Comment deleted'));
      assert.equal(stored.length, 0);
      await page.reload();
      await page.locator('#review-toggle').click();
      await page.waitForFunction(() => document.querySelector('#review-status').textContent.startsWith('Shared comments'));
      assert.equal(await page.locator('.review-pin').count(), 0);
      assert.deepEqual(errors, []);
      console.log(`PASS shared review ${width}px: save, retry, no duplicates, reload, status, navigation`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
