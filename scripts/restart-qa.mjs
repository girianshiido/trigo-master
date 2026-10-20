import assert from 'node:assert/strict';
import {chromium,browserOptions,base,loadFixture,answerCurrent,currentTarget,geometry,points} from './qa-helpers.mjs';
const browser=await chromium.launch(browserOptions);
async function footerFits(page,width,height){
 const boxes=await page.locator('.game-actions button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
 assert.equal(boxes.length,2);for(const box of boxes)assert.ok(box.x>=0&&box.y>=0&&box.right<=width+.5&&box.bottom<=height+.5,JSON.stringify(box));assert.ok(boxes[0].right<=boxes[1].x);
}
try{
 for(const [width,height] of [[320,568],[360,640],[390,844],[768,1024],[1440,900],[667,375],[568,320]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:width<900}),page=await context.newPage();await page.goto(base,{waitUntil:'networkidle'});await loadFixture(page,'stage-8');await page.locator('.continue-game').tap();
  await geometry(page,width,height);await footerFits(page,width,height);assert.equal(await page.locator('#level').innerText(),'Maître');
  await answerCurrent(page);await answerCurrent(page);assert.equal(await page.locator('#progress-count').innerText(),'3 / 40');
  const target=await currentTarget(page);await page.locator(`[data-point="${points.find(n=>n!==target)}"]`).tap();
  // Restart during the 500 ms correction, before its old callback can run.
  await page.locator('.restart').tap();assert.equal(await page.locator('#progress-count').innerText(),'1 / 40');await page.waitForTimeout(650);assert.equal(await page.locator('#progress-count').innerText(),'1 / 40');assert.equal(await page.locator('#level').innerText(),'Maître');assert.equal(await page.locator('.point.wrong,.point.correct,.feedback.visible').count(),0);
  if(width===390||width===568)await page.screenshot({path:`test-results/restart-${width}.png`});
  await page.locator('.quit').tap();assert.equal(await page.locator('.grade-chip').first().innerText(),'Maître');await page.locator('.back-home').tap();await page.reload({waitUntil:'networkidle'});await page.locator('.recent-game').tap();await page.locator('.continue-game').tap();assert.equal(await page.locator('#progress-count').innerText(),'1 / 40');
  console.log(`PASS ${width}×${height}: restart controls visible, instant retry after error, no stale timer, grade and saved restart retained`);await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage();await page.goto(base,{waitUntil:'networkidle'});
 await loadFixture(page,'direct');await page.locator('.continue-game').tap();for(let i=0;i<3;i++)await answerCurrent(page);await page.locator('.restart').tap();assert.equal(await page.locator('#progress-count').innerText(),'1 / 20');assert.equal(await page.locator('#level').innerText(),'Lecture');assert.equal(await page.locator('.function-name').textContent(),'cos');await page.locator('.quit').tap();await page.locator('.back-home').tap();
 await loadFixture(page,'inverse-partial');await page.locator('.continue-game').tap();assert.equal(await page.locator('.chosen-point').count(),1);await page.locator('.restart').tap();assert.equal(await page.locator('.chosen-point').count(),0);assert.equal(await page.locator('#progress-count').innerText(),'1 / 20');assert.equal(await page.locator('#level').innerText(),'Équations');await answerCurrent(page);assert.equal(await page.locator('#progress-count').innerText(),'2 / 20');await page.locator('.restart').tap();await page.locator('.quit').tap();await page.locator('.back-home').tap();await page.reload({waitUntil:'networkidle'});await page.locator('.recent-game').tap();await page.locator('.continue-game').tap();assert.equal(await page.locator('#progress-count').innerText(),'1 / 20');assert.equal(await page.locator('.chosen-point').count(),0);await page.locator('.quit').tap();
 await page.locator('.training').tap();await page.locator('#practice-stage').selectOption('4');await page.locator('#practice-count').selectOption('40');await page.locator('.training-form [type="submit"]').tap();await answerCurrent(page);await page.locator('.restart').tap();assert.equal(await page.locator('#progress-count').innerText(),'1 / 40');assert.equal(await page.locator('.point:not(:disabled)').count(),8);
 console.log('PASS direct/inverse/practice: same mode and question count, cleared partial selection, persisted reset');await context.close();
}finally{await browser.close();}
