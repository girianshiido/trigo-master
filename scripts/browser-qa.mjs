import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const browser = await chromium.launch({ ...(process.env.TRIGO_CHROME ? {executablePath:process.env.TRIGO_CHROME} : {}), headless: true });
const base = process.env.TRIGO_QA_URL || 'http://127.0.0.1:5180/';
await mkdir('test-results', { recursive: true });
const errors = [];
function target(text) {
  const m = text.replace('−', '-').match(/^(-?)(\d*)π(?:\/(\d+))?$/);
  if (text === '0') return 0;
  assert.ok(m, `Unrecognized angle: ${text}`);
  const units = (m[1] ? -1 : 1) * Number(m[2] || 1) * 12 / Number(m[3] || 1);
  return ((units % 24) + 24) % 24;
}
try {
  for (const [width, height] of [[320,568],[360,640],[390,844],[768,1024],[1440,900],[667,375],[568,320]]) {
    const context = await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base, {waitUntil:'domcontentloaded'});
    await page.locator('.start').waitFor();
    if (width === 390 || width === 1440) await page.screenshot({path:`test-results/home-${width}.png`,fullPage:true});
    await page.locator('[data-count="5"]').click();
    await page.locator('.start').click();
    assert.equal(await page.locator('.point').count(), 16);
    const geometry = await page.evaluate(() => {
      const box = sel => { const r = document.querySelector(sel).getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
      return {circle:box('.circle-board'),angle:box('#question-angle'),panel:box('.question-panel'),scroll:document.documentElement.scrollHeight,viewport:innerHeight};
    });
    for (const key of ['circle','angle','panel']) {
      const b = geometry[key];
      assert.ok(b.x >= -1 && b.y >= -1 && b.right <= width + 1 && b.bottom <= height + 1, `${width}×${height}: ${key} clipped ${JSON.stringify(b)}`);
    }
    assert.ok(Math.abs(geometry.circle.width - geometry.circle.height) < 1, 'Circle must remain round');
    if (geometry.scroll > height + 1) { await page.screenshot({path:`test-results/overflow-${width}.png`,fullPage:true}); console.log(geometry); console.log(await page.evaluate(()=>[...document.querySelectorAll('*')].map(e=>({tag:e.tagName,cls:e.className?.baseVal??e.className,bottom:e.getBoundingClientRect().bottom,h:e.getBoundingClientRect().height})).filter(e=>e.bottom>innerHeight+.5)));  }
    assert.ok(geometry.scroll <= height + 1, `Game scrolls at ${width}×${height}`);
    const points = await page.locator('.point .dot').evaluateAll(dots => dots.map(dot => {const r=dot.getBoundingClientRect(),b=dot.closest('.circle-board').getBoundingClientRect();return {w:r.width,h:r.height,radius:Math.hypot(r.x+r.width/2-b.x-b.width/2,r.y+r.height/2-b.y-b.height/2),expected:b.width*150/400};}));
    for (const dot of points) {assert.ok(Math.abs(dot.w-dot.h)<.1, 'Point is elliptical'); assert.ok(Math.abs(dot.radius-dot.expected)<.2, 'Point is off the circle');}
    if (width === 390 || width === 1440 || width === 320 || height === 320) await page.screenshot({path:`test-results/game-${width}.png`});
    const first = await page.locator('.question-panel').getAttribute('aria-label');
    const p = target(first.replace('Place l’angle ', ''));
    await page.locator(`[data-point="${p === 0 ? 12 : 0}"]`).tap();
    await page.waitForTimeout(80);
    assert.equal(await page.locator('.point.correct').getAttribute('data-point'), String(p));
    assert.equal(await page.locator('#progress-count').innerText(), '1 / 5');
    if (width === 390) await page.screenshot({path:'test-results/error-390.png'});
    await page.locator(`[data-point="${p}"]`).tap();
    assert.equal(await page.locator('#progress-count').innerText(), '1 / 5');
    await page.waitForTimeout(530);
    assert.equal(await page.locator('#progress-count').innerText(), '2 / 5');
    const second = (await page.locator('.question-panel').getAttribute('aria-label')).replace('Place l’angle ', '');
    assert.ok(!second.includes('/') && Math.abs(Number(second.replace('−','-').replace('π',''))) >= 2, 'Second question must have a large integer multiple');
    for (let i = 2; i <= 5; i++) {
      const label = (await page.locator('.question-panel').getAttribute('aria-label')).replace('Place l’angle ', '');
      await page.locator(`[data-point="${target(label)}"]`).tap();
      if (i < 5) assert.equal(await page.locator('#progress-count').innerText(), `${i+1} / 5`);
    }
    assert.equal(await page.locator('.result-score').innerText(), '4/5');
    assert.equal(await page.locator('.review-item').count(), 1);
    if (width === 390) await page.screenshot({path:'test-results/results-390.png',fullPage:true});
    await page.locator('.help-button').click();
    assert.equal(await page.locator('dialog .angle-labels>span').count(), 16);
    if (width === 390) await page.screenshot({path:'test-results/help-390.png',fullPage:true});
    await page.locator('.understood').click();
    await page.locator('.replay').click();
    assert.equal(await page.locator('#progress-count').innerText(), '1 / 5');
    console.log(`PASS ${width}×${height}: full circle and angle visible; touch, correction, progression, results, help, replay`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
