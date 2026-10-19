import assert from 'node:assert/strict';
import {chromium,browserOptions,base,newGame,answerCurrent} from './qa-helpers.mjs';
const browser=await chromium.launch(browserOptions);
const prefix='trigo-master-save:';
async function addFaults(context,mode){
 await context.addInitScript(mode=>{
  const originalOpen=IDBFactory.prototype.open,originalLocks=navigator.locks;
  Object.defineProperty(IDBFactory.prototype,'open',{value(...args){if(sessionStorage.getItem('qa-primary')!=='healthy')throw new DOMException('Internal error.','UnknownError');return originalOpen.apply(this,args);}});
  Object.defineProperty(navigator,'locks',{get(){
   if(sessionStorage.getItem('qa-locks')==='healthy')return originalLocks;
   if(mode==='absent')return undefined;
   return {request:async(name,options,callback)=>{if(mode==='reject')throw new DOMException('Internal error.','UnknownError');return callback(null);},query:async()=>{throw new DOMException('Internal error.','UnknownError');}};
  }});
 },mode);
}
async function localEnvelope(page){return page.evaluate(prefix=>{const key=Object.keys(localStorage).find(k=>k.startsWith(prefix));return key?JSON.parse(localStorage.getItem(key)):null;},prefix);}
async function quitHome(page){await page.locator('.quit').click();await page.locator('.back-home').click();await page.locator('.title-logo').waitFor();}
async function primaryRecords(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('trigo-master',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('saves','readonly').objectStore('saves').getAll();q.onsuccess=()=>{db.close();resolve(q.result);};q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}));}
try{
 for(const mode of ['null','reject','absent']){
  const context=await browser.newContext({viewport:{width:960,height:860},hasTouch:true});await addFaults(context,mode);
  const one=await context.newPage();await one.goto(base,{waitUntil:'networkidle'});await newGame(one,'Vidéo — partie protégée');
  for(let i=0;i<3;i++)await answerCurrent(one);await one.locator('.quit').click();
  const encrypted=await localEnvelope(one);assert.equal(encrypted.format,'trigo-master-save');assert.ok(encrypted.iv&&encrypted.data);assert.ok(!JSON.stringify(encrypted).includes('partie protégée'));assert.equal(encrypted.stage,undefined);
  const two=await context.newPage();await two.goto(base,{waitUntil:'networkidle'});await two.locator('.recent-game').click();await two.locator('dialog').waitFor();assert.ok((await two.locator('dialog').innerText()).includes('déjà ouverte'));
  await one.locator('.back-home').click();await two.locator('[data-close]').click();await two.locator('dialog').waitFor({state:'detached'});await two.locator('.recent-game').click();await two.locator('.continue-game').click();assert.equal(await two.locator('#progress-count').innerText(),'4 / 10');await answerCurrent(two);await quitHome(two);
  await one.reload({waitUntil:'networkidle'});await one.locator('.recent-game').click();await one.locator('.continue-game').click();assert.equal(await one.locator('#progress-count').innerText(),'5 / 10');
  // Reload while playing, without visiting the dashboard first: no phantom lease remains.
  await one.reload({waitUntil:'networkidle'});await one.locator('.recent-game').click();await one.locator('.continue-game').click();assert.equal(await one.locator('#progress-count').innerText(),'5 / 10');await quitHome(one);
  // On recovery, encrypted fallback data is read and moved back to IndexedDB on save.
  await one.evaluate(()=>{sessionStorage.setItem('qa-primary','healthy');sessionStorage.setItem('qa-locks','healthy');});await one.reload({waitUntil:'networkidle'});await one.locator('.recent-game').click();await one.locator('.continue-game').click();assert.equal(await one.locator('#progress-count').innerText(),'5 / 10');await quitHome(one);
  assert.equal(await localEnvelope(one),null);assert.equal((await primaryRecords(one)).length,1);
  // Preserve the encrypted copy while simulating a later primary outage.
  const stored=(await primaryRecords(one))[0];await one.evaluate(({prefix,stored})=>{localStorage.setItem(prefix+stored.id,JSON.stringify(stored));sessionStorage.removeItem('qa-primary');sessionStorage.removeItem('qa-locks');},{prefix,stored});await one.reload({waitUntil:'networkidle'});
  await one.locator('.load-game').click();await one.locator('.delete-slot').click();await one.locator('.delete-confirm').click();await one.locator('.save-card').waitFor({state:'detached'});await one.locator('.back-home').click();
  await one.evaluate(()=>{sessionStorage.setItem('qa-primary','healthy');sessionStorage.setItem('qa-locks','healthy');});await one.reload({waitUntil:'networkidle'});assert.equal(await one.locator('.recent-game').count(),0);assert.equal((await primaryRecords(one)).length,0);
  console.log(`PASS ${mode}: single-tab start, encrypted fallback, true two-tab refusal, reload, primary recovery, deletion without resurrection`);await context.close();
 }
 // A malformed local record is reported and deletable by its storage identity.
 const corrupt=await browser.newContext();await addFaults(corrupt,'null');const page=await corrupt.newPage();await page.goto(base,{waitUntil:'networkidle'});
 await page.evaluate(prefix=>localStorage.setItem(prefix+'corrupt','null'),prefix);await page.reload({waitUntil:'networkidle'});await page.locator('.load-game').click();await page.locator('.damaged').waitFor();await page.locator('.delete-slot').click();await page.locator('.delete-confirm').click();await page.locator('.damaged').waitFor({state:'detached'});await corrupt.close();console.log('PASS corrupt fallback: record cannot load and can be deleted');
 const blocked=await browser.newContext();await addFaults(blocked,'null');await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError');}}));
 const denied=await blocked.newPage();await denied.goto(base,{waitUntil:'networkidle'});await denied.locator('.new-game').click();await denied.locator('.name-form [type="submit"]').click();await denied.locator('dialog').filter({hasText:'Une action n’a pas abouti.'}).waitFor();
 const message=(await denied.locator('dialog').allTextContents()).join(' ');assert.ok(message.includes('stockage local'));assert.ok(!message.includes('déjà ouverte'));await blocked.close();console.log('PASS fully blocked storage: clear permission message, never a fictitious other-tab conflict');
}finally{await browser.close();}
