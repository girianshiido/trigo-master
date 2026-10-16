import assert from 'node:assert/strict';
import {chromium,browserOptions,base,loadFixture,newGame,answerCurrent,geometry} from './qa-helpers.mjs';
const browser=await chromium.launch(browserOptions);
try{
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await c.newPage();await p.goto(base,{waitUntil:'networkidle'});await loadFixture(p,'stage-8');await p.locator('.continue-game').tap();
 // This Chrome version has no protocol override for safe-area environment values.
 // Substitute test variables in the actual stylesheet to exercise its layout calculations.
 await p.evaluate(()=>{const style=document.createElement('style');style.textContent=[...document.styleSheets].flatMap(s=>[...s.cssRules].map(r=>r.cssText)).join('\n').replace(/env\(safe-area-inset-(top|bottom|left|right)\)/g,'var(--test-safe-$1,0px)');document.head.append(style);});
 const insets=async values=>p.evaluate(values=>{for(const [side,value] of Object.entries(values))document.documentElement.style.setProperty(`--test-safe-${side}`,`${value}px`);},values);
 await insets({top:47,bottom:34,left:0,right:0});await p.waitForTimeout(80);await geometry(p,390,844);await p.screenshot({path:'test-results/notch-portrait.png'});
 await p.setViewportSize({width:844,height:390});await insets({top:0,bottom:21,left:47,right:47});await p.waitForTimeout(80);await geometry(p,844,390);await p.screenshot({path:'test-results/notch-landscape.png'});console.log('PASS simulated safe-area CSS: notches and home indicator, portrait and landscape');await c.close();
 const m=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),one=await m.newPage();await one.goto(base,{waitUntil:'networkidle'});await newGame(one,'Deux onglets');for(let i=0;i<4;i++)await answerCurrent(one);
 const two=await m.newPage();await two.goto(base,{waitUntil:'networkidle'});await two.locator('.recent-game').tap();await two.locator('dialog').waitFor();assert.ok((await two.locator('dialog').innerText()).includes('déjà ouverte'));
 await one.locator('.quit').tap();await one.locator('.brand').tap();await one.locator('.title-logo').waitFor();await two.locator('[data-close]').tap();await two.locator('dialog').waitFor({state:'detached'});await two.locator('.recent-game').tap();await two.locator('.continue-game').tap();assert.equal(await two.locator('#progress-count').innerText(),'5 / 10');console.log('PASS two-tab lock: concurrent writer refused, latest saved question resumes after release');await m.close();
}finally{await browser.close();}
