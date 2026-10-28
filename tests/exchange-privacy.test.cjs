const {test}=require('node:test');
const assert=require('node:assert/strict');
const axios=require('axios');
const {ExchangeManager}=require('../dist/main/services/exchangeManager');
const {exchangeFailure}=require('../dist/main/utils/exchange-diagnostics');
const marker='SYNTHETIC_EXCHANGE_PRIVATE_573921';
const hostile=(config={},status=401)=>new axios.AxiosError(marker,marker,config,{private:marker},{status,data:{message:marker},headers:{private:marker},config});
async function capture(fn){
 const logs=[],saved={};
 for(const key of ['log','error','warn','info','debug']){saved[key]=console[key];console[key]=(...args)=>logs.push(args);}
 try{await fn(logs);}finally{Object.assign(console,saved);}
 assert(!JSON.stringify(logs).includes(marker),'private marker entered console/logger');
}
test('exchange diagnostics whitelist statuses/categories and never use echoed text or arbitrary codes',()=>{
 for(const status of [401,403,429,503]){
  const failure=exchangeFailure(hostile({},status));assert.equal(failure.errorCode,`HTTP_${status}`);assert(!JSON.stringify(failure).includes(marker));
 }
 for(const error of [null,undefined,marker,{message:marker,code:marker},hostile({},marker),{response:{status:Infinity}},Object.assign(new Error('401 Unauthorized timeout'),{code:'toString'})]){
  assert.equal(exchangeFailure(error).errorCode,'UNKNOWN');assert(!JSON.stringify(exchangeFailure(error)).includes(marker));
 }
 for(const [code,expected] of [['ETIMEDOUT','TIMEOUT'],['ECONNABORTED','TIMEOUT'],['ECONNREFUSED','NETWORK'],['ERR_CANCELED','CANCELLED']])assert.equal(exchangeFailure({code,message:marker}).errorCode,expected);
 assert.match(exchangeFailure({code:'ETIMEDOUT'}).suggestion,/超时/);
 assert.match(exchangeFailure(new Error('mapping failed')).suggestion,/数据完整性/);
});
test('known Hyperliquid account failures keep local actionable messages without forwarding their error text',()=>{
 for(const code of ['HYPERLIQUID_UNSUPPORTED_ACCOUNT','HYPERLIQUID_INCOMPLETE_ACCOUNT','HYPERLIQUID_READ_FAILED']){
  const failure=exchangeFailure({code,message:marker,response:{data:marker}});
  assert.equal(failure.errorCode,code);assert(!JSON.stringify(failure).includes(marker));assert.match(failure.suggestion,/Hyperliquid/);
 }
 assert.match(exchangeFailure({code:'HYPERLIQUID_UNSUPPORTED_ACCOUNT'}).suggestion,/不会更改账户模式/);
});
test('all exchange aggregation failures keep errors visible and bounded, including null/non-Error throws',async()=>capture(async logs=>{
 for(const exchange of ['binance','bybit','okx','hyperliquid'])for(const error of [hostile(),null,marker]){
  const manager=new ExchangeManager();let fail=true;
  manager.exchanges=new Map([[exchange,{hasCredentials:()=>true,
   getFuturesPositions:async()=>{if(fail)throw error;return []},
   getFuturesAccountInfo:async()=>({exchange}),getSpotBalances:async()=>{throw error},
  }]]);
  assert.deepEqual(await manager.getAllFuturesPositions(),[]);
  assert.equal(manager.hasAnyErrors(),true);assert.equal(manager.hasBlockingErrors(),false);
  await manager.getAllAccountInfo();assert.equal(manager.getAllErrors().length,1,'account success hid positions error');
  assert.deepEqual(await manager.getAllSpotBalances(),[]);
  assert(!JSON.stringify(manager.getAllErrors()).includes(marker),'private marker entered renderer error state');
  await manager.getAllFuturesPositions();await manager.getAllFuturesPositions();assert.equal(manager.hasBlockingErrors(),true);
  manager.clearAllErrors();fail=false;await manager.getAllFuturesPositions();assert.equal(manager.hasAnyErrors(),false);
 }
 assert(logs.some(args=>args.some(arg=>arg?.errorCode==='HTTP_401')),'safe diagnostic absent');
}));
test('four adapters omit proxy hosts and Binance spot failures omit Axios request/response secrets',async()=>capture(async()=>{
 const {BinanceService}=require('../dist/main/services/binance');
 const {BybitService}=require('../dist/main/services/bybit');
 const {OKXService}=require('../dist/main/services/okx');
 const {HyperliquidService}=require('../dist/main/services/hyperliquid');
 for(const Class of [BinanceService,BybitService,OKXService,HyperliquidService]){
  const service=new Class();service.setCredentials({exchange:service.getExchangeType(),apiKey:marker,apiSecret:marker,passphrase:marker,proxyUrl:`http://${marker}.invalid:7890`});
  assert.equal(service.hasCredentials(),true);service.setProxy('');service.setProxy(marker);
 }
 const service=new BinanceService();service.setCredentials({exchange:'binance',apiKey:marker,apiSecret:marker});
 service.spotClient.defaults.adapter=async config=>{assert.equal(config.headers['X-MBX-APIKEY'],marker);throw hostile(config);};
 await assert.rejects(service.getSpotBalances());
}));
