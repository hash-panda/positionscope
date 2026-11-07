const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeBinancePosition,binancePositionQuantity}=require('../dist/main/services/position-normalize');
const {BinanceDataError,binanceDataFailure}=require('../dist/main/utils/binance-diagnostics');
// Public Binance Position Information V3 example, checked 2026-11-07:
// https://developers.binance.com/docs/derivatives/usds-margined-futures/trade/rest-api/Position-Information-V3
const official={symbol:'ADAUSDT',positionSide:'BOTH',positionAmt:'30',entryPrice:'0.385',breakEvenPrice:'0.385077',markPrice:'0.41047590',unRealizedProfit:'0.76427700',liquidationPrice:'0',isolatedMargin:'0',notional:'12.31427700',marginAsset:'USDT',isolatedWallet:'0',initialMargin:'0.61571385',maintMargin:'0.08004280',positionInitialMargin:'0.61571385',openOrderInitialMargin:'0',adl:2,bidNotional:'0',askNotional:'0',updateTime:1720736417660};
test('documented V3 payload maps without V2 leverage or marginType fields',()=>{
 const p=normalizeBinancePosition(official,{marginType:'CROSSED',leverage:20});
 assert.equal(p.positionAmt,'30');assert.equal(p.maintenanceMargin,'0.0800428');assert.equal(p.initialMargin,'0.61571385');assert.equal(p.leverage,'20');assert.equal(p.liquidationPrice,null);
});
test('every consumed numeric field reports a bounded field name without the value',()=>{
 const marker='PRIVATE_SYNTHETIC_NEVER_OUTPUT';
 for(const field of ['positionAmt','entryPrice','markPrice','unRealizedProfit','liquidationPrice','isolatedWallet','isolatedMargin','positionInitialMargin','maintMargin','updateTime']) {
  assert.throws(()=>normalizeBinancePosition({...official,[field]:marker},{marginType:'ISOLATED',leverage:20}),e=>{
   assert(e instanceof BinanceDataError);assert.equal(e.field,field);
   const d=binanceDataFailure(e);assert(d.suggestion.includes(field));assert(!JSON.stringify(d).includes(marker));assert(!e.message.includes(marker));return true;
  });
 }
});
test('direction mismatch, zero/negative prices and negative margins remain errors',()=>{
 for(const [field,value] of [['positionSide','SHORT'],['entryPrice','0'],['markPrice','-1'],['maintMargin','-1']])assert.throws(()=>normalizeBinancePosition({...official,[field]:value},{marginType:'ISOLATED',leverage:20}),e=>e.field===field);
});
test('zero-quantity order-only rows can be filtered before price validation; malformed quantity cannot',()=>{
 assert.equal(binancePositionQuantity({positionAmt:'0',entryPrice:'0'}),0);
 assert.throws(()=>binancePositionQuantity({positionAmt:null}),e=>e.field==='positionAmt');
});
test('missing optional margins remain unknown and invented field names cannot reach UI',()=>{
 const p=normalizeBinancePosition({...official,maintMargin:undefined,positionInitialMargin:''},undefined);assert.equal(p.maintenanceMargin,null);assert.equal(p.initialMargin,null);
 const d=binanceDataFailure(new BinanceDataError('BINANCE_INVALID_POSITION','SECRET_MARKER'));assert(!JSON.stringify(d).includes('SECRET_MARKER'));
});
test('signed isolated wallet balance is distinct from margin and does not reject valid positions',()=>{
 const p=normalizeBinancePosition({...official,isolatedWallet:'-12.5',isolatedMargin:'18.75'},{marginType:'ISOLATED',leverage:20});
 assert.equal(p.isolatedWallet,'-12.5');assert.equal(p.isolatedMargin,'18.75');assert.equal(p.unRealizedProfit,official.unRealizedProfit);
 const missing=normalizeBinancePosition({...official,isolatedWallet:'-12.5',isolatedMargin:undefined},{marginType:'ISOLATED',leverage:20});
 assert.equal(missing.isolatedMargin,null);assert.equal(missing.isolatedWallet,'-12.5');
});
