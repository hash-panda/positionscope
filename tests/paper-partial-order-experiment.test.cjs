const test = require('node:test'), assert = require('node:assert/strict');
const { replayPartialOrders } = require('../dist/main/services/paper/partial-order-experiment');
const { decimal:d } = require('../dist/main/services/paper/decimal');
const policy = {feeBps:5,slippageBps:2};
const orders = [
 {id:'first',quantity:'1',at:1000,expiresAt:10000},
 {id:'second',quantity:'1.5',at:1000,expiresAt:10000},
];
function event(id,at,updateId,depth='2') {
 return {id,at,book:{symbol:'BTCUSDT',updateId,observedAt:at,fetchedAt:at,
  bids:[['99',depth]],asks:[['100',depth]],stepSize:'0.001',minQty:'0.001',maxQty:'1000',minNotional:'5'}};
}
test('JSON journal replay resumes partial orders with unique fills and per-fill costs', () => {
 const events=[event('one',2000,'42')];
 const run=events=>replayPartialOrders('BTCUSDT',true,orders,events,policy);
 const before=JSON.stringify({orders,events});
 const first=run(events);
 assert.equal(first[0].status,'filled');
 assert.equal(first[1].status,'partial');
 assert.equal(first[1].remaining,'0.5');
 const restored=JSON.parse(before);
 assert.deepEqual(replayPartialOrders('BTCUSDT',true,restored.orders,restored.events,policy),first);
 assert.deepEqual(run([...events,events[0],event('repeat-quote',3000,'42')]),first);
 const completed=run([...restored.events,event('two',4000,'43','0.5')]);
 assert.equal(completed[1].status,'filled');
 assert.equal(completed[1].remaining,'0');
 assert.deepEqual(completed[1].fills.map(f=>f.id),['one/second','two/second']);
 assert.equal(completed[1].fills.reduce((sum,f)=>sum+d(f.quantity),0n),d('1.5'));
 assert.equal(completed[1].fills.reduce((sum,f)=>sum+d(f.fee),0n),d(completed[1].fees));
 assert.equal(completed[1].fills.reduce((sum,f)=>sum+d(f.notional),0n),d(completed[1].notional));
 assert.equal(JSON.stringify({orders,events}),before);
});
test('expiry preserves the executed part, rejects replay conflicts and never backfills', () => {
 const first=event('one',2000,'42');
 const result=replayPartialOrders('BTCUSDT',false,orders,[first,event('late',10000,'43')],policy);
 assert.equal(result[1].status,'expired');
 assert.equal(result[1].remaining,'0.5');
 assert.equal(result[1].fills.length,1);
 assert.throws(()=>replayPartialOrders('BTCUSDT',true,orders,[first,{...first,at:3000}],policy));
 assert.throws(()=>replayPartialOrders('BTCUSDT',true,orders,[event('future',20000,'45'),first],policy));
 assert.throws(()=>replayPartialOrders('BTCUSDT',true,orders,[event('off-step',2000,'42','0.0005')],policy));
 assert.throws(()=>replayPartialOrders('BTCUSDT',true,[orders[0],orders[0]],[first],policy));
 const sameTime=replayPartialOrders('BTCUSDT',true,orders,[event('early',1000,'41')],policy);
 assert(sameTime.every(order=>order.fills.length===0));
});
test('cancellation retains partial fills and costs through replay and later quotes', () => {
 const run=events=>replayPartialOrders('BTCUSDT',true,orders,events,policy);
 const book=event('one',2000,'42');
 const cancel={kind:'cancel',id:'cancel-second',at:3000,orderId:'second'};
 const before=run([book]);
 const events=[book,cancel,cancel,{...cancel,id:'cancel-again',at:4000},event('two',5000,'43'),event('late',11000,'44')];
 const result=run(events);
 assert.deepEqual(result[1],{...before[1],status:'cancelled',cancelledAt:3000});
 assert.deepEqual(run(JSON.parse(JSON.stringify(events))),result);
 assert.equal(result[0].status,'filled');
 assert.throws(()=>run([book,cancel,{...cancel,orderId:'first'}]),/Conflicting/);
 assert.throws(()=>run([{...cancel,orderId:'unknown'}]));
 assert.throws(()=>run([{...cancel,at:999}]));
 const pending=run([{...cancel,at:1000},event('later',2000,'42')]);
 assert.equal(pending[1].fills.length,0);
 assert.equal(pending[1].remaining,'1.5');
 const expired=run([{...cancel,at:10000}]);
 assert.equal(expired[1].status,'expired');
 const filled=run([event('full',2000,'42','3'),cancel]);
 assert.equal(filled[1].status,'filled');
});
