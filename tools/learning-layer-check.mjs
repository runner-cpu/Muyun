// Isolated Chromium checks against a built preview or Pages deployment.
// PLAYWRIGHT_MODULE can point at an installed Playwright entry outside this repo.
// Examples:
// node tools/learning-layer-check.mjs http://127.0.0.1:5189/ preview all
// node tools/learning-layer-check.mjs http://127.0.0.1:5190/ baseline performance
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:5189/';
const label = process.argv[3] ?? 'preview';
const mode = process.argv[4] ?? 'all';
assert.match(label, /^[a-z0-9-]+$/);
assert(['all', 'performance', 'ui'].includes(mode));
const out = resolve(process.env.MUYUN_CHECK_OUTPUT ?? 'output/review/2026-11-12-learning');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const passed = [];
const errors = [];
const failedResources = [];
const consoleWarnings = [];
const browserGraphicsWarnings = [];
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = value => Math.round(value * 10) / 10;
let performanceRecord;

async function measureColdLoad() {
  const samples = [];
  for (let index = 0; index < 5; index++) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const workers = [];
    page.on('worker', worker => workers.push(worker.url()));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.goto(url);
    await page.locator('#title-screen:not(.hidden)').waitFor({ timeout: 30000 });
    const sample = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const scripts = resources.filter(resource => /\.js(?:\?|$)/.test(resource.name));
      return {
        titleObservedMs: performance.now(),
        domContentLoadedMs: navigation.domContentLoadedEventEnd,
        loadEventMs: navigation.loadEventEnd,
        scriptTransferBytes: scripts.reduce((sum, resource) => sum + resource.transferSize, 0),
        scriptDecodedBytes: scripts.reduce((sum, resource) => sum + resource.decodedBodySize, 0),
        resourceTransferBytes: resources.reduce((sum, resource) => sum + resource.transferSize, 0),
        scriptFiles: scripts.map(resource => ({ file: new URL(resource.name).pathname.split('/').at(-1), decodedBytes: resource.decodedBodySize, transferBytes: resource.transferSize })),
      };
    });
    assert.equal(workers.length, 0, 'cold title must not initialize a computation Worker');
    samples.push({ ...sample, workersBeforeUserCalculation: workers.length });
    await context.close();
  }
  const metrics = ['titleObservedMs', 'domContentLoadedMs', 'loadEventMs', 'scriptTransferBytes', 'scriptDecodedBytes', 'resourceTransferBytes'];
  performanceRecord = {
    checkedAt: new Date().toISOString(), url, browser: browser.version(),
    method: 'Five fresh isolated Chromium contexts, HTTP cache disabled, 1280×720, no CPU/network throttling; titleObservedMs includes Playwright visibility observation latency. Transferred and decoded script sizes are recorded separately; server compression may differ between preview and Pages. This is a timing record, not a low-end device or Lighthouse claim.',
    median: Object.fromEntries(metrics.map(metric => [metric, round(median(samples.map(sample => sample[metric])))])),
    samples,
  };
  await writeFile(`${out}/${label}-performance.json`, JSON.stringify(performanceRecord, null, 2));
  console.log(`PASS cold-load sample × 5 ${JSON.stringify(performanceRecord.median)}`);
}

async function runUi(width, height, touch) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push({ viewport: `${width}x${height}`, message: error.message }));
  page.on('response', response => { if (response.status() >= 400) failedResources.push({ url: response.url(), status: response.status() }); });
  page.on('console', message => {
    if (message.type() !== 'warning') return;
    const value = message.text();
    // Chromium's headless screenshot readback can emit a driver diagnostic.
    // Record it separately; only this exact browser-level diagnostic is exempt.
    if (/^\[\.WebGL-.*\]GL Driver Message .*GPU stall due to ReadPixels/.test(value)) browserGraphicsWarnings.push(value);
    else consoleWarnings.push(value);
  });
  const activate = async selector => touch ? page.locator(selector).tap() : page.locator(selector).click();
  const check = async (name, fn) => { await fn(); passed.push(`${width}x${height} ${name}`); console.log(`PASS ${width}x${height} ${name}`); };
  const screenshot = async name => {
    // Capture stable content after short-lived action notices have expired.
    await page.waitForFunction(() => !document.querySelector('#toast-root .toast'), null, { timeout: 8000 });
    await page.screenshot({ path: `${out}/${label}-${name}-${width}.png` });
  };
  const readRun = () => page.evaluate(() => structuredClone(window.__MUYUN_STATE__.run));
  const close = async () => { if (await page.locator('.modal-close').count()) await activate('.modal-close'); };
  const fit = async () => {
    const dimensions = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth, viewport: innerWidth,
      modal: document.querySelector('#modal-card').getBoundingClientRect().toJSON(),
      modalScroll: document.querySelector('#modal-card').scrollWidth,
      modalClient: document.querySelector('#modal-card').clientWidth,
      rootScroll: document.documentElement.scrollTop,
    }));
    assert(dimensions.page <= dimensions.viewport, 'page has horizontal overflow');
    assert(dimensions.modalScroll <= dimensions.modalClient + 1, 'modal has horizontal overflow');
    assert(dimensions.modal.x >= 0 && dimensions.modal.y >= 0 && dimensions.modal.right <= width + 1 && dimensions.modal.bottom <= height + 1, 'modal is outside viewport');
    assert.equal(dimensions.rootScroll, 0, 'document must not scroll behind modal');
    if (await page.locator('.modal-close').count()) {
      const box = await page.locator('.modal-close').boundingBox();
      assert(box && box.y >= 0 && box.y + box.height <= height + 1, 'close control must stay on screen');
    }
  };
  const openOverview = async () => { await activate('#hud-note > summary'); await activate('#btn-overview'); };
  const openTool = async panel => { await activate('#hud-tools > summary'); await activate(`[data-panel="${panel}"]`); };
  try {
    await page.goto(url);
    await page.locator('#title-screen:not(.hidden)').waitFor();
    await check('cold title → tutorial → full run preserves isolated saves', async () => {
      const original = await page.evaluate(() => ({ year: localStorage.getItem('muyun-save'), winter: localStorage.getItem('muyun-save-winter') }));
      await activate('#btn-tutorial');
      await page.locator('#tutorial-graze').waitFor();
      await fit();
      if (width !== 667) await screenshot('tutorial');
      await activate('#tutorial-settle');
      await page.locator('#tutorial-retry').waitFor();
      assert.match(await page.locator('#modal-card').innerText(), /仍缺/);
      await activate('#tutorial-retry');
      await activate('#tutorial-graze');
      await activate('#tutorial-buy');
      await activate('#tutorial-settle');
      await page.locator('#tutorial-enter-year').waitFor();
      assert.match(await page.locator('#modal-card').innerText(), /教学复盘|教学周复盘/);
      assert.deepEqual(await page.evaluate(() => ({ year: localStorage.getItem('muyun-save'), winter: localStorage.getItem('muyun-save-winter') })), original);
      await fit();
      if (width !== 667) await screenshot('tutorial-review');
      await activate('#tutorial-enter-year');
      await page.locator('#app[data-playing="true"]').waitFor();
      if (await page.locator('#onboarding-skip').count()) await activate('#onboarding-skip');
      assert.equal((await readRun()).scenario ?? 'year', 'year');
      assert.equal((await readRun()).week, 1);
      assert.notEqual(await page.evaluate(() => localStorage.getItem('muyun-save')), null);
    });

    await check('overview pressure and reserve round trip', async () => {
      await openOverview();
      assert.equal(await page.locator('[data-pressure-week]').count(), 3);
      await page.locator('.pressure-flow').scrollIntoViewIfNeeded();
      await fit();
      if (width !== 667) await screenshot('pressure');
      await activate('[data-pressure-week]:first-child');
      await page.locator('#reserve-back').waitFor();
      await activate('#reserve-back');
      await page.locator('.pressure-flow').waitFor();
      await close();
    });

    await check('touch action → settle → matching historical attribution → return', async () => {
      await openOverview();
      await activate('#overview-pasture');
      const before = await readRun();
      await activate('[data-graze="P1"]');
      const after = await readRun();
      assert.equal(after.actionsLeft, before.actionsLeft - 1);
      assert(after.grazedKg > before.grazedKg, 'tap must execute actual grazing action');
      assert(await page.locator('.modal-feedback #toast-root .toast.good').count(), 'action feedback must remain visible inside the modal');
      const feedbackLayout = await page.evaluate(() => {
        const root = document.getElementById('toast-root');
        const heading = document.querySelector('.modal-head');
        return { position: getComputedStyle(root).position, headingPosition: getComputedStyle(heading).position, headingLayer: Number(getComputedStyle(heading).zIndex) };
      });
      assert.equal(feedbackLayout.position, 'static');
      // When the action button scrolls into view, ordinary feedback may scroll
      // behind the sticky heading. Its box position alone is not an overlap bug.
      assert.equal(feedbackLayout.headingPosition, 'sticky');
      assert(feedbackLayout.headingLayer > 0, 'sticky heading must remain above normal-flow feedback');
      await close();
      await openOverview();
      assert.equal(await page.locator('#toast-root .toast.good').count(), 0, 'stale success feedback must clear when changing panels');
      await activate('#overview-settle');
      await activate('#week-confirm');
      const attribution = await page.locator('.week-attribution[data-attribution-week="1"]').innerText();
      assert(attribution.length > 0);
      await page.locator('.week-attribution').scrollIntoViewIfNeeded();
      await fit();
      if (width !== 667) await screenshot('attribution');
      await activate('#week-next');
      if (await page.locator('[data-choice]:not(:disabled)').count()) await activate('[data-choice]:not(:disabled):first-child');
      await openOverview();
      await activate('#overview-history > summary');
      await activate('#overview-review');
      const history = page.locator('[data-attribution-week="1"]');
      const historyDetails = history.locator('xpath=..');
      if (await historyDetails.evaluate(element => element.tagName === 'DETAILS' && !element.open)) await historyDetails.locator('summary').click();
      assert.equal(await history.innerText(), attribution);
      await history.scrollIntoViewIfNeeded();
      await fit();
      await activate('#history-back');
      await page.locator('.pressure-flow').waitFor();
      await close();
    });

    await check('three persona cards, keyboard semantics and Worker result do not mutate the run', async () => {
      await openTool('tech');
      if (await page.locator('#tech-scan:enabled').count()) await activate('#tech-scan');
      await activate('#tech-strategy');
      const before = await readRun();
      await activate('#strategy-run');
      await page.locator('#strategy-result-title').waitFor();
      assert.deepEqual(await readRun(), before);
      assert.equal(await page.locator('.strategy-persona input[type="radio"]').count(), 3);
      await page.locator('.strategy-personas').scrollIntoViewIfNeeded();
      await fit();
      if (width !== 667) await screenshot('personas');
      await activate('label.strategy-persona--ecology');
      assert.equal(await page.locator('input[value="ecology"]').isChecked(), true);
      assert.match(await page.locator('#strategy-plan').innerText(), /草场优先/);
      await page.locator('.strategy-visual-summary').scrollIntoViewIfNeeded();
      await fit();
      if (width !== 667) await screenshot('summary');
      await activate('#strategy-reserves');
      await activate('#reserve-back');
      assert.equal(await page.locator('input[value="ecology"]').isChecked(), true);
      await close();
    });

    await check('modal blocks background movement and long scroll retains fixed title', async () => {
      await openTool('market');
      assert.equal(await page.evaluate(() => document.querySelector('#hud').inert), true);
      assert.equal(await page.evaluate(() => document.querySelector('#title-screen').inert), true);
      const before = await page.evaluate(() => window.__MUYUN_STATE__.toData().player);
      await page.keyboard.down('w');
      await page.waitForTimeout(120);
      await page.keyboard.up('w');
      const after = await page.evaluate(() => window.__MUYUN_STATE__.toData().player);
      assert.deepEqual(after, before);
      const touchControlsCovered = await page.evaluate(() => ['joystick', 'btn-interact'].every(id => {
        const element = document.getElementById(id), rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return true;
        const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return !element.contains(top);
      }));
      assert.equal(touchControlsCovered, true, 'joystick and interaction button must not cover modal');
      if (touch) {
        const cdp = await context.newCDPSession(page);
        const box = await page.locator('#modal-card').boundingBox();
        const x = Math.round(box.x + box.width * .72), startY = Math.round(box.y + box.height - 28);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
        for (let step = 1; step <= 6; step++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(startY - step * 25) }] });
          await page.waitForTimeout(20);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForFunction(() => document.querySelector('#modal-card').scrollTop > 0);
        assert.deepEqual(await page.evaluate(() => window.__MUYUN_STATE__.toData().player), before, 'swiping a long modal must not drag the scene');
      }
      await page.locator('#modal-card').evaluate(element => { element.scrollTop = element.scrollHeight; });
      await fit();
      const heading = await page.locator('.modal-head').boundingBox();
      assert(heading && heading.y >= 0 && heading.y < height, 'long modal heading must remain visible');
      await close();
      assert.equal(await page.evaluate(() => document.querySelector('#hud').inert), false);
    });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}

async function runInvitation(confirmRestart) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push({ viewport: 'invitation', message: error.message }));
  try {
    await page.goto(url);
    await page.locator('#btn-new').click();
    await page.locator('#app[data-playing="true"]').waitFor();
    await page.locator('#tutorial-invitation:not(.hidden)').waitFor();
    // These two visibility predicates are exactly the inputs to UIManager.isBlocking.
    assert.equal(await page.locator('#modal-root').isVisible(), false);
    assert.equal(await page.locator('#dialogue').isVisible(), false);
    const before = await page.evaluate(() => ({
      year: localStorage.getItem('muyun-save'), winter: localStorage.getItem('muyun-save-winter'),
      run: JSON.stringify(window.__MUYUN_STATE__.run),
    }));
    assert.notEqual(before.year, null);
    await page.locator('#tutorial-invitation-start').click();
    await page.locator('#tutorial-settle').click();
    await page.locator('#tutorial-enter-year').click();
    await page.locator('#new-confirm').waitFor();
    assert.deepEqual(await page.evaluate(() => ({
      year: localStorage.getItem('muyun-save'), winter: localStorage.getItem('muyun-save-winter'),
      run: JSON.stringify(window.__MUYUN_STATE__.run),
    })), before, 'tutorial and replacement prompt must preserve the existing run and save bytes');
    if (!confirmRestart) {
      await page.locator('#new-cancel').click();
      assert.equal(await page.evaluate(() => localStorage.getItem('muyun-save')), before.year);
      assert.equal(await page.locator('#tutorial-invitation').isVisible(), false);
      await page.reload();
      await page.locator('#btn-continue').click();
      await page.locator('#app[data-playing="true"]').waitFor();
      assert.equal(await page.locator('#tutorial-invitation').isVisible(), false, 'invitation must not repeat after it was offered');
    } else {
      await page.locator('#new-confirm').click();
      await page.waitForFunction(() => window.__MUYUN__.scene.isActive('RanchScene'));
      assert.equal(await page.locator('#modal-root').isVisible(), false);
      assert.equal(await page.locator('#hud').isVisible(), true);
      assert.equal(await page.evaluate(() => window.__MUYUN_STATE__.week), 1);
      await page.locator('#hud-note > summary').click();
      await page.locator('#btn-overview').click();
      await page.locator('.pressure-flow').waitFor();
      await page.locator('#overview-pasture').click();
      const beforeActions = await page.evaluate(() => window.__MUYUN_STATE__.actionsLeft);
      await page.locator('[data-graze="P1"]').click();
      assert.equal(await page.evaluate(() => window.__MUYUN_STATE__.actionsLeft), beforeActions - 1, 'restarted ranch navigation and actions must remain bound');
    }
    const name = `first full run has a nonblocking one-time invitation; tutorial replacement ${confirmRestart ? 'confirms and restarts an operable ranch' : 'cancels without changing save bytes'}`;
    passed.push(name);
    console.log(`PASS ${name}`);
  } finally { await context.close(); }
}

try {
  if (mode !== 'ui') await measureColdLoad();
  if (mode !== 'performance') {
    await runInvitation(false);
    await runInvitation(true);
    for (const [width, height, touch] of [[1280, 720, false], [844, 390, true], [667, 375, true]]) await runUi(width, height, touch);
    assert.deepEqual(errors, []);
    assert.deepEqual(failedResources, []);
    assert.deepEqual(consoleWarnings, []);
    const report = {
      checkedAt: new Date().toISOString(), url, browser: browser.version(), passed, errors, failedResources, consoleWarnings, browserGraphicsWarnings,
      limitations: 'Chromium desktop and emulated landscape touch contexts. Not verified on physical iOS/Android, Safari/WebKit, screen readers, low-end hardware, browser chrome resize or real notched screens. No claim about teaching effectiveness.',
    };
    await writeFile(`${out}/${label}-results.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
} finally { await browser.close(); }
