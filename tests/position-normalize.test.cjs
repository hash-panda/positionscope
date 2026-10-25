const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {normalizeOKXPosition:okx,normalizeBinancePosition:binance,normalizeBybitPosition:bybit,bybitMode}=require('../dist/main/services/position-normalize');
const {liquidationDistance,sumKnown,numeric}=require('../dist/main/utils/position-math');
const {buildRiskFacts}=require('../dist/main/services/ai/risk-facts');
const spec={ctType:'linear',settleCcy:'USDT',ctValCcy:'BTC',ctVal:'.01',ctMult:'100'};
const raw={instId:'BTC-USDT-SWAP',posId:'synthetic-1',pos:'20',posSide:'short',mgnMode:'isolated',markPx:'100',avgPx:'110',upl:'2',margin:'8',imr:'4',mmr:'1',liqPx:'150',lever:'5',uTime:'1000'};
test('OKX contracts convert to signed base units, preserving collateral vs requirements',()=>{
 const p=okx(raw,spec);assert.equal(p.positionAmt,'-0.2');assert.equal(p.rawQuantity,'-20');assert.equal(p.symbol,'BTCUSDT');
 assert.equal(p.isolatedMargin,'8');assert.equal(p.initialMargin,'4');assert.equal(p.maintenanceMargin,'1');assert.equal(liquidationDistance(p),.5);
 assert.equal(okx({...raw,posSide:'long'},spec).positionAmt,'0.2');assert.equal(okx({...raw,posSide:'net',pos:'-20'},spec).positionAmt,'-0.2');
 for(const invalid of [undefined,{...spec,ctType:'inverse'},{...spec,settleCcy:'BTC'},{...spec,ctVal:''}])assert.throws(()=>okx(raw,invalid));
});
test('Binance v3 adds symbol configuration and preserves absent liquidation instead of zero',()=>{
 const raw={symbol:'BTCUSDT',marginAsset:'USDT',positionSide:'SHORT',positionAmt:'-2',entryPrice:'120',markPrice:'100',unRealizedProfit:'40',liquidationPrice:'0',positionInitialMargin:'20',maintMargin:'0',isolatedWallet:'25'};
 const p=binance(raw,{marginType:'ISOLATED',leverage:10});assert.equal(p.marginType,'isolated');assert.equal(p.isolatedMargin,'25');assert.equal(p.maintenanceMargin,'0');assert.equal(p.liquidationPrice,null);
 assert.equal(binance(raw,undefined).marginType,'unknown');assert.throws(()=>binance({...raw,positionAmt:'2'},{}));
});
test('Bybit confirms mode from account info, not deprecated tradeMode, and portfolio has no position requirements',()=>{
 assert.equal(bybitMode({unifiedMarginStatus:6,marginMode:'REGULAR_MARGIN'}),'cross');assert.throws(()=>bybitMode({unifiedMarginStatus:1,marginMode:'REGULAR_MARGIN'}));
 const p=bybit({symbol:'BTCUSDT',side:'Sell',size:'.1',positionIdx:2,markPrice:'100',avgPrice:'110',unrealisedPnl:'1',positionIM:'',positionMM:'',liqPrice:'',leverage:'',tradeMode:0},'portfolio');
 assert.equal(p.positionAmt,'-0.1');assert.equal(p.marginType,'portfolio');assert.equal(p.initialMargin,null);assert.equal(p.leverage,null);
});
test('unknown totals propagate, liquidation uses side and never turns missing values into safety',()=>{
 for(const v of [null,'',' ',true,'0x10','Infinity'])assert.throws(()=>numeric(v));
 assert.equal(sumKnown([0,2]),2);assert.equal(sumKnown([null,2]),null);
 assert.equal(liquidationDistance({positionAmt:'1',markPrice:'100',liquidationPrice:'50'}),.5);
 assert.equal(liquidationDistance({positionAmt:'1',markPrice:'100',liquidationPrice:'110'}),-.1);
 assert.equal(liquidationDistance({positionAmt:'1',markPrice:'100',liquidationPrice:null}),null);
});
test('scenario facts preserve independent exchange equity and proportional coherent price paths',()=>{
 const p=okx(raw,spec);const facts=buildRiskFacts([p],[{exchange:'okx',totalMarginBalance:null,marginFacts:{scope:'adjusted',currency:'USD',mode:'portfolio',equity:30,initialMargin:null,maintenanceMargin:2}}]);
 assert.equal(facts.grossNotional,20);assert.equal(facts.grossToEquity,null);assert.equal(facts.accounts[0].riskEquity,30);
 const s=facts.scenarios.find(s=>s.retainedShare===.5&&s.priceMove===-.1);assert.equal(s.pricePnl,1);
 assert.equal(facts.positions[0].liquidationDistance,.5);assert.ok(!facts.limitations.some(l=>l.includes('部分持仓未提供有效强平价')));
});
function bybitService(mode='REGULAR_MARGIN') {
 const {BybitService}=require('../dist/main/services/bybit');const service=new BybitService();service.setCredentials('synthetic-key','synthetic-secret');
 const calls=[];service.client={get:async(url,config)=>{
  calls.push(url);const [path,query='']=url.split('?');const headers=config.headers;
  const expected=crypto.createHmac('sha256','synthetic-secret').update(headers['X-BAPI-TIMESTAMP']+'synthetic-key'+'5000'+query).digest('hex');
  assert.equal(headers['X-BAPI-SIGN'],expected);assert.equal(config.params,undefined);
  let result;
  if(path==='/v5/account/info')result={unifiedMarginStatus:5,marginMode:mode};
  else if(path==='/v5/account/wallet-balance') {assert.equal(new URLSearchParams(query).get('accountType'),'UNIFIED');result={list:[{accountType:'UNIFIED',totalEquity:'100',totalMarginBalance:'90',totalWalletBalance:'80',totalPerpUPL:'10',totalAvailableBalance:'70',totalInitialMargin:'20',totalMaintenanceMargin:'5',accountMMRate:'.05',coin:[{usdValue:'100'}]}]};}
  else {const cursor=new URLSearchParams(query).get('cursor');result={list:[],nextPageCursor:cursor?'':'a+/= b'};}
  return {data:{retCode:0,result}};
 }};return {service,calls};
}
test('Bybit GET HMAC matches encoded wire query including paginated cursor, without POSTs',async()=>{
 const {service,calls}=bybitService();assert.deepEqual(await service.getFuturesPositions(),[]);assert.ok(calls.some(u=>u.includes('cursor=a%2B%2F%3D+b')));
 const a=await service.getFuturesAccountInfo();assert.equal(a.totalAssets,100);assert.equal(a.totalMarginBalance,90);assert.equal(a.spotTotalUSDT,null);assert.equal(a.maxWithdrawAmount,null);
});
test('Bybit isolated ignores numeric account-wide fields even when API populates them',async()=>{
 const {service}=bybitService('ISOLATED_MARGIN');const a=await service.getFuturesAccountInfo();
 for(const key of ['totalWalletBalance','totalUnrealizedProfit','totalMarginBalance','availableBalance','maxWithdrawAmount'])assert.equal(a[key],null);
 assert.equal(a.totalAssets,100);assert.equal(a.marginFacts.maintenanceMargin,null);assert.equal(a.marginFacts.nativeRatio.value,null);
});
test('Bybit repeated pagination fails instead of silently truncating',async()=>{
 const {service}=bybitService();const get=service.client.get;service.client.get=async(u,c)=>{const r=await get(u,c);if(u.startsWith('/v5/position/list'))r.data.result.nextPageCursor='repeated';return r;};
 await assert.rejects(service.getFuturesPositions(),/分页游标/);
});
test('Binance spot valuation failure does not become zero total assets',async()=>{
 const {BinanceService}=require('../dist/main/services/binance');const s=new BinanceService();s.getSpotBalances=async()=>[{asset:'ASSET',total:2}];
 s.futuresClient={get:async(path)=>({data:path.endsWith('accountConfig')?{multiAssetsMargin:false}:{totalMarginBalance:'100',totalMaintMargin:'3'}})};
 const a=await s.getFuturesAccountInfo();assert.equal(a.totalMarginBalance,100);assert.equal(a.spotTotalUSDT,null);assert.equal(a.totalAssets,null);assert.equal(a.marginFacts.maintenanceMargin,3);
});
test('OKX public metadata carries no account headers and cached specs convert positions',async()=>{
 const {OKXService}=require('../dist/main/services/okx');const s=new OKXService();let specs=0;
 s.client={get:async(path,config)=>{
  if(path.startsWith('/api/v5/public/')){specs++;assert.equal(config.headers,undefined);return {data:{code:'0',data:[{instId:raw.instId,...spec}]}};}
  return {data:{code:'0',data:[raw]}};
 }};assert.equal((await s.getFuturesPositions())[0].positionAmt,'-0.2');await s.getFuturesPositions();assert.equal(specs,1);
});
