import { mkdir, writeFile } from 'node:fs/promises';
import {createProfile,startAttempt,submit,startTrig,submitTrig,coordinate,type Profile} from '../src/progression';
import {normalize} from '../src/engine';
import {seal} from '../src/storage';
await mkdir('test-results/fixtures',{recursive:true});
function complete(p:Profile){while(!p.active!.done)submit(p,normalize(p.active!.question),1000);}
const p=createProfile('Aventure QA','qa-journey');
for(let i=0;i<=8;i++) {
  startAttempt(p);
  await writeFile(`test-results/fixtures/stage-${i}.json`,JSON.stringify(await seal(p)));
  if(i<8)complete(p);
}
complete(p); // angle mastery only; trigonometry still required
await writeFile('test-results/fixtures/angles-certified.json',JSON.stringify(await seal(p)));
startTrig(p,'trig-direct');p.active!.question=8;p.active!.fn='cos';p.active!.choices=[-1,1,3,-3];
await writeFile('test-results/fixtures/direct.json',JSON.stringify(await seal(p)));
for(const [name,units] of [['zero',0],['pi',12]] as const){
  const integer=structuredClone(p);integer.active!.question=units;integer.active!.choices=[-4,4,0,1];
  await writeFile(`test-results/fixtures/direct-${name}.json`,JSON.stringify(await seal(integer)));
}
while(!p.active!.done)submitTrig(p,coordinate(p.active!.question,p.active!.fn),1000);
startTrig(p,'trig-inverse');p.active!.question=4;p.active!.fn='cos';p.active!.choices=[1,-1,3,-3];
await writeFile('test-results/fixtures/inverse.json',JSON.stringify(await seal(p)));
submitTrig(p,4,500);p.active!.elapsed=500;
await writeFile('test-results/fixtures/inverse-partial.json',JSON.stringify(await seal(p)));
p.active!.question=0;p.active!.selected=[];p.active!.choices=[4,-4,0,1];
await writeFile('test-results/fixtures/inverse-single.json',JSON.stringify(await seal(p)));
const e=await seal(p);const bytes=Buffer.from(e.data,'base64');bytes[50]^=1;e.data=bytes.toString('base64');
await writeFile('test-results/fixtures/tampered.json',JSON.stringify(e));
console.log('Encrypted journey, trig, partial selection and tamper fixtures ready');
