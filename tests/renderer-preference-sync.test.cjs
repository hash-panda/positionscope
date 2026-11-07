const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vue = require('vue');
const {setImmediate: tick} = require('node:timers/promises');
// Execute the real renderer composable with Vue reactivity and synthetic IPC.
// Lifecycle/timers are injected so cross-window races are deterministic without a browser.
async function fixture(run) {
  const listeners={},timers=new Map();let mount,unmount,nextTimer=0;
  const state={configured:true,hideAmounts:false,proxyUrl:'',display:{maxDisplayCount:2,refreshInterval:60,colorScheme:'green-up',watchlistSymbols:['BTCUSDT','ETHUSDT']},
    ai:{enabled:true,defaultProvider:'deepseek',useCustomKeys:true,credentials:{deepseek:{provider:'deepseek',apiKey:'synthetic-ai-key',model:'synthetic-model'}}}};
  const position={exchange:'binance',symbol:'BTCUSDT',positionAmt:'1',entryPrice:'90',markPrice:'100',unRealizedProfit:'10'};
  const api={getStorageStatus:async()=>({state:'encrypted',message:''}),getDisplaySettings:async()=>structuredClone(state.display),getTheme:async()=>'light',getHideAmounts:async()=>state.hideAmounts,getDebugMode:async()=>false,getWindowOpacity:async()=>1,getAutoLaunch:async()=>false,getAISettings:async()=>structuredClone(state.ai),getProxySettings:async()=>state.proxyUrl,
    getAllExchangesCredentials:async()=>state.configured?{binance:{apiKey:'synthetic-key',apiSecret:'synthetic-secret'}}:{},getAppVersion:async()=>'0.2.1',getPositionOrder:async()=>[],hasCredentials:async()=>state.configured,
    getFuturesPositions:async()=>state.configured?[position]:[],getFuturesAccountInfo:async()=>state.configured?[{exchange:'binance',totalAssets:100,totalMarginBalance:100}]:[],getExchangeErrors:async()=>[],
    onPreferencesChanged:fn=>{listeners.preferences=fn;return()=>{};},onDataCleared:fn=>{listeners.clear=fn;return()=>{};},onRefreshData:fn=>{listeners.refresh=fn;return()=>{};},onExchangeErrors:fn=>{listeners.errors=fn;return()=>{};}};
  const source=fs.readFileSync(path.join(__dirname,'../src/renderer/src/composables/useTradingApp.ts'),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const module={exports:{}};
  const imported=id=>id==='vue'?{...vue,onMounted:fn=>{mount=fn;},onUnmounted:fn=>{unmount=fn;}}:id==='../types'?{exchanges:['binance','bybit','okx','hyperliquid'].map(id=>({id,name:id})),providers:['openai','anthropic','deepseek','qwen','grok','gemini'].map(id=>({id,name:id}))}:id.startsWith('../../../main/')?require('../dist/main/'+id.slice('../../../main/'.length)):require(id);
  new Function('require','module','exports','window','document','setInterval','clearInterval',code)(imported,module,module.exports,{electronAPI:api,matchMedia:()=>({matches:false})},{documentElement:{style:{}}},(callback,delay)=>{const id=++nextTimer;timers.set(id,{callback,delay});return id;},id=>timers.delete(id));
  const model=module.exports.useTradingApp(()=>{});await mount();
  try{await run({model,state,api,listeners,timers});}finally{unmount();}
}
test('remote preference reads preserve unsaved AI/proxy drafts and reset the refresh timer',()=>fixture(async({model,state,listeners,timers})=>{
  model.preferences.proxyUrl='http://draft.invalid:7890';model.aiKeyDrafts.deepseek='unsaved-synthetic-key';model.aiModelDrafts.deepseek='unsaved-model';
  state.proxyUrl='http://saved.invalid:7891';state.display.refreshInterval=3;state.ai.credentials.deepseek.apiKey='new-saved-key';state.ai.credentials.deepseek.model='new-saved-model';
  listeners.preferences();assert.equal(model.preferences.hideAmounts,true);await tick();
  assert.equal(model.preferences.refreshInterval,3);assert.equal(model.preferences.hideAmounts,false);assert.deepEqual([...timers.values()].map(value=>value.delay),[3000]);
  assert.equal(model.preferences.proxyUrl,'http://draft.invalid:7890');assert.equal(model.aiKeyDrafts.deepseek,'unsaved-synthetic-key');assert.equal(model.aiModelDrafts.deepseek,'unsaved-model');
}));
test('cross-window deletion clears every private snapshot and rejects an in-flight previous account response',()=>fixture(async({model,state,api,listeners})=>{
  assert.equal(model.positions.value.length,1);assert.equal(model.accounts.value.length,1);
  model.healthScore.value={summary:'synthetic-private-analysis'};model.positionEvents.value=[{symbol:'BTCUSDT'}];model.marketSnapshot.value={assets:[{symbol:'BTCUSDT'}]};model.aiKeyDrafts.deepseek='unsaved-private-key';model.preferences.proxyUrl='http://synthetic-private-proxy.invalid';
  let release;api.getFuturesPositions=()=>new Promise(resolve=>{release=resolve;});const pending=model.fetchData();await tick();
  state.configured=false;state.ai=null;state.proxyUrl='';state.hideAmounts=false;
  listeners.clear();
  assert.equal(model.preferences.hideAmounts,true);assert.equal(model.positions.value.length,0);assert.equal(model.accounts.value.length,0);assert.equal(model.healthScore.value,null);assert.equal(model.marketSnapshot.value,null);assert.equal(model.positionEvents.value.length,0);assert.equal(model.lastUpdated.value,null);
  assert.equal(model.credentialDrafts.binance.apiKey,'');assert.equal(model.savedCredentials.binance.apiSecret,'');assert.equal(model.aiKeyDrafts.deepseek,'');assert.equal(model.aiModelDrafts.deepseek,'');assert.equal(model.preferences.proxyUrl,'');assert.equal(model.dataClearRevision.value,1);
  await tick();assert.equal(model.preferences.hideAmounts,false);
  release([{exchange:'binance',symbol:'PRIVATEUSDT',unRealizedProfit:'12345'}]);await pending;
  assert.equal(model.positions.value.length,0);assert.equal(model.accounts.value.length,0);assert.equal(model.hasCredentials.value,false);assert.equal(model.totalPnL.value,null);
}));
test('late preference response from before deletion cannot restore old model secrets or privacy state',()=>fixture(async({model,state,api,listeners})=>{
  let release;const previous=api.getDisplaySettings;api.getDisplaySettings=()=>new Promise(resolve=>{release=resolve;});listeners.preferences();
  state.configured=false;state.ai=null;state.proxyUrl='';state.hideAmounts=false;api.getDisplaySettings=previous;listeners.clear();await tick();
  release({...state.display});await tick();assert.equal(model.aiKeyDrafts.deepseek,'');assert.equal(model.preferences.aiEnabled,false);assert.equal(model.positions.value.length,0);assert.equal(model.preferences.hideAmounts,false);
}));
