import assert from 'node:assert/strict';
import {chromium,browserOptions,base,newGame,answerCurrent,currentTarget} from './qa-helpers.mjs';
const browser=await chromium.launch(browserOptions);
try{
 for(const forceAac of [false,true]){
  const c=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await c.addInitScript(({forceAac})=>{
   window.__audioStarts=[];window.__audioActive=new Set();
   if(forceAac){const original=HTMLMediaElement.prototype.canPlayType;HTMLMediaElement.prototype.canPlayType=function(t){return t.includes('ogg')?'':original.call(this,t);};}
   const original=AudioContext.prototype.createBufferSource;
   AudioContext.prototype.createBufferSource=function(){const s=original.call(this),start=s.start.bind(s),stop=s.stop.bind(s);s.start=(...args)=>{window.__audioStarts.push({duration:s.buffer.duration,state:this.state,peak:Math.max(...s.buffer.getChannelData(0).map(Math.abs))});window.__audioActive.add(s);s.addEventListener('ended',()=>window.__audioActive.delete(s));start(...args);};s.stop=(...args)=>{window.__audioActive.delete(s);stop(...args);};return s;};
  },{forceAac});
  const page=await c.newPage(),requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(/\.(ogg|m4a)(?:\?|$)/.test(r.url())){requests.push(r.url());if(!r.ok())errors.push(r.url());}});
  await page.goto(base,{waitUntil:'networkidle'});assert.equal(requests.length,7);assert.ok(requests.every(url=>url.includes(forceAac?'.m4a':'.ogg')));
  await newGame(page,'Son QA');await page.waitForFunction(()=>window.__audioStarts.length===1);await answerCurrent(page);await page.waitForFunction(()=>window.__audioStarts.some(x=>x.duration>.49&&x.duration<.57));
  await page.locator('.sound-button').tap();assert.equal(await page.evaluate(()=>window.__audioActive.size),0);const before=await page.evaluate(()=>window.__audioStarts.length);await answerCurrent(page);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>window.__audioStarts.length),before);
  await page.locator('.quit').tap();await page.locator('.back-home').tap();await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.sound-button').getAttribute('aria-pressed'),'false');await page.locator('.recent-game').tap();await page.locator('.continue-game').tap();assert.equal(await page.evaluate(()=>window.__audioStarts.length),0);
  await page.locator('.sound-button').tap();await page.waitForFunction(()=>window.__audioStarts.length===1);const point=await currentTarget(page);await page.locator(`.game [data-point="${point===0?12:0}"]`).tap();await page.waitForFunction(()=>window.__audioStarts.length===2);await page.waitForTimeout(550);
  for(let i=0;i<7;i++)await answerCurrent(page);await page.waitForFunction(()=>window.__audioStarts.some(x=>x.duration>.85));
  const events=await page.evaluate(()=>window.__audioStarts);assert.ok(events.every(e=>e.state==='running'&&e.peak>.05&&e.peak<1));assert.ok(events.some(e=>e.duration>.37&&e.duration<.45));assert.deepEqual(errors,[]);
  console.log(`PASS ${forceAac?'AAC':'OGG'}: 7 cues, first-gesture start, achievement melody, correct/error/finish, immediate mute, persisted setting, non-silent unclipped buffers`);await c.close();
 }
}finally{await browser.close();}
