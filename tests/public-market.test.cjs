const {test}=require('node:test');const assert=require('node:assert/strict');
const {PublicMarketService,priceHistory,fundingScenarios}=require('../dist/main/services/public-market');
const {analysisCacheKey}=require('../dist/main/services/ai/risk-facts');
const H=3600000;
function candles(now,prices=Array(30).fill(100)) {const end=Math.floor(now/H)*H;return prices.map((p,i)=>[end-(prices.length-i)*H,'0','0','0',String(p),'0',end-(prices.length-i-1)*H-1]);}
function fixture(options={}) {
 const service=new PublicMarketService();const calls=[];const now=Date.now();let active=0,max=0;
 const symbols=['BTCUSDT','ETHUSDT','ASSETUSDT'];
 service.client={get:async(path,config)=>{
  calls.push({path,config});assert.equal(config.headers,undefined);assert(!JSON.stringify(config).includes('APIKEY'));
  active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,1));active--;
  const symbol=config.params.symbol;
  if(path.endsWith('exchangeInfo'))return {data:{symbols:symbols.map(symbol=>({symbol,status:'TRADING',contractType:'PERPETUAL',quoteAsset:'USDT',marginAsset:'USDT',baseAsset:symbol.replace('USDT',''),onboardDate:now-2*24*H})).concat({symbol:'INVERSEUSD',status:'TRADING',contractType:'PERPETUAL',quoteAsset:'USD',marginAsset:'BTC'})}};
  if(path.endsWith('ticker/24hr'))return {data:symbols.map((symbol,i)=>({symbol,closeTime:options.stale?now-600000:now,lastPrice:'100',quoteVolume:String(1000*(i+1)),priceChangePercent:String(i-1)}))};
  if(path.endsWith('fundingInfo'))return {data:options.announced?[{symbol:'BTCUSDT',fundingIntervalHours:1}]:[]};
  if(path.endsWith('premiumIndex'))return {data:{symbol,markPrice:'100',lastFundingRate:'.001',nextFundingTime:now+H,time:now}};
  if(path.endsWith('fundingRate'))return {data:[9,5,1].map(hours=>({symbol,fundingTime:now-hours*H,fundingRate:'.001'}))};
  if(path.endsWith('openInterest')){if(options.noOI)throw new Error('synthetic upstream failure');return {data:{symbol,openInterest:'30',time:now}};}
  if(path.endsWith('klines'))return {data:candles(now)};
  throw new Error('request outside fixture GET allowlist');
 }};return {service,calls,now,getMax:()=>max};
}
test('public market filters its universe, caps workers, preserves coverage/source timestamps and reuses cache',async()=>{
 const {service,calls,getMax}=fixture();const a=await service.snapshot(['ASSETUSDT']);
 assert.equal(a.status,'available');assert.equal(a.breadth.eligibleContracts,3);assert.equal(a.breadth.pricedContracts,3);assert.equal(a.breadth.rising,1);assert.equal(a.breadth.falling,1);assert.equal(a.breadth.medianChange24h,0);
 assert.equal(a.active[0].symbol,'ASSETUSDT');assert.equal(a.recentListings.length,3);assert.equal(a.assets[0].funding.intervalHours,4);assert.equal(a.assets[0].funding.intervalBasis,'observed');assert(getMax()<=3);
 const count=calls.length;const b=await service.snapshot(['ASSETUSDT']);assert.equal(calls.length,count);assert.equal(a,b);assert.equal(b.fetchedAt,a.fetchedAt);
});
test('announced funding interval takes precedence, missing OI remains a gap not zero',async()=>{
 const {service}=fixture({announced:true,noOI:true});const a=await service.snapshot([]);const btc=a.assets.find(a=>a.symbol==='BTCUSDT');
 assert.equal(a.status,'partial');assert.equal(btc.funding.intervalHours,1);assert.equal(btc.funding.intervalBasis,'announced');assert.equal(btc.openInterest,null);assert.ok(btc.gaps.length);
});
test('stale market rows fail closed and unsupported symbols are never guessed',async()=>{
 const {service}=fixture({stale:true});const a=await service.snapshot([]);assert.equal(a.status,'unavailable');assert.equal(a.breadth,null);assert.deepEqual(a.assets,[]);
 const b=await fixture().service.snapshot(['UNKNOWNUSDT']);assert.equal(b.status,'partial');assert.deepEqual(b.unavailableSymbols,['UNKNOWNUSDT']);
 await assert.rejects(service.snapshot(['https://invalid/']));await assert.rejects(service.snapshot(Array(501).fill('BTCUSDT')));
});
test('rate limit honors cooldown and sanitizes upstream/proxy payloads without retries',async()=>{
 const service=new PublicMarketService();let calls=0;service.client={get:async()=>{calls++;throw {response:{status:429,headers:{'retry-after':'120'},data:'synthetic-private-payload'},config:{headers:{authorization:'synthetic-secret'}}};}};
 const first=Date.now();const a=await service.snapshot([]);assert.equal(a.status,'unavailable');assert(service.blockedUntil>=first+120000);await service.snapshot(['ASSETUSDT']);assert.equal(calls,1);assert(!JSON.stringify(a).includes('synthetic-private-payload'));assert(!JSON.stringify(a).includes('synthetic-secret'));
});
test('closed-hour price history excludes live candle, uses sample log returns and rejects gaps/stale history',()=>{
 const now=Date.now(),rows=candles(now,[100,90,80,...Array(27).fill(100)]);const result=priceHistory(rows.concat([[Math.floor(now/H)*H,'','','','999','',Math.floor(now/H)*H+H-1]]),now);
 assert.equal(result.samples,30);assert(Math.abs(result.maxDrawdown-.2)<1e-12);assert.equal(result.priceChange,0);assert(result.annualizedPriceVolatility>0);
 assert.throws(()=>priceHistory(rows.filter((_,i)=>i!==10),now));assert.throws(()=>priceHistory(rows,now+3*H));assert.throws(()=>priceHistory(rows.slice(0,10),now));
 const invalid=structuredClone(rows);invalid[2][4]='0';assert.throws(()=>priceHistory(invalid,now));
});
test('funding estimates are conditional, signed and same-venue only; cache includes public context',async()=>{
 const market=await fixture().service.snapshot([]);const position={exchange:'binance',symbol:'BTCUSDT',positionAmt:'2',markPrice:'100'};
 const a=fundingScenarios([position],market);assert.equal(a.length,3);assert.equal(a[0].estimatedCashflow,-.2);assert.equal(a[2].estimatedCashflow,-.1);
 assert.equal(fundingScenarios([{...position,positionAmt:'-2'}],market)[0].estimatedCashflow,.2);
 assert.deepEqual(fundingScenarios([{...position,exchange:'okx'}],market),[]);
 const stale=structuredClone(market);stale.assets.forEach(a=>a.fetchedAt-=200000);assert.deepEqual(fundingScenarios([position],stale),[]);
 assert.notEqual(analysisCacheKey([position],[],'demo','x',market),analysisCacheKey([position],[],'demo','x',{...market,status:'partial'}));
});

test('funding eligibility expires by source time even while the local fetch remains fresh',async t=>{
 const market=await fixture().service.snapshot([]),now=market.assets[0].fetchedAt;
 t.mock.method(Date,'now',()=>now);
 const position={exchange:'binance',symbol:'BTCUSDT',positionAmt:'2',markPrice:'100'};
 const asset=market.assets.find(a=>a.symbol===position.symbol);
 asset.fetchedAt=now;asset.mark.exchangeTimestamp=now-179000;
 assert.equal(fundingScenarios([position],market).length,3);
 t.mock.method(Date,'now',()=>now+1000);
 assert.equal(fundingScenarios([position],market).length,3,'180 seconds is still within the source budget');
 t.mock.method(Date,'now',()=>now+1001);
 assert.deepEqual(fundingScenarios([position],market),[],'fetch is only 1001 ms old but source is expired');
});

test('funding time validation rejects invalid clocks and settled references without changing signed rates',async t=>{
 const market=await fixture().service.snapshot([]),now=market.assets[0].fetchedAt;
 t.mock.method(Date,'now',()=>now);
 const position={exchange:'binance',symbol:'BTCUSDT',positionAmt:'2',markPrice:'100'};
 const asset=market.assets.find(a=>a.symbol===position.symbol);
 asset.fetchedAt=now;asset.mark.exchangeTimestamp=now;
 for(const field of ['fetchedAt','exchangeTimestamp']) {
  const target=field==='fetchedAt'?asset:asset.mark;
  for(const value of [now-180001,now+60001,NaN,Infinity,0,-1,undefined,'invalid',now+.5]) {
   target[field]=value;assert.deepEqual(fundingScenarios([position],market),[],field+' '+String(value));
  }
  for(const value of [now-180000,now+60000]) {
   target[field]=value;assert.equal(fundingScenarios([position],market).length,3);
  }
  target[field]=now;
 }
 for(const value of [now,now-1,NaN,Infinity,0,undefined,'invalid',now+.5]) {
  asset.mark.nextFundingAt=value;assert.deepEqual(fundingScenarios([position],market),[]);
 }
 asset.mark.nextFundingAt=now+H;
 asset.mark.lastFundingRate=0;assert.equal(Math.abs(fundingScenarios([position],market)[0].estimatedCashflow),0);
 asset.mark.lastFundingRate=-.001;assert.equal(fundingScenarios([position],market)[0].estimatedCashflow,.2);
 assert.equal(fundingScenarios([{...position,positionAmt:'-2'}],market)[0].estimatedCashflow,-.2);
});

test('explicit reanalysis cannot reuse a cached narrative after source expiry or settlement',async t=>{
 const {AIService}=require('../dist/main/services/ai/ai-service');
 const market=await fixture().service.snapshot([]),now=market.assets[0].fetchedAt;let clock=now,calls=0;
 t.mock.method(Date,'now',()=>clock);
 const service=new AIService(),payloads=[];
 service.providers.set('demo',{getProviderName:()=> 'demo',getModelName:()=> 'demo',chatJSON:async messages=>{
  calls++;payloads.push(JSON.parse(messages[1].content));return {summary:'合成解释 '+calls,warnings:[],suggestions:[]};
 }});
 const position={exchange:'binance',symbol:'BTCUSDT',positionAmt:'2',markPrice:'100',entryPrice:'90',unRealizedProfit:'20',marginType:'cross',leverage:null};
 const accounts=[{exchange:'binance',totalMarginBalance:100}];
 const asset=market.assets.find(a=>a.symbol===position.symbol);asset.fetchedAt=now;asset.mark.exchangeTimestamp=now-179000;
 const first=await service.analyzePortfolioHealth([position],accounts,'demo',market);
 assert.equal(first.fundingScenarios.length,3);
 assert.equal(await service.analyzePortfolioHealth([position],accounts,'demo',market),first);assert.equal(calls,1);
 clock=now+1001;
 const expired=await service.analyzePortfolioHealth([position],accounts,'demo',market);
 assert.deepEqual(expired.fundingScenarios,[]);assert.deepEqual(payloads[1].fundingScenarios,[]);
 assert.notEqual(expired.snapshotId,first.snapshotId);assert.equal(calls,2);
 assert.equal(await service.analyzePortfolioHealth([position],accounts,'demo',market),expired);assert.equal(calls,2);
 // A separate unchanged snapshot crosses settlement while both timestamps remain fresh.
 const settling=structuredClone(market);settling.assets.find(a=>a.symbol===position.symbol).mark={...asset.mark,exchangeTimestamp:now,nextFundingAt:now+2000};
 const before=await service.analyzePortfolioHealth([position],accounts,'demo',settling);assert.equal(before.fundingScenarios.length,3);
 clock=now+2000;
 const after=await service.analyzePortfolioHealth([position],accounts,'demo',settling);assert.deepEqual(after.fundingScenarios,[]);
 assert.notEqual(after.snapshotId,before.snapshotId);assert.equal(calls,4);
});

test('AI receives computed facts and bounded market context without internal position identifiers',async()=>{
 const {AIService}=require('../dist/main/services/ai/ai-service');const service=new AIService();let received;
 service.providers.set('demo',{getProviderName:()=> 'demo',getModelName:()=> 'demo',chatJSON:async(messages)=>{received=JSON.parse(messages[1].content);return {summary:'合成解释',warnings:[],suggestions:[]};}});
 const market=await fixture().service.snapshot([]);
 const p={exchange:'binance',symbol:'BTCUSDT',positionId:'synthetic-private-position-id',positionAmt:'1',entryPrice:'90',markPrice:'100',unRealizedProfit:'10',marginType:'cross',leverage:null};
 const result=await service.analyzePortfolioHealth([p],[{exchange:'binance',totalMarginBalance:100}], 'demo',market);
 assert.equal(received.market.version,'market-context-v1');assert.equal(received.facts.grossNotional,100);assert.equal(received.fundingScenarios[0].estimatedCashflow,-.1);
 assert(!JSON.stringify(received).includes('synthetic-private-position-id'));assert.equal(result.market.source,'Binance USD-M public REST');
});
