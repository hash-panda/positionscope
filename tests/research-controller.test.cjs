const {test}=require('node:test');
const assert=require('node:assert/strict');
const {ResearchController}=require('../dist/main/services/research/research-controller');
const NOW=1800000000000;
const event={id:'BTCUSDT:strength:v1',snapshotId:'public-snapshot',symbol:'BTCUSDT',ruleVersion:'v1',expiresAt:NOW+60000,deepResearchEligible:true,facts:[]};
const snapshot={snapshotId:event.snapshotId,events:[event],timestamps:{expiresAt:NOW+60000}};
const result={eventId:event.id,snapshotId:event.snapshotId,symbol:event.symbol,expiresAt:NOW+60000,analyzedAt:NOW,provider:'synthetic',model:'test-model',status:'observation',summary:'证据不足，继续观察。',facts:[],conditions:[],triggerConditionIds:[],invalidationConditionIds:[],gaps:[]};
function fixture(overrides={}){
 const records=[],requests=[];
 const controller=new ResearchController({snapshot:async()=>snapshot,analyze:async request=>{requests.push(request);return result;},record:async r=>records.push(r),now:()=>NOW,...overrides});
 return {controller,records,requests};
}
const request={eventId:event.id,snapshotId:event.snapshotId};
test('research accepts only event identity and freezes abstention without private context',async()=>{
 const f=fixture(); await f.controller.analyze(request);
 assert.deepEqual(f.requests,[request]); assert.equal(f.records[0].decision,'abstain');assert.equal(f.records[0].direction,'neutral');
 await assert.rejects(f.controller.analyze({...request,positions:[{secret:'synthetic'}]}),/格式/);
 assert.equal(f.requests.length,1);
});
test('stale or non-selected candidate cannot spend a model call or create a judgment',async()=>{
 const f=fixture();await assert.rejects(f.controller.analyze({...request,snapshotId:'old'}),/刷新/);assert.equal(f.requests.length,0);assert.equal(f.records.length,0);
 const g=fixture({snapshot:async()=>({...snapshot,events:[{...event,deepResearchEligible:false}]})});
 await assert.rejects(g.controller.analyze(request));assert.equal(g.requests.length,0);
});
test('failed model output is retained without raw provider response',async()=>{
 const f=fixture({analyze:async()=>{throw new Error('SYNTHETIC-PROVIDER-KEY');}});
 await assert.rejects(f.controller.analyze(request));assert.equal(f.records.length,1);assert.equal(f.records[0].decision,'failed');
 assert.doesNotMatch(JSON.stringify(f.records),/SYNTHETIC-PROVIDER-KEY/);
});
test('result identity mismatch is rejected and never saved as a successful hypothesis',async()=>{
 const f=fixture({analyze:async()=>({...result,symbol:'ETHUSDT'})});await assert.rejects(f.controller.analyze(request));
 assert.deepEqual(f.records.map(r=>r.decision),['failed']);
});
test('data/config invalidation during a model call cannot repopulate deleted records',async()=>{
 let finish;const f=fixture({analyze:()=>new Promise(resolve=>{finish=resolve;})});const pending=f.controller.analyze(request);
 await new Promise(resolve=>setImmediate(resolve));f.controller.invalidate();finish(result);
 await assert.rejects(pending,/变更/);assert.equal(f.records.length,0);
});
test('invalidation while persistence is pending suppresses old UI result',async()=>{
 let finish;const f=fixture({record:()=>new Promise(resolve=>{finish=resolve;})});const pending=f.controller.analyze(request);
 await new Promise(resolve=>setImmediate(resolve));f.controller.invalidate();finish();await assert.rejects(pending,/变更/);
});
test('only one caller can spend the public research budget at a time',async()=>{
 let finish;const f=fixture({analyze:()=>new Promise(resolve=>{finish=resolve;})});const pending=f.controller.analyze(request);
 await new Promise(resolve=>setImmediate(resolve));await assert.rejects(f.controller.analyze(request),/已有/);finish(result);await pending;
});
