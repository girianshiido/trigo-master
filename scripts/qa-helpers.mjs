import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
export const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
export const browserOptions={...(process.env.TRIGO_CHROME?{executablePath:process.env.TRIGO_CHROME}:{}),headless:true};
export const base=process.env.TRIGO_QA_URL||'http://127.0.0.1:5180/';
export const points=[0,2,3,4,6,8,9,10,12,14,15,16,18,20,21,22];
export const normalize=n=>((n%24)+24)%24;
export function target(text){if(text==='0')return 0;const m=text.replace('−','-').match(/^(-?)(\d*)π(?:\/(\d+))?$/);assert.ok(m,`Unknown angle ${text}`);return normalize((m[1]?-1:1)*Number(m[2]||1)*12/Number(m[3]||1));}
export function encoded(point,fn){const x=Math[fn](point*Math.PI/12),values=[-1,-Math.sqrt(3)/2,-Math.sqrt(2)/2,-.5,0,.5,Math.sqrt(2)/2,Math.sqrt(3)/2,1];return values.findIndex(n=>Math.abs(n-x)<1e-8)-4;}
// Test-only setup: seed an encrypted local record, then load it through the normal UI.
export async function seedFixture(page,name){
 const envelope=JSON.parse(await readFile(`test-results/fixtures/${name}.json`,'utf8'));
 await page.evaluate(envelope=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('trigo-master',1);
  request.onsuccess=()=>{const db=request.result,tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(envelope);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};request.onerror=()=>reject(request.error);
 }),envelope);
 await page.reload({waitUntil:'networkidle'});await page.locator('.title-logo').waitFor();return envelope.id;
}
export async function loadFixture(page,name){const id=await seedFixture(page,name);await page.locator('.load-game').click();await page.locator(`.load-slot[data-id="${id}"]`).click();await page.locator('.dashboard').waitFor();}
export async function newGame(page,name='QA'){await page.locator('.new-game').click();await page.locator('#save-name').fill(name);await page.locator('.name-form [type="submit"]').click();await page.locator('.game').waitFor();}
export async function currentTarget(page){const label=await page.locator('.question-panel').getAttribute('aria-label');return target(label.replace('Place l’angle ','').replace(/^cos de |^sin de /,''));}
export async function readValue(page){return page.locator('#question-angle>.math').evaluate(e=>{const sign=e.querySelector('mo.minus')?-1:1;const root=e.querySelector('.unified-root text');if(root)return sign*Number(root.textContent);if(e.querySelector('mfrac'))return sign;return e.textContent.includes('0')?0:sign*4;});}
export async function answerCurrent(page){
 const overline=await page.locator('.question-overline').innerText();
 if(overline==='PLACE CET ANGLE'){const p=await currentTarget(page);await page.locator(`.game [data-point="${p}"]`).tap();return;}
 const fn=(await page.locator('.function-name').textContent()).trim();
 if(overline==='CHOISIS LA BONNE VALEUR'){const p=await currentTarget(page);await page.locator(`[data-value="${encoded(p,fn)}"]`).tap();return;}
 const value=await readValue(page),targets=points.filter(p=>encoded(p,fn)===value);
 for(const p of targets){if(!await page.locator(`.game [data-point="${p}"]`).evaluate(e=>e.classList.contains('chosen-point')))await page.locator(`.game [data-point="${p}"]`).tap();}
}
export async function geometry(page,width,height){
 const data=await page.evaluate(()=>{const b=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};};return{circle:b('.circle-board'),angle:b('#question-angle'),panel:b('.question-panel'),scroll:document.documentElement.scrollHeight};});
 for(const [name,b] of Object.entries(data).filter(([key])=>key!=='scroll'))assert.ok(b.x>=-.5&&b.y>=-.5&&b.right<=width+.5&&b.bottom<=height+.5,`${width}×${height}: ${name} clipped ${JSON.stringify(b)}`);
 assert.ok(data.scroll<=height+1,`${width}×${height}: game scrolls ${JSON.stringify(data)}`);
 const dots=await page.locator('.point .dot').evaluateAll(ds=>ds.map(d=>{const r=d.getBoundingClientRect(),b=d.closest('.circle-board').getBoundingClientRect();return{w:r.width,h:r.height,r:Math.hypot(r.x+r.width/2-b.x-b.width/2,r.y+r.height/2-b.y-b.height/2),target:b.width*150/400};}));
 for(const d of dots){assert.ok(Math.abs(d.w-d.h)<.1,'Elliptical marker');assert.ok(Math.abs(d.r-d.target)<.25,'Marker off circle');}
}
