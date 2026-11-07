const {test}=require('node:test');
const assert=require('node:assert/strict');
const {ExchangeManager}=require('../dist/main/services/exchangeManager');
test('a newer account error cannot hide an already paused positions operation',()=>{
  const manager=new ExchangeManager();
  manager.errorStates=new Map([
    ['binance:positions',{exchange:'binance',errorCode:'UNKNOWN',timestamp:1,consecutiveFailures:3,suggestion:''}],
    ['binance:account',{exchange:'binance',errorCode:'NETWORK',timestamp:2,consecutiveFailures:1,suggestion:''}],
  ]);
  assert.equal(manager.getAllErrors()[0].errorCode,'NETWORK');
  assert.equal(manager.getAllErrors()[0].retryPaused,true);
  manager.clearAllErrors();
  assert.deepEqual(manager.getAllErrors(),[]);
  assert.equal(manager.hasBlockingErrors(),false);
});
