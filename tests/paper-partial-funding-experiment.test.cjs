const test=require('node:test'),assert=require('node:assert/strict');
const {estimatePartialFunding}=require('../dist/main/services/paper/partial-funding-experiment');
const estimate=(symbol,long,fills,row)=>estimatePartialFunding(symbol,long,fills,row,5000);
const {replayPartialOrders}=require('../dist/main/services/paper/partial-order-experiment');
const fills=[{id:'one/order',quantity:'1',quoteAt:2000},{id:'two/order',quantity:'0.5',quoteAt:4000}];
const row=(time=3000,rate='0.001')=>({symbol:'BTCUSDT',source:'/fapi/v1/fundingRate',time,rate,markPrice:'100'});
test('partial funding uses only executed quantity before the settlement, for both directions and rate signs',()=>{
 const before=JSON.stringify(fills);
 assert.deepEqual(estimate('BTCUSDT',true,fills,row()),{quantity:'1',funding:'-0.1',status:'estimated'});
 assert.equal(estimate('BTCUSDT',false,fills,row()).funding,'0.1');
 assert.equal(estimate('BTCUSDT',true,fills,row(3000,'-0.001')).funding,'0.1');
 assert.equal(estimate('BTCUSDT',false,fills,row(3000,'-0.001')).funding,'-0.1');
 assert.equal(estimate('BTCUSDT',true,fills,row(5000)).funding,'-0.15');
 assert.equal(estimate('BTCUSDT',true,fills,row(1000)).funding,'0');
 assert.deepEqual(estimate('BTCUSDT',true,fills,row(4000)),{quantity:null,funding:null,status:'ambiguous-at-settlement'});
 assert.deepEqual(estimate('BTCUSDT',true,JSON.parse(before),row()),estimate('BTCUSDT',true,fills,row()));
 assert.equal(JSON.stringify(fills),before);
});
test('partial funding rejects bad evidence and conflicts, deduplicates fills and rounds costs conservatively',()=>{
 assert.equal(estimate('BTCUSDT',true,[...fills,fills[0]],row()).funding,'-0.1');
 assert.throws(()=>estimate('BTCUSDT',true,[...fills,{...fills[0],quantity:'2'}],row()));
 assert.throws(()=>estimate('BTCUSDT',true,[{...fills[0],quoteAt:6000}],row()));
 for(const override of [{symbol:'ETHUSDT'},{source:'/fapi/v1/premiumIndex'},{markPrice:'0'},{rate:'NaN'},{time:-1},{time:6000}]) {
  assert.throws(()=>estimate('BTCUSDT',true,fills,{...row(),...override}));
 }
 const tiny=[{id:'tiny',quantity:'0.000000000001',quoteAt:1}],settled={...row(2),markPrice:'1'};
 assert.equal(estimate('BTCUSDT',true,tiny,settled).funding,'-0.000000000001');
 assert.equal(estimate('BTCUSDT',false,tiny,settled).funding,'0');
});
test('cancelled partial order pays funding on its fill, never on the cancelled remainder',()=>{
 const orders=[{id:'parent',quantity:'2',at:1000,expiresAt:10000}];
 const book={symbol:'BTCUSDT',updateId:'42',observedAt:2000,fetchedAt:2000,
  bids:[['99','1']],asks:[['100','1']],stepSize:'0.001',minQty:'0.001',maxQty:'100',minNotional:'5'};
 const result=replayPartialOrders('BTCUSDT',true,orders,[{id:'one',at:2000,book},
  {kind:'cancel',id:'cancel',at:3000,orderId:'parent'}],{feeBps:5,slippageBps:2})[0];
 assert.equal(result.status,'cancelled');assert.equal(result.remaining,'1');
 assert.equal(estimate('BTCUSDT',true,result.fills,row(3500)).funding,'-0.1');
});
