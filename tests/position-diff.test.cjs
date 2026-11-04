const {test}=require('node:test');const assert=require('node:assert/strict');const {diffPositions}=require('../dist/main/utils/position-diff');
const p={exchange:'binance',symbol:'BTCUSDT',positionAmt:'1',entryPrice:'100',markPrice:'110'};
test('price changes never invent money transfers or quantity events',()=>assert.deepEqual(diffPositions([p],[{...p,markPrice:'120'}],1),[]));
test('tracks add, reduce and close independently of hedge sides',()=>{
 assert.equal(diffPositions([p],[{...p,positionAmt:'2'}],1)[0].kind,'increased');
 assert.equal(diffPositions([p],[{...p,positionAmt:'.5'}],1)[0].kind,'reduced');
 assert.equal(diffPositions([p],[],1)[0].kind,'closed');
 const events=diffPositions([p],[{...p,positionAmt:'-1'}],1);assert.deepEqual(events.map(e=>e.kind),['closed','opened']);
});
test('invalid or duplicated snapshots cannot fabricate a history',()=>{
 assert.throws(()=>diffPositions([p],[{...p,positionAmt:'NaN'}],1));assert.throws(()=>diffPositions([p],[p,p],1));
});
test('normalized one-way Binance and Bybit reversals produce disappearance and appearance despite stable IDs',()=>{
 const {normalizeBinancePosition,normalizeBybitPosition}=require('../dist/main/services/position-normalize');
 const bn=amount=>normalizeBinancePosition({symbol:'BTCUSDT',marginAsset:'USDT',positionSide:'BOTH',positionAmt:String(amount),markPrice:'100',entryPrice:'100',unRealizedProfit:'0'},undefined);
 const by=amount=>normalizeBybitPosition({symbol:'BTCUSDT',positionIdx:0,side:amount>0?'Buy':'Sell',size:String(Math.abs(amount)),markPrice:'100',avgPrice:'100',unrealisedPnl:'0'},'cross');
 const hl=amount=>({...p,exchange:'hyperliquid',symbol:'BTC',instrumentId:'BTC',positionId:'BTC',positionAmt:String(amount)});
 for(const normalize of [bn,by,hl]) for(const [oldAmount,newAmount] of [[1,-1],[-1,1],[3,-1],[-3,1]]) {
  const old=normalize(oldAmount),next=normalize(newAmount);assert.equal(old.positionId,next.positionId);
  const events=diffPositions([old],[next],123);
  assert.deepEqual(events.map(e=>[e.kind,e.side,e.previousQuantity,e.quantity]),[
   ['closed',oldAmount>0?'long':'short',Math.abs(oldAmount),0],
   ['opened',newAmount>0?'long':'short',0,Math.abs(newAmount)],
  ]);
  assert.equal(new Set(events.map(e=>e.id)).size,2);assert(events.every(e=>e.at===123&&e.exchange===old.exchange));
 }
});
test('stable-ID same-side size changes and price-only snapshots retain their meaning without mutation',()=>{
 const a={...p,positionId:'synthetic-stable',instrumentId:'BTCUSDT'};
 for(const sign of [1,-1]) {
  const before={...a,positionAmt:String(sign)},after={...a,positionAmt:String(2*sign)};
  const original=JSON.stringify([before,after]);
  assert.deepEqual(diffPositions([before],[{...before,markPrice:'120'}],1),[]);
  assert.deepEqual(diffPositions([before],[after],1).map(e=>[e.kind,e.side,e.previousQuantity,e.quantity]),[['increased',sign>0?'long':'short',1,2]]);
  assert.equal(JSON.stringify([before,after]),original);
 }
});
test('hedged IDs and multiple venues keep independent event identities during a reversal',()=>{
 const a={...p,positionId:'BTCUSDT:BOTH',instrumentId:'BTCUSDT'};
 assert.throws(()=>diffPositions([], [a,{...a,positionAmt:'-1'}],123),/Duplicate snapshot position/);
 const hedge={...a,positionId:'BTCUSDT:SHORT',positionAmt:'-2'};
 const other={...a,exchange:'bybit'};
 const events=diffPositions([a,hedge,other],[{...a,positionAmt:'-1'},{...hedge,positionAmt:'-3'},{...other,positionAmt:'2'}],123);
 assert.deepEqual(events.filter(e=>e.kind==='closed'||e.kind==='opened').map(e=>e.exchange),['binance','binance']);
 assert.equal(events.filter(e=>e.kind==='increased').length,2);assert.equal(new Set(events.map(e=>e.id)).size,4);
});
