// Run against the Vite development server. PLAYWRIGHT_MODULE may name an installed
// Playwright module outside the project; no test hooks are shipped in the game.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.MUYUN_TEST_URL ?? 'http://localhost:5188/';
const out = resolve('output/review/2026-11-01-browser');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const check = async (name, fn) => {
  await fn(); results.push(name); console.log(`PASS ${name}`);
};
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('muyun-onboarding-v1', 'seen'));
const panel = async (name, method) => page.evaluate(async ([name, method]) => {
  (await import(`/src/ui/panels/${name}.ts`))[method]();
}, [name, method]);
const snapshot = () => page.evaluate(async () => JSON.stringify((await import('/src/core/GameState.ts')).gameState.run));
const close = () => page.evaluate(async () => (await import('/src/ui/instance.ts')).ui.closeModal(true));

try {
  await page.goto(base);
  await page.locator('#btn-winter').click();
  await page.locator('#challenge-start').click();
  await page.waitForSelector('#app[data-playing="true"]');
  await close();
  await check('market preserves custom amount, species, page and return focus', async () => {
    await panel('market', 'openMarketPanel');
    await page.locator('#custom-hay-kg').fill('317');
    await page.locator('[data-animal-filter="sheep"]').click();
    await page.locator('[data-animal-page="1"]').click();
    const list = await page.locator('tbody').innerText();
    await page.locator('#market-reserves').click();
    await page.locator('#reserve-back').click();
    assert.equal(await page.locator('#custom-hay-kg').inputValue(), '317');
    assert.equal(await page.locator('[data-animal-filter="sheep"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('tbody').innerText(), list);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'market-reserves');
  });
  await check('week Worker completes without changing the actual run', async () => {
    await panel('strategy', 'openStrategyPanel');
    const before = await snapshot();
    await page.locator('#strategy-run').click();
    await page.waitForSelector('#strategy-result-title');
    assert.equal(await snapshot(), before);
    assert.equal(await page.locator('#strategy-output').getAttribute('aria-busy'), 'false');
  });
  await check('strategy restores the same experiment and selected preference after reserves', async () => {
    await page.locator('input[value="ecology"]').check();
    const detail = await page.locator('#strategy-plan').innerText();
    const metrics = await page.locator('.experiment-comparison').innerText();
    await page.locator('#strategy-reserves').click();
    await page.locator('#reserve-back').click();
    assert.equal(await page.locator('input[value="ecology"]').isChecked(), true);
    assert.equal(await page.locator('#strategy-plan').innerText(), detail);
    assert.equal(await page.locator('.experiment-comparison').innerText(), metrics);
  });
  await check('changing actual state invalidates the cached experiment', async () => {
    await page.locator('#strategy-reserves').click();
    await page.evaluate(async () => (await import('/src/core/GameState.ts')).gameState.act({ kind: 'buy-hay', kg: 1 }));
    await page.locator('#reserve-back').click();
    assert.equal(await page.locator('#strategy-result-title').count(), 0);
    assert.equal(await page.locator('#strategy-run').isVisible(), true);
  });
  await check('week calculation cancels, can retry, and cannot render into another modal', async () => {
    await page.evaluate(() => { document.querySelector('#strategy-run').click(); document.querySelector('#strategy-cancel').click(); });
    await page.waitForFunction(() => document.querySelector('#strategy-output').textContent.includes('已取消'));
    assert.equal(await page.locator('#strategy-run').isEnabled(), true);
    await page.locator('#strategy-run').click();
    await panel('market', 'openMarketPanel');
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#modal-title').innerText(), '集市');
    assert.equal(await page.locator('#strategy-result-title').count(), 0);
  });
  await check('overview shows the actual action and opens confirmation without settling', async () => {
    await panel('overview', 'openOverviewPanel');
    assert.match(await page.locator('#overview-current-actions').innerText(), /本周已记录 1 次经营/);
    await page.locator('#overview-current-actions > summary').click();
    assert.match(await page.locator('#overview-current-actions').innerText(), /购买 1 kg/);
    const before = await snapshot();
    await page.locator('#overview-settle').click();
    assert.equal(await page.locator('#week-confirm').isVisible(), true);
    assert.equal(await snapshot(), before);
    await page.locator('#week-cancel').click();
  });
  await check('result comparison cancels and retries in a real Worker', async () => {
    await page.evaluate(async () => {
      const { gameState } = await import('/src/core/GameState.ts');
      const { simulatePolicy } = await import('/src/sim/policies.ts');
      const data = gameState.toData();
      data.run = simulatePolicy(data.run, 'greedy').state;
      gameState.load(data);
    });
    await panel('result', 'openResultPanel');
    await page.evaluate(() => { document.querySelector('#result-compare').click(); document.querySelector('#comparison-cancel').click(); });
    await page.waitForFunction(() => document.querySelector('#result-comparison').textContent.includes('已取消'));
    const before = await snapshot();
    await page.locator('#result-compare').click();
    await page.waitForSelector('#comparison-title');
    assert.equal(await page.locator('.decision-comparison-table tbody tr').count(), 3);
    assert.equal(await snapshot(), before);
    await page.screenshot({ path: `${out}/comparison-desktop.png` });
  });
  await check('closing results during work leaves the next panel intact', async () => {
    await panel('result', 'openResultPanel');
    await page.locator('#result-compare').click();
    await panel('overview', 'openOverviewPanel');
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#comparison-title').count(), 0);
  });
  await page.evaluate(async () => {
    (await import('/src/core/GameState.ts')).gameState.newGame(20261030, 'winter-challenge-v1');
  });
  await close();
  for (const [width, height] of [[1280, 720], [844, 390]]) {
    for (const theme of ['light', 'dark']) {
      await check(`HUD and modal fit ${width}x${height} ${theme}`, async () => {
        await page.setViewportSize({ width, height });
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        for (const id of ['hud-status', 'hud-note', 'hud-tools', 'hud-turn', 'hud-help']) {
          await page.locator(`#${id} > summary`).click();
          const box = await page.locator(`#${id}`).boundingBox();
          assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${id} outside viewport: ${JSON.stringify(box)}`);
          assert.equal(await page.locator('#hud details[open]').count(), 1);
          await page.locator(`#${id} > summary`).click();
        }
        await page.waitForFunction(() => [...document.querySelectorAll('#hud details')].every(el => el.querySelector('[data-fold-state]').textContent === (el.open ? '收起' : '展开')));
        await page.screenshot({ path: `${out}/ranch-${width}-${theme}.png` });
        await panel('overview', 'openOverviewPanel');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.locator('#overview-current-actions > summary').click();
        await page.evaluate(() => { document.querySelector('#modal-card').scrollTop = 10000; });
        const closeBox = await page.locator('.modal-close').boundingBox();
        assert(closeBox.y >= 0 && closeBox.y + closeBox.height <= height, 'close control must remain visible when scrolled');
        await page.locator('#overview-current-actions').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${out}/overview-${width}-${theme}.png` });
        await close();
      });
    }
  }
  await check('required-asset failure keeps save bytes and retry restores the title', async () => {
    const fault = await browser.newPage();
    await fault.addInitScript(() => localStorage.setItem('muyun-save', '{preserved-test-data'));
    await fault.route('**/yak-detailed.png*', route => route.abort());
    await fault.goto(base);
    await fault.waitForSelector('#loading-retry:not(.hidden)');
    assert.match(await fault.locator('#loading-text').innerText(), /未能加载/);
    assert.equal(await fault.locator('#title-screen').isVisible(), false);
    assert.equal(await fault.evaluate(() => localStorage.getItem('muyun-save')), '{preserved-test-data');
    await fault.screenshot({ path: `${out}/loading-recovery.png` });
    await fault.unroute('**/yak-detailed.png*');
    await fault.locator('#loading-retry').click();
    await fault.waitForSelector('#title-screen:not(.hidden)');
    assert.match(await fault.locator('#save-status').innerText(), /原始数据仍保留/);
    await fault.setViewportSize({ width: 844, height: 390 });
    assert.equal(await fault.locator('#save-status').isVisible(), true);
    await fault.locator('#save-status').scrollIntoViewIfNeeded();
    const warningBox = await fault.locator('#save-status').boundingBox();
    assert(warningBox.y >= 0 && warningBox.y + warningBox.height <= 390, 'damaged-save warning must be reachable on a short screen');
    await fault.screenshot({ path: `${out}/save-warning-844.png` });
    await fault.close();
  });
  assert.deepEqual(errors, []);
  await writeFile(`${out}/results.json`, JSON.stringify({ browser: browser.version(), base, passed: results, errors, limitations: 'Headless Chromium with emulated viewport sizes; not mobile hardware, Safari, screen reader or teaching-effect validation.' }, null, 2));
} finally {
  await browser.close();
}
