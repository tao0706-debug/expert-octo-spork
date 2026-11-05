/* Integration smoke test. Run alongside the documented static server. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const url = process.env.ATLAS_URL || 'http://127.0.0.1:8000/';
const root = path.resolve(__dirname, '..');

async function sample(page) {
  return page.locator('#landscape').evaluate(c => {
    const s = document.createElement('canvas'); s.width = 120; s.height = 45;
    const p = s.getContext('2d'); p.drawImage(c, 0, 0, 120, 45);
    return Array.from(p.getImageData(0, 0, 120, 45).data).filter((_, i) => i % 4 === 0);
  });
}
async function ready(page) { await page.waitForFunction(() => window.inkAtlas?.ready, null, { timeout: 30000 }); }

(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(url); await ready(page);
    assert.equal(await page.evaluate(() => inkAtlas.materialCount), 48);
    assert.equal(await page.evaluate(() => inkAtlas.wonderCount), 12);
    let recipe = await page.evaluate(() => inkAtlas.recipe);
    assert.equal(recipe.regions.length, 24);
    assert.equal(recipe.reservedSpace, true);
    assert.equal(recipe.creatures.length, 3); assert.equal(recipe.passages.length, 6);
    assert.equal(new Set(recipe.creatures.map(c => c.id)).size, 3);
    assert(Math.max(...recipe.passages.map(c => c.opacity)) - Math.min(...recipe.passages.map(c => c.opacity)) > .1);
    assert(['溪山平遠','一水兩岸','雲嶺回環'].includes(recipe.composition));
    assert(await page.locator('.collector-seal').evaluate(e => getComputedStyle(e).backgroundImage.length > 100));
    assert.equal(new Set(recipe.regions.map(r => r.id)).size, 24);
    assert(await page.evaluate(() => Array.from(document.fonts).some(f => f.family.replaceAll('"', '') === 'Atlas ZhengKai' && f.status === 'loaded')), 'Embedded regular-script font did not load');
    for (const id of ['regenerate', 'inspect', 'save', 'sound']) {
      const target = await page.locator('#'+id).boundingBox();
      assert(target.width >= 90 && target.height >= 70, `${id} control is too small`);
    }
    await page.click('#guide-toggle'); assert.equal(await page.locator('#guide-details').isVisible(), true);
    await page.click('#guide-toggle'); assert.equal(await page.locator('#guide-details').isVisible(), false);
    const initial = await sample(page);
    await page.selectOption('#mode', 'rift'); await page.locator('#intensity').fill('95');
    await page.click('#regenerate');
    await page.waitForFunction(() => document.querySelector('#landscape').width === 1600);
    await page.waitForTimeout(1000); await page.screenshot({ path: '/tmp/atlas-transition.png' });
    await ready(page);
    recipe = await page.evaluate(() => inkAtlas.recipe);
    assert.equal(recipe.mode, 'rift'); assert.equal(recipe.intensity, .95);
    assert(recipe.regions.some(r => r.warp > .02));
    const second = await sample(page);
    const delta = initial.reduce((sum, v, i) => sum + Math.abs(v - second[i]), 0) / initial.length;
    assert(delta > 8, `Painting difference too small: ${delta}`);
    await page.screenshot({ path: '/tmp/atlas-rift.png', fullPage: true });
    await page.click('#inspect'); await page.waitForFunction(() => document.querySelector('#viewer').open);
    await page.click('#zoom-in'); assert.equal(await page.locator('#detail-image').evaluate(e => e.getBoundingClientRect().width), 3200);
    await page.click('#viewer-close');
    const downloadEvent = page.waitForEvent('download'); await page.click('#save');
    const download = await downloadEvent; const downloadPath = await download.path();
    const png = fs.readFileSync(downloadPath);
    assert.equal(png.readUInt32BE(16), 3320); assert.equal(png.readUInt32BE(20), 1450);
    await page.click('#grid'); assert.equal(await page.getAttribute('#grid', 'aria-pressed'), 'true');
    assert.equal(await page.locator('#materials, #material-gallery, #material-count').count(), 0);
    await page.click('#work-note-toggle'); assert.equal(await page.getAttribute('#work-note-toggle', 'aria-expanded'), 'true');
    assert.equal(await page.locator('#work-note').isVisible(), true);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: '/tmp/atlas-mobile.png', fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.selectOption('#mode', 'wander'); await page.click('#regenerate'); await ready(page);
    assert.equal(await page.evaluate(() => inkAtlas.recipe.mode), 'wander');
    await page.click('#sound'); assert.equal(await page.getAttribute('#sound', 'aria-pressed'), 'true');
    await page.click('#sound'); assert.equal(await page.getAttribute('#sound', 'aria-pressed'), 'false');
    // Fulfill the single HTML from local disk while all actual network is offline.
    // Any missing/external material would fail to load in this context.
    await page.route('**/offline-atlas.html', route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(root, '无何有之乡.html'), 'utf8') }));
    await page.context().setOffline(true);
    await page.goto(new URL('offline-atlas.html', url).href); await ready(page);
    assert.equal(await page.evaluate(() => inkAtlas.materialCount), 48);
    await page.selectOption('#mode', 'fold'); await page.click('#regenerate'); await ready(page);
    assert.equal(await page.evaluate(() => inkAtlas.recipe.mode), 'fold');
    assert.equal(await page.evaluate(() => inkAtlas.wonderCount), 12);
    const seeds = new Set();
    for (let i = 0; i < 4; i++) {
      await page.click('#regenerate'); await ready(page);
      const r = await page.evaluate(() => inkAtlas.recipe);
      seeds.add(r.seed); assert.equal(new Set(r.regions.map(r => r.id)).size, 24);
    }
    assert.equal(seeds.size, 4); assert.deepEqual(errors, []);
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const handheld = await phone.newPage(); const phoneErrors = [];
    handheld.on('pageerror', error => phoneErrors.push(error.message));
    await handheld.emulateMedia({ reducedMotion: 'reduce' });
    await handheld.goto(url); await ready(handheld);
    assert(await handheld.evaluate(() => Array.from(document.fonts).some(f => f.family.replaceAll('"', '') === 'Atlas ZhengKai' && f.status === 'loaded')));
    for (const id of ['regenerate','inspect','save','sound','overview-toggle','guide-toggle']) {
      const target = await handheld.locator('#'+id).boundingBox(); assert(target.height >= 44, `${id} touch target below 44px`);
    }
    const bounds = await handheld.locator('#painting-viewport').boundingBox();
    const metrics = await handheld.locator('#painting-viewport').evaluate(e => ({ height: e.clientHeight, width: e.clientWidth, total: e.scrollWidth, scroll: e.scrollLeft }));
    assert(metrics.height > 380, `Mobile painting too short: ${metrics.height}`);
    assert(metrics.total > metrics.width * 2, 'Mobile painting was shrunk to a full-width strip');
    const beforePan = await handheld.evaluate(() => inkAtlas.recipe.seed);
    const touch = await phone.newCDPSession(handheld);
    const y = bounds.y + bounds.height * .45;
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 280, y }] });
    for (let i = 1; i <= 8; i++) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 280 - i * 23, y }] });
      await handheld.waitForTimeout(20);
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await handheld.waitForTimeout(250);
    assert(await handheld.locator('#painting-viewport').evaluate((e, old) => e.scrollLeft > old + 45, metrics.scroll), 'Native horizontal swipe did not pan');
    assert.equal(await handheld.evaluate(() => inkAtlas.recipe.seed), beforePan, 'Swipe accidentally regenerated the painting');
    await handheld.locator('#miniature').tap({ position: { x: 91, y: 18 } });
    await handheld.waitForTimeout(100);
    const mapped = await handheld.locator('#painting-viewport').evaluate(e => e.scrollLeft / (e.scrollWidth - e.clientWidth));
    assert(mapped > .75, `Miniature navigation did not move to right side: ${mapped}`);
    await handheld.locator('#overview-toggle').tap();
    await handheld.waitForFunction(() => document.querySelector('#painting-viewport').clientHeight < 200);
    assert.equal(await handheld.getAttribute('#overview-toggle', 'aria-pressed'), 'true');
    assert.equal(await handheld.evaluate(() => inkAtlas.recipe.seed), beforePan, 'Overview changed the actual painting');
    await handheld.locator('#overview-toggle').tap();
    await handheld.waitForFunction(() => document.querySelector('#painting-viewport').clientHeight > 380);
    await handheld.setViewportSize({ width: 844, height: 390 });
    assert(await handheld.locator('#painting-viewport').evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'Landscape layout did not return to panorama');
    await handheld.setViewportSize({ width: 390, height: 844 });
    assert.equal(await handheld.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await handheld.screenshot({ path: '/tmp/atlas-phone-scroll.png', fullPage: true });
    assert.deepEqual(phoneErrors, []); await phone.close();
    console.log(`PASS: 48 assets, 24 unique regions, all 3 modes, ${delta.toFixed(1)} mean pixel change, animated dissolve, 3320×1450 PNG, detail viewer, unified scroll, hidden library, embedded Kai font, large controls and guide, 12 wonders, 3 living presences, real touch swipe without regeneration, miniature navigation, overview, orientation change, sound, offline standalone + 5 recompositions. No script errors.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
