import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium,browserOptions,base,newGame,importFixture,currentTarget,answerCurrent,geometry,points,encoded} from './qa-helpers.mjs';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch(browserOptions),errors=[];
try{
 for(const [width,height] of [[320,568],[360,640],[390,844],[768,1024],[1440,900],[667,375],[568,320]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:width<900,reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  if(width===390||width===1440)await page.screenshot({path:`test-results/home-${width}.png`,fullPage:true});
  await newGame(page,`Élève ${width}`);await geometry(page,width,height);assert.equal(await page.locator('.point:not(:disabled)').count(),2);assert.equal(await page.locator('[data-guide]').count(),0);
  await page.locator('.help-button').tap();assert.equal(await page.locator('dialog .angle-labels>span').count(),2);await page.locator('.understood').tap();await page.locator('dialog').waitFor({state:'detached'});
  const first=await currentTarget(page);await page.locator(`.game [data-point="${first===0?12:0}"]`).tap();await page.waitForTimeout(80);assert.equal(await page.locator('.point.correct').getAttribute('data-point'),String(first));assert.equal(await page.locator('#progress-count').innerText(),'1 / 10');await page.waitForTimeout(550);assert.equal(await page.locator('#progress-count').innerText(),'2 / 10');
  await page.locator('.quit').tap();await page.locator('.back-home').tap();
  for(const [fixture,count,seen] of [['stage-2',6,8],['stage-4',8,16],['stage-8',24,24],['direct',0,24]]){
   await importFixture(page,fixture);await page.locator('.continue-game').tap();await geometry(page,width,height);assert.equal(await page.locator('.point:not(:disabled)').count(),count);assert.equal(await page.locator('.point').count(),seen);
   if(fixture==='stage-2'){assert.equal(await page.locator('[data-guide="vertical"]').count(),1);assert.equal(await page.locator('[data-guide="horizontal"]').count(),0);assert.equal(await page.locator('.game [data-point="6"]').isDisabled(),true);}
   if(fixture==='stage-4'){
    for(const guide of ['diagonal','horizontal','vertical'])assert.equal(await page.locator(`[data-guide="${guide}"]`).count(),1);
    for(const p of [2,4,8,10,14,16,20,22])assert.equal(await page.locator(`.game [data-point="${p}"]`).isDisabled(),true);
    for(const p of [0,3,6,9,12,15,18,21])assert.equal(await page.locator(`.game [data-point="${p}"]`).isDisabled(),false);
   }
   if(fixture==='stage-8'&&(width===390||width===1440||width===320))await page.screenshot({path:`test-results/game-${width}.png`});
   if(fixture==='direct'){assert.equal(await page.locator('.answer-choice').count(),4);if(width===390||width===320)await page.screenshot({path:`test-results/trig-${width}.png`});await answerCurrent(page);assert.equal(await page.locator('#progress-count').innerText(),'2 / 20');}
   await page.locator('.help-button').tap();assert.equal(await page.locator('dialog .angle-labels>span').count(),seen);await page.locator('.understood').tap();await page.locator('dialog').waitFor({state:'detached'});await page.locator('.quit').tap();await page.locator('.back-home').tap();
  }
  const zoom=await page.evaluate(()=>['dblclick','gesturestart','gesturechange'].map(name=>{const e=new Event(name,{cancelable:true,bubbles:true});document.dispatchEvent(e);return e.defaultPrevented;}));assert.deepEqual(zoom,[true,true,true]);assert.ok((await page.locator('meta[name="viewport"]').getAttribute('content')).includes('user-scalable=no'));
  console.log(`PASS ${width}×${height}: early/intermediate/24-point and QCM layouts; cumulative help; guides; correction; no zoom`);await context.close();
 }
 assert.deepEqual(errors,[]);
 // Complete the actual early journey using touch and verify automatic transitions.
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'networkidle'});await newGame(page,'Mon aventure <b>');
 for(const [count,enabled] of [[10,4],[8,6],[8,12],[10,8],[10,16]]){for(let i=0;i<count;i++)await answerCurrent(page);assert.equal(await page.locator('.point:not(:disabled)').count(),enabled);}
 assert.equal(await page.locator('#level').innerText(),'Expert');await page.locator('.quit').tap();assert.equal(await page.locator('.trig-menu').isDisabled(),false);
 await page.locator('.successes').tap();assert.ok(await page.locator('.achievement-card.unlocked').count()>=3);await page.screenshot({path:'test-results/achievements-390.png',fullPage:true});await page.locator('.adventure').tap();
 // Reload keeps the same grade and interrupted question, and backups are encrypted.
 await page.locator('.back-home').tap();await page.reload({waitUntil:'networkidle'});await page.locator('.recent-game').tap();assert.ok((await page.locator('.grade-chip').first().innerText()).includes('Expert'));await page.screenshot({path:'test-results/dashboard-390.png',fullPage:true});
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('.export-current').click()]);await download.saveAs('test-results/exported-save.json');const exported=JSON.parse(await readFile('test-results/exported-save.json','utf8'));assert.equal(exported.format,'trigo-master-save');assert.equal(exported.stage,undefined);assert.equal(exported.name,undefined);
 await page.locator('.back-home').tap();
 // Reject a manually edited file, without adding a save or resetting another.
 const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.locator('.import-button').click()]);await chooser.setFiles('test-results/fixtures/tampered.json');await page.locator('dialog').waitFor();assert.ok((await page.locator('dialog').innerText()).includes('altérée'));await page.locator('[data-close]').tap();
 await importFixture(page,'inverse-partial');await page.locator('.continue-game').tap();assert.equal(await page.locator('.chosen-point').getAttribute('data-point'),'4');await page.locator('.game [data-point="4"]').tap();assert.equal(await page.locator('#progress-count').innerText(),'1 / 20');await page.locator('.game [data-point="20"]').tap();assert.equal(await page.locator('#progress-count').innerText(),'2 / 20');await page.locator('.quit').tap();await page.locator('.back-home').tap();
 await importFixture(page,'inverse-single');await page.locator('.continue-game').tap();await page.locator('.game [data-point="0"]').tap();assert.equal(await page.locator('#progress-count').innerText(),'2 / 20');await page.locator('.quit').tap();await page.locator('.back-home').tap();
 // Certify both trig exams after angle mastery: the final grade needs all three.
 await importFixture(page,'angles-certified');await page.locator('.trig-menu').tap();await page.locator('.start-direct').tap();for(let i=0;i<20;i++)await answerCurrent(page);assert.ok((await page.locator('.result-caption').innerText()).includes('Maître'));await page.locator('.next-inverse').tap();for(let i=0;i<20;i++)await answerCurrent(page);assert.equal(await page.locator('.results h1').innerText(),'Grand Maître.');await page.screenshot({path:'test-results/grand-master-390.png',fullPage:true});await page.locator('.adventure').tap();await page.locator('.back-home').tap();
 await page.locator('.load-game').tap();await page.locator('.save-card').first().waitFor();const before=await page.locator('.save-card').count();await page.locator('.delete-slot').first().tap();await page.locator('[data-close]').tap();assert.equal(await page.locator('.save-card').count(),before);await page.locator('.delete-slot').first().tap();await page.locator('.delete-confirm').tap();await page.waitForFunction(n=>document.querySelectorAll('.save-card').length===n,before-1);
 assert.deepEqual(errors,[]);console.log('PASS real journey, unlocked trig, achievements, reload, encrypted export, tamper rejection, partial inverse, one-point equation, Grand Maître, deletion');
 await context.close();
}finally{await browser.close();}
