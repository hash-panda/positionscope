const {test}=require('node:test');const assert=require('node:assert/strict');
const {ExchangeManager}=require('../dist/main/services/exchangeManager');
test('account success does not hide a failed positions request; first failure is visible',async()=>{
 const manager=new ExchangeManager();let fail=true;
 manager.exchanges=new Map([['binance',{hasCredentials:()=>true,getFuturesPositions:async()=>{if(fail)throw new Error('timeout');return []},getFuturesAccountInfo:async()=>({exchange:'binance'})}]]);
 await manager.getAllFuturesPositions();assert.equal(manager.hasAnyErrors(),true);assert.equal(manager.hasBlockingErrors(),false);
 await manager.getAllAccountInfo();assert.equal(manager.getAllErrors().length,1);
 fail=false;await manager.getAllFuturesPositions();assert.equal(manager.hasAnyErrors(),false);
});
