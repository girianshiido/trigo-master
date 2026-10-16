import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ ...(process.env.TRIGO_CHROME ? { executablePath: process.env.TRIGO_CHROME } : {}), headless: true });
const base = process.env.TRIGO_QA_URL || 'http://127.0.0.1:5180/';
const target = label => {
  const text = label.replace('Place l’angle ', '').replace('−', '-');
  if (text === '0') return 0;
  const m = text.match(/^(-?)(\d*)π(?:\/(\d+))?$/);
  assert.ok(m);
  return (((m[1] ? -1 : 1) * Number(m[2] || 1) * 12 / Number(m[3] || 1)) % 24 + 24) % 24;
};
try {
  for (const forceAac of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await context.addInitScript(({ forceAac }) => {
      window.__audioStarts = [];
      window.__audioActive = new Set();
      if (forceAac) {
        const original = HTMLMediaElement.prototype.canPlayType;
        HTMLMediaElement.prototype.canPlayType = function (type) { return type.includes('ogg') ? '' : original.call(this, type); };
      }
      const original = AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource = function () {
        const source = original.call(this), start = source.start.bind(source), stop = source.stop.bind(source);
        source.start = (...args) => {
          const data = source.buffer.getChannelData(0);
          window.__audioStarts.push({ duration: source.buffer.duration, peak: Math.max(...data.map(Math.abs)), state: this.state });
          window.__audioActive.add(source);
          source.addEventListener('ended', () => window.__audioActive.delete(source));
          start(...args);
        };
        source.stop = (...args) => { window.__audioActive.delete(source); stop(...args); };
        return source;
      };
    }, { forceAac });
    const page = await context.newPage();
    const failures = [], audioRequests = [];
    page.on('pageerror', e => failures.push(e.message));
    page.on('response', r => { if (/\.(ogg|m4a)(?:\?|$)/.test(r.url())) { audioRequests.push(r.url()); if (!r.ok()) failures.push(r.url()); } });
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.equal(audioRequests.length, 6);
    assert.ok(audioRequests.every(url => url.includes(forceAac ? '.m4a' : '.ogg')));
    // Silence persists after reload and a muted start creates no source.
    await page.locator('.sound-button').tap();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.sound-button').getAttribute('aria-pressed'), 'false');
    await page.locator('[data-count="5"]').tap();
    await page.locator('.start').tap();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__audioStarts.length), 0);
    await page.locator('.sound-button').tap();
    await page.waitForFunction(() => window.__audioStarts.length === 1);
    assert.equal(await page.evaluate(() => window.__audioActive.size), 1);
    // Muting stops a sounding cue immediately and suppresses the next answer.
    await page.locator('.sound-button').tap();
    assert.equal(await page.evaluate(() => window.__audioActive.size), 0);
    let point = target(await page.locator('.question-panel').getAttribute('aria-label'));
    await page.locator(`[data-point="${point}"]`).tap();
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.__audioStarts.length), 1);
    await page.locator('.sound-button').tap();
    await page.waitForFunction(() => window.__audioStarts.length === 2);
    point = target(await page.locator('.question-panel').getAttribute('aria-label'));
    await page.locator(`[data-point="${point === 0 ? 12 : 0}"]`).tap();
    await page.waitForFunction(() => window.__audioStarts.length === 3);
    await page.waitForTimeout(550);
    for (let i = 3; i <= 5; i++) {
      point = target(await page.locator('.question-panel').getAttribute('aria-label'));
      await page.locator(`[data-point="${point}"]`).tap();
    }
    await page.waitForFunction(() => window.__audioStarts.length === 6);
    const events = await page.evaluate(() => window.__audioStarts);
    assert.ok(events.every(e => e.state === 'running' && e.peak > .05 && e.peak < 1));
    assert.ok(events[2].duration > .37 && events[2].duration < .45, 'Error cue missing');
    assert.ok(events[5].duration > .85, 'Finish melody missing');
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => window.__audioActive.size), 0);
    await page.locator('.replay').tap();
    await page.waitForFunction(() => window.__audioStarts.length === 7);
    const last = await page.evaluate(() => window.__audioStarts.at(-1));
    assert.ok(last.duration > .47 && last.duration < .55, 'Start cue missing');
    assert.deepEqual(failures, []);
    console.log(`PASS ${forceAac ? 'AAC fallback' : 'OGG'}: 6 files decoded; user-gesture playback, non-silent signal, correct/error/finish/start, immediate mute, saved preference`);
    await context.close();
  }
} finally { await browser.close(); }
