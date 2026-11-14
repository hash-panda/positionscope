const test=require('node:test'),assert=require('node:assert/strict');
const {PaperLedger}=require('../dist/main/services/paper/ledger');
const {PaperController}=require('../dist/main/services/paper/controller');
async function flush(predicate){for(let i=0;i<80;i++){if(predicate())return;await new Promise(r=>setImmediate(r));}assert.fail('async simulation did not settle');}
async function fixture(options={}){
 let now=1000000,analyzed=0,sequence=0,release;const ledger=await PaperLedger.open({now:()=>now});
 const identity={provider:'synthetic',model:'explicit-fixture',isCurrent:()=>true};
 const market={snapshot:async()=>({snapshotId:'snapshot-'+now,status:'available',events:[{id:'event',symbol:'BTCUSDT',deepResearchEligible:true}],timestamps:{expiresAt:now+60000}}),
 getPaperBook:async()=>({symbol:'BTCUSDT',updateId:String(++sequence),observedAt:now,fetchedAt:now,bids:[['99','1000']],asks:[['100','1000']],stepSize:'0.001',minQty:'0.001',maxQty:'1000',minNotional:'5'}),getPaperFunding:async(symbol,start,end)=>({symbol,start,end,rows:[]})};
 const controller=new PaperController({ledger,market,provider:()=>{if(options.noModel)throw Error('not configured');return identity;},now:()=>now,changed:()=>{},analyze:async request=>{
 analyzed++;if(options.hold)await new Promise(r=>release=r);if(options.fail)throw Error('synthetic provider error must not leak');
 return{...request,symbol:'BTCUSDT',provider:identity.provider,model:identity.model,expiresAt:now+60000,status:options.abstain?'observation':'conditional-long',summary:'合成公开条件满足',facts:[{id:'fact-1',label:'合成变化',value:1,unit:'percent',source:'/fapi/v1/klines',observedAt:now,fetchedAt:now,window:'1h'}],supportFactIds:['fact-1'],counterFactIds:[],triggerConditionIds:['positive'],invalidationConditionIds:['negative'],conditions:[{id:'positive',label:'正向',factIds:['fact-1'],state:options.unmet?'not-met':'met'},{id:'negative',label:'反向',factIds:['fact-1'],state:'not-met'}]};}});
 return{ledger,controller,market,identity,advance:ms=>now+=ms,calls:()=>analyzed,release:()=>release?.(),ready:()=>!!release,start:()=>controller.start({capital:'1000',callsPerDay:4,consent:true})};
}
test('no background paid work before explicit start; configured model and consent required',async()=>{
 const f=await fixture();await f.controller.think();assert.equal(f.calls(),0);await assert.rejects(f.controller.start({capital:'1000',callsPerDay:4,consent:false}));assert.equal(f.ledger.snapshot().cycles.length,0);
 const unavailable=await fixture({noModel:true});await assert.rejects(unavailable.start());assert.equal(unavailable.calls(),0);
});
test('model allowance is durably reserved before response; cycle reset cannot reset rolling budget',async()=>{
 const f=await fixture({hold:true,abstain:true});await f.start();await flush(f.ready);assert.equal(f.ledger.snapshot().calls[0].status,'reserved');assert.equal(f.controller.snapshot().callsReserved24h,2);
 await f.start();assert.equal(f.calls(),1);f.release();await flush(()=>!f.controller.snapshot().thinking);assert.equal(f.ledger.snapshot().calls[0].status,'failed');assert.equal(f.ledger.snapshot().cycles[0].decisions.length,0);
});
test('two calls per research count even failures; strict rolling budget survives new cycles',async()=>{
 const f=await fixture({fail:true});await f.start();await flush(()=>!f.controller.snapshot().thinking);assert.equal(f.calls(),1);assert.equal(f.ledger.snapshot().calls[0].status,'failed');
 f.advance(1800000);await f.controller.think();assert.equal(f.calls(),2);assert.equal(f.controller.snapshot().callsReserved24h,4);
 f.advance(1800000);await f.start();await f.controller.think();assert.equal(f.calls(),2);assert.equal(f.controller.snapshot().actualModelCost,null);
});
test('validated conditions freeze public evidence; only subsequent quote can fill',async()=>{
 const f=await fixture();await f.start();await flush(()=>!f.controller.snapshot().thinking);const cycle=f.ledger.snapshot().cycles[0];assert.equal(cycle.decisions[0].status,'pending');assert.equal(cycle.decisions[0].plan.evidence[0].id,'fact-1');assert.equal(cycle.trades.length,0);
 f.advance(1);await f.controller.poll();assert.equal(f.ledger.snapshot().cycles[0].trades.length,1);
 const no=await fixture({unmet:true});await no.start();await flush(()=>!no.controller.snapshot().thinking);assert.equal(no.ledger.snapshot().cycles[0].decisions[0].status,'abstained');
});
test('restart/configuration change pauses autonomous calls and cancels pending entries',async()=>{
 const f=await fixture();await f.start();await flush(()=>!f.controller.snapshot().thinking);await f.controller.invalidate();assert.equal(f.ledger.snapshot().cycles[0].status,'paused');assert.equal(f.ledger.snapshot().cycles[0].decisions[0].status,'cancelled');
 f.advance(1800000);await f.controller.think();assert.equal(f.calls(),1);
});
test('shutdown rejects late model results and a closed ledger cannot resurrect deleted history',async()=>{
 const f=await fixture({hold:true});await f.start();await flush(f.ready);f.controller.stop();await f.ledger.close();f.release();await flush(()=>!f.controller.snapshot().thinking);assert.equal(f.ledger.snapshot().cycles[0].decisions.length,0);await assert.rejects(f.ledger.append({kind:'gap',reason:'late'}));
});
test('invalidation discards an in-flight book and a fresh poll can still settle the position', async () => {
 const f = await fixture();
 await f.start();
 await flush(() => !f.controller.snapshot().thinking);
 f.advance(1);
 await f.controller.poll();
 assert.equal(f.ledger.snapshot().cycles[0].trades.length, 1);
 const readBook = f.market.getPaperBook;
 f.advance(1);
 const exitBook = {...await readBook(), bids:[['106','1000']], asks:[['107','1000']]};
 let release;
 f.market.getPaperBook = () => new Promise(resolve => { release = resolve; });
 const pending = f.controller.poll();
 await flush(() => Boolean(release));
 await f.controller.invalidate('synthetic configuration change');
 release(exitBook);
 await pending;
 assert.equal(f.ledger.snapshot().cycles[0].trades[0].exit, null);
 assert.deepEqual(f.ledger.snapshot().books, {});
 f.advance(1);
 f.market.getPaperBook = async () => ({...await readBook(), bids:exitBook.bids, asks:exitBook.asks});
 await f.controller.poll();
 assert.equal(f.ledger.snapshot().cycles[0].trades[0].exit.reason, 'target');
});
