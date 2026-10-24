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
