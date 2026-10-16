import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, POINTS, ALL_POINTS } from '../src/engine';
import { createProfile, grade, STAGES, startAttempt, submit, startTrig, submitTrig, trigTargets, coordinate, seenPoints, seenGuides, interrupt, validProfile, average, type Profile } from '../src/progression';
const make = () => createProfile('Test', 'test-save');
function complete(p: Profile, ms = 1000) { const a=p.active!; while(!a.done) { submit(p,normalize(a.question),ms); assert.ok(validProfile(p)); } }
function advance(p: Profile, stage: number) { while(p.stage<stage) { startAttempt(p);complete(p); } }

test('stage targets and guides follow the requested learning order',()=>{
  assert.deepEqual(STAGES.map(s=>s.points.length),[2,4,6,12,8,16,16,16,24]);
  const p=make();
  for(let stage=0;stage<9;stage++) { p.stage=stage; assert.deepEqual(seenPoints(p).length,[2,4,8,12,16,16,16,16,24][stage]); }
  assert.deepEqual(STAGES[2].guides,{vertical:true,horizontal:false,diagonal:false});
  assert.equal(STAGES[2].points.includes(6),false); assert.equal(STAGES[2].points.includes(18),false);
  assert.deepEqual(STAGES[4].guides,{vertical:false,horizontal:false,diagonal:true});
  p.stage=4;assert.deepEqual(seenGuides(p),{vertical:true,horizontal:true,diagonal:true});
});
test('generated angles always match enabled targets, including negative large integers and the 24-point set',()=>{
  let seed=1781;const random=()=>((seed=seed*16807%2147483647)-1)/2147483646;
  const p=make(); let negative=false,large=false;
  for(let stage=0;stage<9;stage++) {
    p.stage=stage;const a=startAttempt(p,stage,'practice',100,random),observed=new Set<number>();
    while(!a.done) { assert.ok(STAGES[stage].points.includes(normalize(a.question))); if(stage===0)assert.equal(Math.abs(a.question%12),0); negative ||= a.question<0;large ||= Math.abs(a.question)>=75*12;observed.add(normalize(a.question));submit(p,normalize(a.question),200,random); }
    assert.equal(observed.size,STAGES[stage].points.length);
  }
  assert.ok(negative&&large);
  p.stage=0;const a=startAttempt(p,0,'practice',10,()=>.1),first=normalize(a.question);submit(p,first,100,()=>.1);assert.equal(normalize(a.question),first,'Two targets must not alternate predictably');
});
test('inactive points cannot count as errors or answers',()=>{
  const p=make();startAttempt(p);assert.throws(()=>submit(p,6,100));assert.equal(p.stats.answered,0);
});
test('an error prevents promotion, keeps the acquired grade, resets only the current streak',()=>{
  const p=make();startAttempt(p);for(let i=0;i<4;i++)submit(p,normalize(p.active!.question),1000);
  submit(p,normalize(p.active!.question)===0?12:0,1000);complete(p);
  assert.equal(p.stage,0);assert.equal(grade(p),'Débutant');assert.equal(p.stats.bestStreak,5);assert.equal(p.stats.streak,5);
  startAttempt(p);complete(p);assert.equal(p.stage,1);assert.equal(grade(p),'Apprenti');
});
test('all angle stages gate Maître and 40 fast π/12 answers alone do not grant Grand Maître',()=>{
  const p=make();advance(p,8);assert.equal(grade(p),'Maître');assert.equal(seenPoints(p).length,24);
  startAttempt(p);complete(p,5000);assert.equal(p.active!.answers.length,40);assert.equal(p.active!.passed,true);assert.equal(p.angleMastery,true);assert.equal(p.grandMaster,false);
});
test('Grand Maître average accepts exactly 5 seconds, rejects above, and preserves pre-pause time',()=>{
  for(const ms of [5000,5000.01]) { const p=make();p.stage=8;startAttempt(p);complete(p,ms);assert.equal(p.angleMastery,ms<=5000); }
  const p=make();p.stage=8;startAttempt(p);interrupt(p,2001);submit(p,normalize(p.active!.question),3000);while(!p.active!.done)submit(p,normalize(p.active!.question),5000);
  assert.ok(average(p.active!)>5000);assert.equal(p.angleMastery,false);
});
test('streaks survive saves and new series, all seven streak tiers unlock through 1000',()=>{
  let p=make();for(let batch=0;batch<10;batch++){startAttempt(p,0,'practice',100);complete(p,200);p=JSON.parse(JSON.stringify(p));assert.ok(validProfile(p));}
  for(const n of [10,25,50,100,200,500,1000])assert.ok(p.achievements[`streak-${n}`]);assert.equal(p.stats.streak,1000);
});
test('speed achievements have strict boundaries and pauses clear their run without clearing the streak',()=>{
  for(const [count,total] of [[10,10000],[20,15000]]) {
    for(const delta of [0,-1]) { const p=make();startAttempt(p,0,'practice',count);complete(p,(total+delta)/count);assert.equal(Boolean(p.achievements[`speed-${count}`]),delta===-1); }
  }
  const p=make();startAttempt(p,0,'practice',20);for(let i=0;i<9;i++)submit(p,normalize(p.active!.question),100);interrupt(p,20);assert.equal(p.stats.streak,9);assert.equal(p.stats.integerTimes.length,0);submit(p,normalize(p.active!.question),100);assert.equal(p.achievements['speed-10'],undefined);
});
test('training cannot bypass locked stages or advance the angle grade',()=>{
  const p=make();assert.throws(()=>startAttempt(p,1,'practice',10));assert.throws(()=>startTrig(p,'trig-direct'));startAttempt(p,0,'practice',20);complete(p);assert.equal(p.stage,0);
});
test('coordinate table is exact for all 16 points and each inverse equation has one or two solutions',()=>{
  const p=make();p.stage=5;p.trigDirect=true;
  const encode=(n:number)=> n===0?0:Math.sign(n)*(Math.abs(n)===4?1:Math.abs(n)===3?Math.sqrt(3)/2:Math.abs(n)===2?Math.sqrt(2)/2:.5);
  for(const point of POINTS)for(const fn of ['cos','sin'] as const){assert.ok(Math.abs(encode(coordinate(point,fn))-Math[fn](point*Math.PI/12))<1e-10);const a=startTrig(p,'trig-inverse');a.question=point;a.fn=fn;assert.equal(trigTargets(a).length,Math.abs(coordinate(point,fn))===4?1:2);}
  const a=startTrig(p,'trig-inverse');a.question=4;a.fn='cos';assert.deepEqual(trigTargets(a),[4,20]);a.question=2;a.fn='sin';assert.deepEqual(trigTargets(a),[2,10]);
});
test('inverse selection is saved midway, duplicate taps do not count, and both points validate only one answer',()=>{
  const p=make();p.stage=5;p.trigDirect=true;const a=startTrig(p,'trig-inverse');a.question=4;a.fn='cos';a.choices=[1,-1,3,-3];
  assert.equal(submitTrig(p,4,100),null);assert.deepEqual(a.selected,[4]);assert.equal(p.stats.answered,0);assert.ok(validProfile(p));
  const restored=JSON.parse(JSON.stringify(p)) as Profile;assert.equal(submitTrig(restored,4,200),null);assert.equal(restored.stats.answered,0);
  const result=submitTrig(restored,20,400)!;assert.equal(result.answer.correct,true);assert.equal(result.answer.elapsed,400);assert.equal(restored.stats.answered,1);assert.ok(restored.stats.points.includes(4)&&restored.stats.points.includes(20));
});
test('both trigonometry certifications and the angle trial are necessary for Grand Maître',()=>{
  const p=make();advance(p,8);startAttempt(p);complete(p,1200);startTrig(p,'trig-direct');
  while(!p.active!.done){const a=p.active!;assert.equal(new Set(a.choices).size,4);assert.ok(a.choices.includes(coordinate(a.question,a.fn)));submitTrig(p,coordinate(a.question,a.fn),1000);assert.ok(validProfile(p));}
  assert.equal(p.trigDirect,true);assert.equal(p.grandMaster,false);startTrig(p,'trig-inverse');
  while(!p.active!.done){const targets=trigTargets(p.active!);for(const point of targets)submitTrig(p,point,1200);assert.ok(validProfile(p));}
  assert.equal(p.trigInverse,true);assert.equal(p.grandMaster,true);assert.equal(grade(p),'Grand Maître');assert.ok(p.achievements['grand-master']);
});
test('malformed data is refused rather than silently resetting progression',()=>{
  const p=make();assert.ok(validProfile(p));for(const bad of [{...p,stage:99},{...p,grandMaster:true},{...p,trigInverse:true},{...p,active:{}},{...p,stats:{...p.stats,streak:100}}])assert.equal(validProfile(bad),false);
  assert.equal(ALL_POINTS.length,24);
});
