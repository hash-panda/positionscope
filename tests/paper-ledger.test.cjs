const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { PaperLedger } = require('../dist/main/services/paper/ledger');
const { cycleMetrics } = require('../dist/main/services/paper/engine');
const { decimal, format, multiply } = require('../dist/main/services/paper/decimal');
const { DEFAULT_PAPER_POLICY: policy } = require('../dist/main/types/paper');
function book(at, id = String(at), bid = '99', ask = '100', depth = '1000') { return {symbol:'BTCUSDT',updateId:id,observedAt:at,fetchedAt:at,bids:[[bid,depth]],asks:[[ask,depth]],stepSize:'0.001',minQty:'0.001',maxQty:'1000',minNotional:'5'}; }
const plan = (overrides={}) => ({symbol:'BTCUSDT',direction:'long',reason:'合成公开证据',evidence:[{id:'fact-1',label:'合成价格',value:100,unit:'USDT',source:'/fapi/v1/depth',observedAt:100000,fetchedAt:100000,window:'snapshot'}],conditions:[],evidenceIds:['fact-1'],snapshotId:'snapshot-1',provider:'fixture',model:'synthetic',...overrides});
async function harness(options={}) {
  let at=100000; const ledger=await PaperLedger.open({...options,now:()=>at});
  return {ledger, set:n=>at=n, tick:()=>++at, now:()=>at,
    start:async(capital='1000')=>ledger.append({kind:'start',capital,policy},'cycle-'+at),
    decision:async(overrides={})=>ledger.append({kind:'decision',cycleId:'cycle-100000',plan:plan(overrides)},'decision-'+at),
    book:async(b)=>ledger.append({kind:'book',book:b}),
    cycle:()=>ledger.snapshot().cycles[0]};
}
test('fixed point preserves small prices and signed funding without binary float artifacts',()=>{
  assert.equal(format(multiply(decimal('0.1'),decimal('0.2'))),'0.02');
  assert.equal(format(decimal('-0.000000000001')),'-0.000000000001');
  for(const value of ['',null,'NaN','1e3','0.1234567890123','+1']) assert.throws(()=>decimal(value));
});
test('only quotes strictly after frozen decision fill, repeated quote/event cannot double charge',async()=>{
 const h=await harness(); await h.start();h.tick();await h.decision();await h.book(book(h.now()));assert.equal(h.cycle().trades.length,0);
 h.tick(); const b=book(h.now());await h.book(b);const c=h.cycle();assert.equal(c.trades.length,1);assert.equal(c.decisions[0].status,'filled');assert.ok(decimal(c.trades[0].fees)>0n);
 h.tick();await h.book(b);assert.deepEqual(h.cycle(),c);
 const cmd={kind:'gap',reason:'synthetic disconnect'};await h.ledger.append(cmd,'gap-fixed');const snap=h.ledger.snapshot();await h.ledger.append(cmd,'gap-fixed');assert.deepEqual(h.ledger.snapshot(),snap);
 await assert.rejects(h.ledger.append({kind:'gap',reason:'different'},'gap-fixed'));
});
test('long exit uses later bid depth and both fees; missing funding is not declared final net',async()=>{
 const h=await harness();await h.start();h.tick();await h.decision();h.tick();await h.book(book(h.now()));h.tick();await h.book(book(h.now(),undefined,'106','107'));
 const c=h.cycle(), t=c.trades[0];assert.equal(t.exit.reason,'target');assert.ok(decimal(t.grossPnl)>0n);
 const m=cycleMetrics(c,h.ledger.snapshot().books,h.now());assert.equal(decimal(m.knownNetPnl),decimal(t.grossPnl)-decimal(t.fees));assert.equal(m.fundingComplete,false);
 await h.ledger.append({kind:'funding',window:{symbol:'BTCUSDT',start:t.entry.quoteAt,end:t.exit.quoteAt,rows:[]}});assert.equal(cycleMetrics(h.cycle(),{},h.now()).fundingComplete,true);
});
test('short exit uses ask and positive funding credits shorts exactly once',async()=>{
 const h=await harness();await h.start();h.tick();await h.decision({direction:'short'});h.tick();await h.book(book(h.now()));const t=h.cycle().trades[0];
 h.tick();const window={symbol:'BTCUSDT',start:t.entry.quoteAt,end:h.now(),rows:[{time:h.now(),rate:'0.001',markPrice:'99'}]};await h.ledger.append({kind:'funding',window});const funding=h.cycle().trades[0].funding;assert.ok(decimal(funding)>0n);
 await h.ledger.append({kind:'funding',window});assert.equal(h.cycle().trades[0].funding,funding);
 h.tick();await h.book(book(h.now(),undefined,'93','94'));assert.equal(h.cycle().trades[0].exit.reason,'target');assert.ok(decimal(h.cycle().trades[0].grossPnl)>0n);
});
test('pause cancels entries but keeps stop exits; insufficient depth leaves position open',async()=>{
 const h=await harness();await h.start();h.tick();await h.decision();h.tick();await h.book(book(h.now()));h.tick();await h.ledger.append({kind:'mode',cycleId:h.cycle().id,mode:'paused'});
 h.tick();await h.book(book(h.now(),undefined,'90','91','0.001'));assert.equal(h.cycle().trades[0].exit,null);
 h.tick();await h.book(book(h.now(),undefined,'90','91'));assert.equal(h.cycle().trades[0].exit.reason,'stop');assert.ok(decimal(h.cycle().trades[0].grossPnl)<0n);
});
test('new capital creates a separate cycle preserving old history, deferred settlement and funding',async()=>{
 const h=await harness();await h.start();h.tick();await h.decision();h.tick();await h.book(book(h.now()));const old=structuredClone(h.cycle());
 h.tick();await h.start('10000');let s=h.ledger.snapshot();assert.equal(s.cycles.length,2);assert.equal(s.cycles[0].status,'settling');assert.deepEqual(s.cycles[0].trades,old.trades);assert.equal(s.cycles[1].capital,'10000');
 await h.book(book(h.now()));assert.equal(h.cycle().trades[0].exit,null);
 h.tick();await h.book(book(h.now()));assert.equal(h.cycle().trades[0].exit.reason,'cycle-end');assert.equal(h.cycle().status,'settling');
 const t=h.cycle().trades[0];await h.ledger.append({kind:'funding',window:{symbol:'BTCUSDT',start:t.entry.quoteAt,end:t.exit.quoteAt,rows:[]}});assert.equal(h.cycle().status,'archived');
 await assert.rejects(h.ledger.append({kind:'mode',cycleId:h.cycle().id,mode:'running'}));
});
test('invalid, crossed, stale and future books do not mutate state; expired plans never backfill',async()=>{
 const h=await harness();await h.start();h.tick();await h.decision();const before=h.ledger.snapshot();
 for(const b of [book(h.now()+5000),book(h.now()-16000),book(h.now(),undefined,'101','100'),{...book(h.now()),stepSize:'0'},book(h.now(),undefined,'99','100','-1')]) await assert.rejects(h.book(b));
 assert.deepEqual(h.ledger.snapshot(),before);h.set(200000);await h.book(book(h.now()));assert.equal(h.cycle().decisions[0].status,'expired');assert.equal(h.cycle().trades.length,0);
});
test('funding gaps are explicit and cannot be filled by a later disjoint interval',async()=>{
 const h=await harness();await h.start();h.tick();await h.decision();h.tick();await h.book(book(h.now()));const t=h.cycle().trades[0];h.set(200000);
 await h.ledger.append({kind:'funding',window:{symbol:'BTCUSDT',start:150000,end:200000,rows:[]}});assert.equal(h.cycle().trades[0].fundingThrough,t.entry.quoteAt);
 await h.ledger.append({kind:'gap',reason:'resume after sleep'});assert.equal(cycleMetrics(h.cycle(),h.ledger.snapshot().books,h.now()).equity,null);assert.equal(h.cycle().trades[0].exit,null);
});
test('private journal survives restart, corrupt history remains untouched and concurrent actions serialize',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'paper-ledger-'));const filePath=path.join(directory,'paper.json');
 try {const h=await harness({filePath});await h.start();h.tick();await h.decision();h.tick();await h.book(book(h.now()));
 const loaded=await PaperLedger.open({filePath,now:h.now});assert.deepEqual(loaded.snapshot(),h.ledger.snapshot());assert.equal((await fs.stat(filePath)).mode&0o777,0o600);
 await Promise.all([loaded.append({kind:'gap',reason:'a'}),loaded.append({kind:'gap',reason:'b'})]);assert.equal(loaded.snapshot().cycles[0].gaps.length,2);
 await fs.writeFile(filePath,'{broken');await assert.rejects(PaperLedger.open({filePath,now:h.now}));assert.equal(await fs.readFile(filePath,'utf8'),'{broken');
 } finally {await fs.rm(directory,{recursive:true,force:true});}
});
test('flushes the paper journal and parent directory before publishing memory',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'paper-ledger-fsync-')),filePath=path.join(directory,'paper.json'),order=[];
 const fileSystem={...fs,
  open:async(target,...args)=>{const file=await fs.open(target,...args),isDirectory=target===directory;return{
   writeFile:async(...values)=>{order.push('write');return file.writeFile(...values);},
   sync:async()=>{order.push(isDirectory?'directory-sync':'file-sync');return file.sync();},
   close:async()=>{order.push(isDirectory?'directory-close':'file-close');return file.close();}};},
  rename:async(...args)=>{order.push('rename');return fs.rename(...args);}};
 try {const h=await harness({filePath,fileSystem});await h.start();
  assert.deepEqual(order,['write','file-sync','file-close','rename','directory-sync','directory-close']);
  assert.equal(JSON.parse(await fs.readFile(filePath,'utf8')).events.length,1);assert.equal(h.cycle().capital,'1000');
 } finally {await fs.rm(directory,{recursive:true,force:true});}
});
test('abstention never opens positions and hard risk constraints reject oversized policy',async()=>{
 const h=await harness();await assert.rejects(h.ledger.append({kind:'start',capital:'1000',policy:{...policy,allocationBps:10000}}));await h.start();h.tick();await h.decision({direction:'abstain',evidenceIds:[]});h.tick();await h.book(book(h.now()));assert.equal(h.cycle().trades.length,0);
});
test('paper market adapter uses contract filters and bounded public GET only; no account key',async()=>{
 const {BinanceResearchService}=require('../dist/main/services/research/market-scanner');const now=1000000,calls=[];
 const transport={get:async(route,config)=>{calls.push({route,config});
  if(route.endsWith('exchangeInfo'))return{data:{symbols:[{symbol:'BTCUSDT',baseAsset:'BTC',quoteAsset:'USDT',marginAsset:'USDT',status:'TRADING',contractType:'PERPETUAL',quantityPrecision:0,filters:[{filterType:'LOT_SIZE',stepSize:'0.001',minQty:'0.001',maxQty:'1000'},{filterType:'MARKET_LOT_SIZE',stepSize:'0',minQty:'0',maxQty:'100'},{filterType:'MIN_NOTIONAL',notional:'5'}]}]}};
  if(route.endsWith('depth'))return{data:{...book(now),lastUpdateId:123,T:now}};
  if(route.endsWith('fundingRate'))return{data:[{symbol:'BTCUSDT',fundingTime:600000,fundingRate:'0.001',markPrice:'100',rateType:'Regular'}]};
  throw new Error('forbidden endpoint');}};
 const service=new BinanceResearchService({transport,now:()=>now});const b=await service.getPaperBook('BTCUSDT');assert.equal(b.stepSize,'0.001');assert.equal(b.maxQty,'100');
 const funding=await service.getPaperFunding('BTCUSDT',500000,700000);assert.equal(funding.rows[0].rate,'0.001');
 assert.equal(calls.length,3);assert.equal(calls[2].config.params.limit,1000);assert(!JSON.stringify(calls).includes('signature'));await assert.rejects(service.getPaperFunding('BTCUSDT',500000,now));
});
test('entry budgets round down to exchange quantity step and reject depth exhaustion',async()=>{
 const h=await harness();await h.start();h.tick();await h.decision();h.tick();await h.book(book(h.now(),undefined,'99','100','0.001'));assert.equal(h.cycle().decisions[0].status,'rejected');assert.equal(h.cycle().trades.length,0);
 const h2=await harness();await h2.start();h2.tick();await h2.decision();h2.tick();await h2.book(book(h2.now()));const t=h2.cycle().trades[0];assert.equal(decimal(t.entry.quantity)%decimal('0.001'),0n);assert.ok(decimal(t.entry.notional)<=decimal('200'));
});
