const test=require('node:test'),assert=require('node:assert/strict');
const {candidatePolicy,evaluateTrial,reviewFacts,validateReviewChoice}=require('../dist/main/services/paper/review');
const {DEFAULT_PAPER_POLICY:policy}=require('../dist/main/types/paper');
const {applyPaperEvent,emptyPaperState}=require('../dist/main/services/paper/engine');
function cycle(net=1,count=30){return{id:'fixture',startedAt:0,endedAt:700000000,settleRequestedAt:699000000,status:'archived',capital:'1000',policy,decisions:[],gaps:[],curve:[{at:0,equity:'1000',knownNetPnl:'0',fundingComplete:true},{at:700000000,equity:String(1000+net*count),knownNetPnl:String(net*count),fundingComplete:true}],trades:Array.from({length:count},(_,i)=>({id:'same-signal-'+i,entry:{quoteAt:i+1},exit:{quoteAt:i+2},grossPnl:String(net+1),fees:'1',funding:'0',fundingThrough:i+2}))};}
test('frozen comparison counts actual paired closed trades and costs, never adds returns across capitals',()=>{
 const a=cycle(1),b=cycle(2);const result=evaluateTrial(a,b,0,8*86400000);assert.equal(result.eligible,true);assert.equal(result.paired,30);assert.equal(result.advantageBps,300);assert.equal(reviewFacts(a).knownClosedNetPnl,'30');
 const other=cycle(2);other.capital='10000';assert.equal(evaluateTrial(a,other,0,8*86400000).eligible,false);
});
test('time, samples, missing funding, observation gaps and worse drawdowns independently prevent promotion',()=>{
 const a=cycle(1),b=cycle(2);assert.equal(evaluateTrial(a,b,0,86400000).eligible,false);assert.equal(evaluateTrial(a,cycle(2,29),0,8*86400000).eligible,false);
 for(const change of [c=>c.gaps.push({at:1,reason:'offline'}),c=>c.trades[0].fundingThrough=0,c=>c.trades[0].exit=null,c=>c.curve.push({at:3,equity:'900',fundingComplete:true}),c=>c.curve.push({at:3,equity:null})]){const c=cycle(2);change(c);assert.equal(evaluateTrial(a,c,0,8*86400000).eligible,false);}
 const unequal=cycle(2);unequal.trades[0].id='other';assert.equal(evaluateTrial(a,unequal,0,8*86400000).eligible,false);
});
test('model can only nominate bounded policy variants with explicit counterevidence, never modify risk or results',()=>{
 for(const choice of ['reduce-allocation','shorter-hold','tighter-stop','further-target']){const p=candidatePolicy(policy,choice,'candidate');assert.equal(p.riskBps,policy.riskBps);assert.equal(p.maxPositions,policy.maxPositions);assert.equal(p.feeBps,policy.feeBps);assert.equal(p.callsPerDay,policy.callsPerDay);assert.ok(p.allocationBps<=policy.allocationBps);}
 for(const raw of [{choice:'buy',support:[],counter:[]},{choice:'tighter-stop',support:['grossPnl'],counter:[]},{choice:'tighter-stop',support:['grossPnl'],counter:['grossPnl']},{choice:'keep',support:[],counter:[],profit:'100'}])assert.throws(()=>validateReviewChoice(raw));
 assert.deepEqual(validateReviewChoice({choice:'keep',support:[],counter:[]}),{choice:'keep',support:[],counter:[]});
});
test('candidate starts empty after review, old trades stay frozen, future hypotheses feed both accounts',()=>{
 let state=emptyPaperState(),at=100000,id=0;const apply=command=>{state=applyPaperEvent(state,{id:'event-'+(++id),at:++at,command});return 'event-'+id;};
 const cycleId=apply({kind:'start',capital:'1000',policy});
 const plan=i=>({symbol:'BTCUSDT',direction:'long',reason:'合成条件',snapshotId:'snapshot-'+i,evidenceIds:['f'],evidence:[{id:'f',label:'合成价格',value:100,unit:'USDT',source:'/fapi/v1/depth',observedAt:100000,fetchedAt:100000,window:'snapshot'}],conditions:[],provider:'synthetic',model:'fixture'});
 const book=(bid,ask)=>({symbol:'BTCUSDT',updateId:String(at+1),observedAt:at+1,fetchedAt:at+1,bids:[[bid,'1000']],asks:[[ask,'1000']],stepSize:'0.001',minQty:'0.001',maxQty:'1000',minNotional:'5'});
 for(let i=0;i<3;i++){apply({kind:'decision',cycleId,plan:plan(i)});apply({kind:'book',book:book('99','100')});apply({kind:'book',book:book('106','107')});}
 apply({kind:'funding',window:{symbol:'BTCUSDT',start:100000,end:at,rows:[]}});
 const original=structuredClone(state.cycles[0].trades);const reviewId=apply({kind:'review',cycleId});assert.equal(state.reviews[0].status,'awaiting-model');const callId=apply({kind:'call',cycleId,provider:'synthetic',model:'fixture'});
 apply({kind:'review-result',reviewId,callId,choice:'reduce-allocation',support:['fees'],counter:['knownClosedNetPnl']});assert.equal(state.trials.length,1);assert.equal(state.trials[0].baseline.trades.length,0);assert.deepEqual(state.cycles[0].trades,original);assert.equal(state.cycles[0].policy.version,policy.version);
 apply({kind:'decision',cycleId,plan:plan(4)});assert.equal(state.trials[0].baseline.decisions.length,1);assert.equal(state.trials[0].challenger.decisions.length,1);
 apply({kind:'book',book:book('99','100')});assert.equal(state.trials[0].baseline.trades.length,1);assert.equal(state.trials[0].challenger.trades.length,1);assert.notEqual(state.trials[0].baseline.trades[0].entry.quantity,state.trials[0].challenger.trades[0].entry.quantity);
 assert.equal(state.cycles[0].policy.version,policy.version,'one positive result cannot promote a strategy');
});

test('automatic review shares durable call budget, sends only frozen virtual summary and records keep',async()=>{
 const {PaperLedger}=require('../dist/main/services/paper/ledger'),{PaperController}=require('../dist/main/services/paper/controller');
 let now=100000,sequence=0,payload=null;const ledger=await PaperLedger.open({now:()=>now});
 const send=async(command,id)=>{now++;return ledger.append(command,id||'entry-'+(++sequence));};
 await send({kind:'start',capital:'1000',policy},'cycle');
 const book=(price)=>({symbol:'BTCUSDT',updateId:String(now+1),observedAt:now+1,fetchedAt:now+1,bids:[[price,'1000']],asks:[[String(Number(price)+1),'1000']],stepSize:'0.001',minQty:'0.001',maxQty:'1000',minNotional:'5'});
 for(let i=0;i<3;i++){await send({kind:'decision',cycleId:'cycle',plan:{symbol:'BTCUSDT',direction:'long',reason:'fixture',snapshotId:'snap-'+i,evidenceIds:['f'],evidence:[{id:'f',label:'fixture',value:100,unit:'USDT',source:'/fapi/v1/depth',observedAt:now,fetchedAt:now,window:'snapshot'}],conditions:[],provider:'synthetic',model:'fixture'}});await send({kind:'book',book:book('99')});await send({kind:'book',book:book('106')});}
 await send({kind:'funding',window:{symbol:'BTCUSDT',start:100000,end:now,rows:[]}});now+=86400000;
 const provider={provider:'synthetic',model:'fixture',maxOutputTokens:1200,isCurrent:()=>true,chatJSON:async messages=>{assert.equal(ledger.snapshot().calls.at(-1).status,'reserved');payload=JSON.parse(messages[1].content);return{choice:'keep',support:['fees'],counter:['knownClosedNetPnl']};}};
 const controller=new PaperController({ledger,market:{},provider:()=>provider,analyze:async()=>{throw Error('must not run');},changed:()=>{},now:()=>now});
 await controller.review();assert.deepEqual(Object.keys(payload).sort(),['facts','paperSimulationOnly','policy','promotionRules']);assert.equal(payload.facts.closedTrades,3);assert.equal(ledger.snapshot().reviews[0].status,'kept');assert.equal(controller.snapshot().callsReserved24h,2);assert.equal(ledger.snapshot().trials.length,0);await controller.review();assert.equal(ledger.snapshot().reviews.length,1,'no repeat same-day model spend');
});
