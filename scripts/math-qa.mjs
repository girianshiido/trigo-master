import assert from 'node:assert/strict';
import {chromium,browserOptions,base,importFixture,geometry} from './qa-helpers.mjs';
const browser=await chromium.launch(browserOptions);
try{
 for(const [width,height] of [[320,568],[390,844],[1440,900],[568,320]]){
  const c=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:width<900}),page=await c.newPage();await page.goto(base,{waitUntil:'networkidle'});await importFixture(page,'direct');await page.locator('.continue-game').tap();await page.evaluate(()=>document.fonts.ready);await geometry(page,width,height);
  const sizes=await page.evaluate(()=>{const f=document.querySelector('#question-angle mfrac').getBoundingClientRect();return{fraction:f.height,parens:[...document.querySelectorAll('.math-parenthesis')].map(e=>e.getBoundingClientRect().height),font:document.fonts.check('30px "STIX Two Math"'),roots:[...document.querySelectorAll('.answer-choice .unified-root')].map(e=>{const r=e.getBoundingClientRect(),n=e.querySelector('text').getBoundingClientRect();return{w:r.width,number:n.width};})};});
  assert.ok(sizes.font);assert.equal(sizes.parens.length,2);assert.ok(sizes.parens.every(h=>h>=sizes.fraction-2));assert.ok(sizes.roots.every(r=>r.w>r.number+4));
  // Confirm every value, including both radicals and negative fractions, remains inside its answer card.
  const clips=await page.locator('.answer-choice math').evaluateAll(ms=>ms.map(e=>{const r=e.getBoundingClientRect(),b=e.closest('button').getBoundingClientRect();return r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom;}));assert.ok(clips.every(Boolean));
  await page.screenshot({path:`test-results/math-${width}.png`});if(width===1440)await page.locator('.question-panel').screenshot({path:'test-results/math-detail.png'});console.log(`PASS MathML ${width}×${height}: loaded math font, stretchy parentheses, radicals, unclipped fractions`);await c.close();
 }
}finally{await browser.close();}
