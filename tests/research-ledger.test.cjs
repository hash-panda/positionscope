const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {ResearchLedger} = require('../dist/main/services/research/research-ledger');
const START = 1_800_000_000_000;
const judgment = (overrides = {}) => ({eventId:'BTCUSDT:relative-strength:v1',snapshotId:'snapshot-1',symbol:'BTCUSDT',ruleVersion:'rules-v1',provider:'synthetic',model:'synthetic-model',decidedAt:START,decision:'hypothesis',direction:'long',summary:'合成公共研究条件假设，非交易建议。',facts:[{id:'price',label:'最新成交价',value:100,unit:'USDT',source:'/fapi/v1/ticker/24hr',observedAt:START,fetchedAt:START,window:'24h'}],conditions:['等待下一次报价'],invalidation:['条件失效'],gaps:['费用未知'],...overrides});
const sample = (at, value, overrides = {}) => ({id:`BTCUSDT:price:${at}`,symbol:'BTCUSDT',metric:'price',value,observedAt:at,fetchedAt:at,source:'binance-last-price',...overrides});
const alert = (overrides = {}) => ({symbol:'BTCUSDT',metric:'price',operator:'above',threshold:100,...overrides});
async function setup(options = {}) { let now = START; const ledger = await ResearchLedger.open({...options,now:()=>now}); return {ledger,setNow:n=>now=n}; }

test('freezes a whitelisted public judgment, deduplicates it, and appends without rewriting original', async()=>{
 const {ledger,setNow}=await setup(); const input=judgment(); input.account={apiSecret:'DO_NOT_PERSIST'}; input.facts[0].accountBalance=999;
 const pending=ledger.recordJudgment(input); input.summary='mutated'; input.facts[0].value=999;
 const record=await pending; assert.equal(record.judgment.summary,judgment().summary); assert.equal(record.judgment.facts[0].value,100); assert(!JSON.stringify(record).includes('DO_NOT_PERSIST')); assert(!JSON.stringify(record).includes('accountBalance'));
 record.judgment.facts[0].value=-1; const duplicate=await ledger.recordJudgment(judgment()); assert.equal(duplicate.id,record.id); assert.equal(ledger.snapshot().records.length,1);
 const before=JSON.stringify(ledger.snapshot().records[0].judgment); setNow(START+1000);
 await ledger.addObservation(record.id,{kind:'invalidated',message:'条件已失效',sampleId:'new-sample'});
 await ledger.addObservation(record.id,{kind:'invalidated',message:'同一事件重复',sampleId:'new-sample'});
 assert.equal(ledger.snapshot().records[0].observations.length,1); assert.equal(JSON.stringify(ledger.snapshot().records[0].judgment),before);
 const view=ledger.snapshot(); view.records.length=0; assert.equal(ledger.snapshot().records.length,1);
});

test('retains abstentions and failures, explicit FIFO omissions, bounded observations and independent following',async()=>{
 const {ledger}=await setup({maxRecords:3});
 for(const decision of ['hypothesis','abstain','failed']) await ledger.recordJudgment(judgment({decision}));
 assert.deepEqual(ledger.snapshot().records.map(r=>r.judgment.decision),['hypothesis','abstain','failed']);
 const next=await ledger.recordJudgment(judgment({snapshotId:'snapshot-2'}));
 assert.equal(ledger.snapshot().retention.omittedRecords,1); assert.deepEqual(ledger.snapshot().records.map(r=>r.judgment.decision),['abstain','failed','hypothesis']);
 for(let i=0;i<65;i++) await ledger.addObservation(next.id,{kind:'follow-up',message:`观察${i}`});
 assert.equal(ledger.snapshot().records[2].observations.length,60); assert.equal(ledger.snapshot().records[2].omittedObservations,5);
 await ledger.setWatched('BTCUSDT',true); await ledger.setWatched('BTCUSDT',true); assert.deepEqual(ledger.snapshot().watchedSymbols,['BTCUSDT']); assert.equal(ledger.snapshot().alerts.length,0);
 await ledger.createAlert(alert()); await ledger.setWatched('BTCUSDT',false); assert.equal(ledger.snapshot().alerts.length,1); assert.equal(ledger.snapshot().records.length,3);
});

test('alerts never retrospectively fire, require a fresh crossing, fire once, and explicitly rearm',async()=>{
 const {ledger,setNow}=await setup(); const record=await ledger.recordJudgment(judgment()); const a=await ledger.createAlert(alert({recordId:record.id}));
 const apply=async(n,value)=>{setNow(START+n);return ledger.observePublicSamples([sample(START+n,value)]);};
 assert.equal((await apply(1000,120)).triggeredAlerts.length,0); // first saved condition already true
 assert.equal((await apply(2000,130)).triggeredAlerts.length,0);
 assert.equal((await apply(3000,90)).triggeredAlerts.length,0);
 assert.equal((await apply(4000,101)).triggeredAlerts[0].id,a.id);
 assert.equal((await apply(5000,90)).triggeredAlerts.length,0); assert.equal((await apply(6000,120)).triggeredAlerts.length,0);
 assert.equal(ledger.snapshot().records[0].observations.length,1);
 await ledger.rearmAlert(a.id); assert.equal((await apply(7000,130)).triggeredAlerts.length,0);
 await apply(8000,80); assert.equal((await apply(9000,110)).triggeredAlerts.length,1);
});

test('stale, duplicate, out-of-order, future and data-gap samples cannot create alerts',async()=>{
 const {ledger,setNow}=await setup(); await ledger.createAlert(alert());
 setNow(START+1000);await ledger.observePublicSamples([sample(START+1000,90)]);
 assert.equal((await ledger.observePublicSamples([sample(START+1000,120)])).triggeredAlerts.length,0);
 assert.equal((await ledger.observePublicSamples([sample(START+900,120)])).triggeredAlerts.length,0);
 assert.equal((await ledger.observePublicSamples([sample(START+20_000,120)])).triggeredAlerts.length,0);
 setNow(START+200_000);assert.equal((await ledger.observePublicSamples([sample(START+2000,120)])).triggeredAlerts.length,0);
 assert.equal((await ledger.observePublicSamples([sample(START+200_000,120)])).triggeredAlerts.length,0); // gap resets baseline
 assert.equal(ledger.snapshot().alerts[0].status,'armed');
});

test('funding and OI alert units stay independent; invalid symbols, values and mark-price samples fail closed',async()=>{
 const {ledger,setNow}=await setup();
 await ledger.createAlert(alert({metric:'funding',operator:'below',threshold:-0.001}));
 await ledger.createAlert(alert({metric:'openInterest',operator:'above',threshold:50}));
 setNow(START+1000);await ledger.observePublicSamples([sample(START+1000,0,{metric:'funding',source:'binance-funding-rate'}),sample(START+1000,40,{metric:'openInterest',source:'binance-open-interest'})]);
 setNow(START+2000);const result=await ledger.observePublicSamples([sample(START+2000,-0.002,{metric:'funding',source:'binance-funding-rate'}),sample(START+2000,51,{metric:'openInterest',source:'binance-open-interest'})]);
 assert.equal(result.triggeredAlerts.length,2);
 for(const invalid of [alert({symbol:'BTCUSDT\n'}),alert({threshold:Infinity}),alert({metric:'balance'}),alert({threshold:-1}),alert({metric:'openInterest',threshold:-1})]) assert.throws(()=>ledger.createAlert(invalid));
 assert.throws(()=>ledger.observePublicSamples([sample(START+3000,0)])); assert.throws(()=>ledger.observePublicSamples([sample(START+3000,90,{source:'binance-mark-price'})]));
 assert.throws(()=>ledger.setWatched('ACCOUNT/SECRET',true));
 const privateFact=judgment();privateFact.facts[0].source='/fapi/v3/account';assert.throws(()=>ledger.recordJudgment(privateFact),/public Binance/);
 const queryFact=judgment();queryFact.facts[0].source='https://fapi.binance.com/fapi/v1/depth?apiKey=SECRET';assert.throws(()=>ledger.recordJudgment(queryFact),/public Binance/);
});

test('forward shadow enters only after registration and never borrows selected-event price',async()=>{
 const {ledger,setNow}=await setup();const record=await ledger.recordJudgment(judgment());
 await ledger.observePublicSamples([sample(START,100)]);
 const shadow=await ledger.registerShadow({recordId:record.id,horizonMs:60_000,acknowledgeIndicative:true});assert.equal(shadow.entry,null);assert.equal(shadow.netReturnPercent,null);
 setNow(START+1000);await ledger.observePublicSamples([sample(START,100)]);assert.equal(ledger.snapshot().shadows[0].entry,null);
 await ledger.observePublicSamples([sample(START+1000,200)]);
 setNow(START+60_000);await ledger.observePublicSamples([sample(START+60_000,500)]);assert.equal(ledger.snapshot().shadows[0].status,'observing');
 setNow(START+61_000);const result=await ledger.observePublicSamples([sample(START+61_000,220)]);const completed=result.completedShadows[0];
 assert.equal(completed.entry.value,200);assert(Math.abs(completed.grossPriceReturnPercent-10)<1e-10);assert.equal(completed.buyHoldPriceReturnPercent,completed.grossPriceReturnPercent);assert.equal(completed.noActionReturnPercent,0);assert.equal(completed.netReturnPercent,null);assert.equal(completed.fees,'unknown');assert.equal(completed.funding,'unknown');assert.equal(completed.slippage,'unknown');
 await assert.rejects(ledger.registerShadow({recordId:record.id,horizonMs:60_000,acknowledgeIndicative:true}),/only one/);
});

test('short indicative return includes holding and no-action comparators, without net-performance claims',async()=>{
 const {ledger,setNow}=await setup();const record=await ledger.recordJudgment(judgment({direction:'short'}));await ledger.registerShadow({recordId:record.id,horizonMs:60_000,acknowledgeIndicative:true});
 setNow(START+1000);await ledger.observePublicSamples([sample(START+1000,100)]);
 setNow(START+61_000);await ledger.observePublicSamples([sample(START+61_000,80)]);
 const s=ledger.snapshot().shadows[0];assert(Math.abs(s.grossPriceReturnPercent-20)<1e-10);assert(Math.abs(s.buyHoldPriceReturnPercent+20)<1e-10);assert.equal(s.netReturnPercent,null);
});

test('missing entry and missing expiry quotes remain censored; late prices cannot repair history',async()=>{
 const {ledger,setNow}=await setup(); const record=await ledger.recordJudgment(judgment());await ledger.registerShadow({recordId:record.id,horizonMs:60_000,acknowledgeIndicative:true});
 setNow(START+120_001);await ledger.observePublicSamples([]);assert.equal(ledger.snapshot().shadows[0].status,'censored');
 await ledger.observePublicSamples([sample(START+120_001,500)]);assert.equal(ledger.snapshot().shadows[0].entry,null);
 const second=await ledger.recordJudgment(judgment({snapshotId:'second'}));await ledger.registerShadow({recordId:second.id,horizonMs:60_000,acknowledgeIndicative:true});
 setNow(START+121_000);await ledger.observePublicSamples([sample(START+121_000,100)]);
 setNow(START+302_000);await ledger.observePublicSamples([sample(START+302_000,200)]);
 const s=ledger.snapshot().shadows[1];assert.equal(s.status,'censored');assert.equal(s.exit,null);assert.equal(s.grossPriceReturnPercent,null);
 const abstention=await ledger.recordJudgment(judgment({decision:'abstain'}));await assert.rejects(ledger.registerShadow({recordId:abstention.id,horizonMs:60_000,acknowledgeIndicative:true}),/hypothesis/);
 assert.throws(()=>ledger.registerShadow({recordId:record.id,horizonMs:60_000,acknowledgeIndicative:false}));
});

test('atomic private persistence survives reopen, serializes mutations, and clears all public research',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'positionscope-ledger-test-'));const filePath=path.join(dir,'research.json');
 try {
  const {ledger}=await setup({filePath});await Promise.all([ledger.setWatched('BTCUSDT',true),ledger.setWatched('ETHUSDT',true),ledger.recordJudgment(judgment())]);
  assert.equal((await fs.stat(filePath)).mode&0o777,0o600);assert.deepEqual((await fs.readdir(dir)),['research.json']);
  const reopened=await ResearchLedger.open({filePath,now:()=>START});assert.deepEqual(reopened.snapshot(),ledger.snapshot());
  await reopened.clearAll();const cleared=await ResearchLedger.open({filePath});assert.equal(cleared.snapshot().records.length,0);assert.equal(cleared.snapshot().watchedSymbols.length,0);
 } finally {await fs.rm(dir,{recursive:true,force:true});}
});

test('persistence failure rolls back memory, leaves the last atomic file intact and permits retry',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'positionscope-ledger-test-'));const filePath=path.join(dir,'research.json');let fail=false;
 const fileSystem={...fs,rename:async(...args)=>{if(fail)throw new Error('synthetic storage error');return fs.rename(...args);}};
 try {const {ledger}=await setup({filePath,fileSystem});await ledger.setWatched('BTCUSDT',true);const before=await fs.readFile(filePath,'utf8');fail=true;
 await assert.rejects(ledger.setWatched('ETHUSDT',true),/could not be saved/);assert.deepEqual(ledger.snapshot().watchedSymbols,['BTCUSDT']);assert.equal(await fs.readFile(filePath,'utf8'),before);assert.deepEqual(await fs.readdir(dir),['research.json']);
 fail=false;await ledger.setWatched('ETHUSDT',true);assert.deepEqual(ledger.snapshot().watchedSymbols,['BTCUSDT','ETHUSDT']);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('invalid persisted data fails closed without replacing the file or echoing its content',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'positionscope-ledger-test-'));const filePath=path.join(dir,'research.json');
 try{await fs.writeFile(filePath,'DO_NOT_ECHO_PRIVATE_CONTENT');await assert.rejects(ResearchLedger.open({filePath}),e=>e.message.includes('invalid')&&!e.message.includes('PRIVATE_CONTENT'));assert.equal(await fs.readFile(filePath,'utf8'),'DO_NOT_ECHO_PRIVATE_CONTENT');}
 finally{await fs.rm(dir,{recursive:true,force:true});}
});


test('persisted cross-symbol alert evidence is rejected and arithmetic overflow is censored',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'positionscope-ledger-test-'));const filePath=path.join(dir,'research.json');
 try {const {ledger,setNow}=await setup({filePath});await ledger.createAlert(alert());setNow(START+1000);await ledger.observePublicSamples([sample(START+1000,99)]);
 const stored=JSON.parse(await fs.readFile(filePath,'utf8'));stored.alerts[0].baseline.symbol='ETHUSDT';await fs.writeFile(filePath,JSON.stringify(stored));await assert.rejects(ResearchLedger.open({filePath}),/invalid/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
 const {ledger,setNow}=await setup();const record=await ledger.recordJudgment(judgment());await ledger.registerShadow({recordId:record.id,horizonMs:60_000,acknowledgeIndicative:true});
 setNow(START+1000);await ledger.observePublicSamples([sample(START+1000,1e-300)]);setNow(START+61_000);await ledger.observePublicSamples([sample(START+61_000,1e300)]);
 const shadow=ledger.snapshot().shadows[0];assert.equal(shadow.status,'censored');assert.equal(shadow.grossPriceReturnPercent,null);
});


test('concurrent alert creation enforces a single atomic 32-symbol monitoring budget',async()=>{
 const {ledger}=await setup();
 const results=await Promise.allSettled(Array.from({length:33},(_,i)=>ledger.createAlert(alert({symbol:`COIN${i}USDT`}))));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,32);
 assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.match(results[32].reason.message,/32 symbols/);
 assert.equal(ledger.snapshot().alerts.length,32);
 await ledger.createAlert(alert({symbol:'COIN0USDT',metric:'funding',threshold:0.01})); // same symbol, separate metric
 assert.equal(ledger.snapshot().alerts.length,33);
 await ledger.setWatched('ETHUSDT',true); // passive follows do not consume monitoring capacity
});

test('rearm cannot bypass the active cap and rejected changes preserve a triggered alert',async()=>{
 const {ledger,setNow}=await setup();const old=await ledger.createAlert(alert());
 setNow(START+1000);await ledger.observePublicSamples([sample(START+1000,90)]);
 setNow(START+2000);await ledger.observePublicSamples([sample(START+2000,110)]);
 const filled=await Promise.all(Array.from({length:32},(_,i)=>ledger.createAlert(alert({symbol:`COIN${i}USDT`}))));
 const before=ledger.snapshot().alerts.find(a=>a.id===old.id);
 await assert.rejects(ledger.rearmAlert(old.id),/32 symbols/);assert.deepEqual(ledger.snapshot().alerts.find(a=>a.id===old.id),before);
 await ledger.removeAlert(filled[0].id);assert.equal((await ledger.rearmAlert(old.id)).status,'armed');
});

test('alerts and forward experiments share one atomic symbol budget across concurrent entry points',async()=>{
 const {ledger,setNow}=await setup();
 await Promise.all(Array.from({length:31},(_,i)=>ledger.createAlert(alert({symbol:`COIN${i}USDT`}))));
 const first=await ledger.recordJudgment(judgment({symbol:'ETHUSDT',eventId:'ETH:signal'}));
 const second=await ledger.recordJudgment(judgment({symbol:'SOLUSDT',eventId:'SOL:signal'}));
 const result=await Promise.allSettled([ledger.registerShadow({recordId:first.id,horizonMs:60_000,acknowledgeIndicative:true}),ledger.createAlert(alert({symbol:'XRPUSDT'})),ledger.registerShadow({recordId:second.id,horizonMs:60_000,acknowledgeIndicative:true})]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(ledger.snapshot().shadows.length,1);assert.equal(ledger.snapshot().alerts.length,31);
 // Existing monitored symbol is allowed, but removing its alert alone does not
 // free a slot while that symbol still has an awaiting/observing experiment.
 const sameSymbol=await ledger.createAlert(alert({symbol:'ETHUSDT'}));await ledger.removeAlert(sameSymbol.id);
 await assert.rejects(ledger.createAlert(alert({symbol:'XRPUSDT'})),/32 symbols/);
 setNow(START+1000);await ledger.observePublicSamples([sample(START+1000,100,{symbol:'ETHUSDT'})]);
 await assert.rejects(ledger.registerShadow({recordId:second.id,horizonMs:60_000,acknowledgeIndicative:true}),/32 symbols/);
 setNow(START+61_000);await ledger.observePublicSamples([sample(START+61_000,110,{symbol:'ETHUSDT'})]);
 assert.equal(ledger.snapshot().shadows[0].status,'complete');
 await ledger.registerShadow({recordId:second.id,horizonMs:60_000,acknowledgeIndicative:true});assert.equal(ledger.snapshot().shadows.length,2);
});

test('explicit corrupt-file recovery unlinks only the ledger, is idempotent and sanitizes failure',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'positionscope-ledger-test-'));const filePath=path.join(dir,'research.json');const other=path.join(dir,'unrelated.json');
 try {await fs.writeFile(filePath,'PRIVATE_CORRUPT_BYTES');await fs.writeFile(other,'keep');
 assert.equal(await ResearchLedger.eraseFile(filePath),true);assert.equal(await ResearchLedger.eraseFile(filePath),false);assert.equal(await fs.readFile(other,'utf8'),'keep');
 const ledger=await ResearchLedger.open({filePath});assert.equal(ledger.snapshot().records.length,0);
 await assert.rejects(ResearchLedger.eraseFile(filePath,{unlink:async()=>{throw new Error('PRIVATE_OS_ERROR');}}),e=>e.message==='Research ledger could not be removed');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
