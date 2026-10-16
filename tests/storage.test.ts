import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile,startAttempt,submit } from '../src/progression';
import { normalize } from '../src/engine';
import { seal,unseal } from '../src/storage';

test('AES-GCM roundtrip preserves the complete profile and uses a fresh random nonce',async()=>{
  const p=createProfile('Mon aventure','crypto-test');startAttempt(p);submit(p,normalize(p.active!.question),1234);
  const a=await seal(p),b=await seal(p);assert.deepEqual(await unseal(a),p);assert.notEqual(a.iv,b.iv);assert.notEqual(a.data,b.data);assert.ok(!JSON.stringify(a).includes('streak'));assert.ok(!JSON.stringify(a).includes('Mon aventure'));
});
test('manual changes to ciphertext, nonce, identity or schema are rejected',async()=>{
  const e=await seal(createProfile('Test','tamper-test'));
  const change=(value:string)=>{const bytes=Buffer.from(value,'base64');bytes[Math.floor(bytes.length/2)]^=1;return bytes.toString('base64');};
  for(const bad of [{...e,data:change(e.data)},{...e,iv:change(e.iv)},{...e,id:'other-id'},{...e,version:2},{...e,data:'x'},{format:'old-save'},null])await assert.rejects(()=>unseal(bad));
});
test('invalid internal profiles cannot be exported',async()=>{const p=createProfile('Test');p.stage=999;await assert.rejects(()=>seal(p));});
