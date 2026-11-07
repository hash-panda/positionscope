const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BoundedResearchAIService } = require('../dist/main/services/research/ai-research');
const { RESEARCH_AI_LIMITS } = require('../dist/main/types/research-ai');

const NOW = 1800000000000;
const fact = (metric, value, unit = 'percent') => ({ id:`BTCUSDT:${metric}`, label:metric, value, unit, source:'https://fapi.binance.com/fapi/v1/klines', observedAt:NOW-1000, fetchedAt:NOW, window:'last closed hour' });
const request = { eventId:'BTCUSDT:strength', snapshotId:'synthetic-snapshot' };
function fixture(overrides = {}) {
  const facts = [fact('price-change-1h',1),fact('oi-change-1h',-2),fact('funding-settled',0.01),fact('spread',0.02)];
  const conditions = [
    {id:'BTCUSDT:condition:price-positive',label:'closed price change above zero',factIds:[facts[0].id],state:'met'},
    {id:'BTCUSDT:condition:price-negative',label:'closed price change below zero',factIds:[facts[0].id],state:'not-met'},
    {id:'BTCUSDT:condition:liquidity-ready',label:'observed liquidity threshold passed',factIds:[facts[3].id],state:'met'},
  ];
  const snapshot = { version:'research-snapshot-v1', snapshotId:request.snapshotId, ruleVersion:'synthetic-v1',status:'available',
    timestamps:{fetchedAt:NOW,expiresAt:NOW+120000},coverage:{selected:['BTCUSDT']},
    events:[{ id:request.eventId,snapshotId:request.snapshotId,ruleVersion:'synthetic-v1',symbol:'BTCUSDT',baseAsset:'BTC',kind:'relative-strength',direction:'long',title:'Synthetic',reason:'Synthetic',priority:1,detectedAt:NOW,expiresAt:NOW+120000,facts:[facts[0]],gaps:[],deepResearchEligible:true }],
  };
  const evidence = { version:'research-evidence-v1',ruleVersion:'synthetic-v1',snapshotId:request.snapshotId,symbol:'BTCUSDT',fetchedAt:NOW,expiresAt:NOW+120000,status:'available',facts,conditions,gaps:[],changes:{price1hPercent:1,price24hPercent:2,openInterest1hPercent:-2,settledFundingRate:.01},liquidity:{spreadBps:2} };
  const conclusion = { status:'conditional-long',summary:'价格变化为{{fact:BTCUSDT:price-change-1h}}，但持仓量变化为{{fact:BTCUSDT:oi-change-1h}}。需观察条件能否保持。',supportFactIds:[facts[0].id],counterFactIds:[facts[1].id],triggerConditionIds:[conditions[0].id],invalidationConditionIds:[conditions[1].id] };
  const calls = [], toolCalls = [];
  let current = true, now = NOW;
  const provider = {provider:'synthetic',model:'explicit-synthetic-model',maxOutputTokens:1200,isCurrent:()=>current,chatJSON:async messages=>{
    calls.push(messages);
    return calls.length % 2 ? {tool:'open_interest'} : structuredClone(conclusion);
  }};
  const deps = {getSnapshot:async()=>snapshot,getEvidence:async symbol=>{toolCalls.push(symbol);return evidence;},getProvider:()=>provider,now:()=>now,...overrides};
  return {snapshot,evidence,conclusion,provider,calls,toolCalls,deps,service:new BoundedResearchAIService(deps),setNow:value=>{now=value;},disable:()=>{current=false;}};
}
test('public research performs only plan and conclusion with literal fact values, actual bundle trace and unknown costs', async()=>{
  const f = fixture(); const result = await f.service.analyze(request);
  assert.equal(f.calls.length,2);assert.deepEqual(f.toolCalls,['BTCUSDT']);assert.equal(result.status,'conditional-long');
  assert.match(result.summary,/1%〔BTCUSDT:price-change-1h〕/);assert.match(result.summary,/-2%〔BTCUSDT:oi-change-1h〕/);
  assert.equal(result.modelCalls,2);assert.equal(result.model,'explicit-synthetic-model');assert.equal(result.usage,null);assert.equal(result.cost,null);
  assert.equal(result.toolTrace[0].tool,'open_interest');assert.equal(result.toolTrace[0].operation,'public-evidence-bundle');
  assert.deepEqual(result.toolTrace[0].factIds,f.evidence.facts.map(x=>x.id));assert.equal(result.expiresAt,NOW+120000);
});
test('projection excludes account, credentials, holdings, arbitrary properties and chat history from both model calls', async()=>{
  const f = fixture();
  for(const obj of [f.snapshot,f.snapshot.events[0],f.snapshot.events[0].facts[0],f.evidence,f.evidence.facts[1],f.evidence.conditions[0]]){
    obj.apiKey='private-key-sentinel';obj.positions=[{symbol:'PRIVATE_HOLDING',balance:123}];obj.account={email:'private@example.test'};
  }
  await f.service.analyze(request);
  const sent = JSON.stringify(f.calls);for(const forbidden of ['private-key-sentinel','PRIVATE_HOLDING','private@example.test','apiKey','positions','account'])assert.equal(sent.includes(forbidden),false,forbidden);
  for(const messages of f.calls)assert.deepEqual(messages.map(m=>m.role),['system','user']);
});
test('funding ratio placeholders preserve raw rate and never become leverage multiples',async()=>{
  const f=fixture();const funding=f.evidence.facts[2];funding.value=.001;funding.unit='ratio';
  f.conclusion.counterFactIds=[funding.id];f.conclusion.summary='资金费率为{{fact:BTCUSDT:funding-settled}}，需关注持有成本。';
  const result=await f.service.analyze(request);assert.match(result.summary,/0\.001（原始比率）/);assert.equal(result.summary.includes('×'),false);
  assert.equal(result.facts.find(x=>x.id===funding.id).value,.001);assert.equal(result.facts.find(x=>x.id===funding.id).unit,'ratio');
});
test('relative-to-BTC change differences use percentage points while ordinary price changes stay percent',async()=>{
  const f=fixture();const relative=fact('relative-btc-24h',3);f.snapshot.events[0].facts.push(relative);
  f.conclusion.supportFactIds=[relative.id];f.conclusion.summary='较比特币的涨跌幅差为{{fact:BTCUSDT:relative-btc-24h}}，需观察反证。';
  const result=await f.service.analyze(request);assert.match(result.summary,/3 个百分点〔BTCUSDT:relative-btc-24h〕/);assert.equal(result.summary.includes('3%'),false);
  assert.equal(result.facts.find(x=>x.id===relative.id).value,3);assert.equal(result.facts.find(x=>x.id===relative.id).unit,'percent');
});
test('input requires a current authorized event and prohibits renderer symbols and arbitrary arguments before payment', async()=>{
  for(const input of [{...request,symbol:'ETHUSDT'},{...request,url:'https://example.test'}, {...request,eventId:'unselected'}, {...request,snapshotId:'old'}]){
    const f=fixture();await assert.rejects(f.service.analyze(input));assert.equal(f.calls.length,0);assert.equal(f.toolCalls.length,0);
  }
  const f=fixture();f.snapshot.events[0].deepResearchEligible=false;await assert.rejects(f.service.analyze(request),{code:'INVALID_REQUEST'});assert.equal(f.calls.length,0);
});
test('plan rejects arbitrary tools, URLs, symbols and extra parameters without running a tool',async()=>{
  for(const plan of [{tool:'order'},{tool:'liquidity',url:'https://example.test'},{tool:'funding',symbol:'ETHUSDT'},{tool:['price_history']}]){
    const f=fixture();f.provider.chatJSON=async messages=>{f.calls.push(messages);return plan;};
    await assert.rejects(f.service.analyze(request),{code:'INVALID_OUTPUT'});assert.equal(f.calls.length,1);assert.equal(f.toolCalls.length,0);
  }
});
test('unknown, duplicate, overlapping and unsupported condition/fact references reject the final output',async()=>{
  const edits=[c=>c.supportFactIds=['made-up'],c=>c.counterFactIds=[...c.supportFactIds],c=>c.supportFactIds=[...c.supportFactIds,...c.supportFactIds],c=>c.invalidationConditionIds=['arbitrary'],c=>c.invalidationConditionIds=[...c.triggerConditionIds],c=>c.confidence=.9,c=>c.status='buy'];
  for(const edit of edits){const f=fixture();edit(f.conclusion);await assert.rejects(f.service.analyze(request),{code:'INVALID_OUTPUT'});assert.equal(f.calls.length,2);}
});
test('unreferenced numbers, fabricated placeholders, profitability claims and probabilities fail closed',async()=>{
  for(const summary of ['目标为100 USDT','上涨５０％','预计翻倍','上涨五成','上涨 five percent','一定稳赚','胜率很高','模型一致因此概率很高','buy now','<script>alert()</script>','变化{{fact:invented}}','变化{{fact:BTCUSDT:spread}}']){
    const f=fixture();f.conclusion.summary=summary;await assert.rejects(f.service.analyze(request),{code:'INVALID_OUTPUT'});
  }
});
test('missing critical numeric data, evidence gaps or absent counterevidence downgrade to observation',async()=>{
  for(const edit of [f=>f.evidence.changes.openInterest1hPercent=null,f=>f.evidence.status='partial',f=>f.conclusion.counterFactIds=[],f=>f.evidence.conditions[0].state='unknown',f=>f.evidence.conditions[2].state='not-met',f=>f.conclusion.triggerConditionIds=[]]){
    const f=fixture();edit(f);if(!f.conclusion.counterFactIds.length)f.conclusion.summary='当前证据尚不足。';
    const result=await f.service.analyze(request);assert.equal(result.status,'observation');assert.equal(result.summary,'关键证据不足，暂时观察。');assert.ok(result.gaps.length);
  }
});
test('direction cannot use reversed trigger and invalidation conditions',async()=>{
  const f=fixture();f.conclusion.status='conditional-short';const result=await f.service.analyze(request);assert.equal(result.status,'observation');
});
test('stale evidence or a different symbol or snapshot never reaches conclusion',async()=>{
  for(const edit of [f=>f.evidence.expiresAt=NOW,f=>f.evidence.snapshotId='other',f=>f.evidence.symbol='ETHUSDT',f=>f.evidence.facts[1].fetchedAt=NOW-300001]){
    const f=fixture();edit(f);await assert.rejects(f.service.analyze(request),{code:'STALE'});assert.equal(f.calls.length,1);
  }
});
test('stale initial data makes no paid call',async()=>{
  for(const edit of [f=>f.snapshot.timestamps.expiresAt=NOW,f=>f.snapshot.events[0].expiresAt=NOW,f=>f.snapshot.events[0].facts[0].fetchedAt=NOW-300001]){
    const f=fixture();edit(f);await assert.rejects(f.service.analyze(request),{code:'STALE'});assert.equal(f.calls.length,0);
  }
});
test('same event shares a flight, a different event is busy, and completed results are not cached',async()=>{
  const f=fixture();let release;const initial=f.provider.chatJSON;f.provider.chatJSON=messages=>new Promise(resolve=>{release=()=>initial(messages).then(resolve);});
  const one=f.service.analyze(request),two=f.service.analyze(request);assert.equal(one,two);
  await assert.rejects(f.service.analyze({...request,eventId:'other'}),{code:'BUSY'});await Promise.resolve();
  f.provider.chatJSON=initial;release();await one;await f.service.analyze(request);assert.equal(f.calls.length,4);
});
test('a rejected model output is never cached; retry performs fresh plan',async()=>{
  const f=fixture();f.conclusion.summary='profit forecast 200';await assert.rejects(f.service.analyze(request),{code:'INVALID_OUTPUT'});
  f.conclusion.summary='价格与持仓量出现分歧。';const result=await f.service.analyze(request);assert.equal(f.calls.length,4);assert.equal(result.modelCalls,2);
});
test('total deadline stops before the next paid call and strips underlying error details',async()=>{
  const f=fixture();const original=f.provider.chatJSON;f.provider.chatJSON=async messages=>{const value=await original(messages);f.setNow(NOW+RESEARCH_AI_LIMITS.totalMilliseconds);return value;};
  await assert.rejects(f.service.analyze(request),{code:'BUDGET'});assert.equal(f.calls.length,1);assert.equal(f.toolCalls.length,0);
  const broken=fixture();broken.provider.chatJSON=async()=>{throw new Error('private-key-sentinel');};await assert.rejects(broken.service.analyze(request),e=>e.code==='UNAVAILABLE'&&!e.message.includes('sentinel'));
});
test('timer deadline keeps single-flight lock until the outstanding vendor request settles',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const f=fixture();let release;f.provider.chatJSON=messages=>{f.calls.push(messages);return new Promise(resolve=>{release=()=>resolve({tool:'funding'});});};
  const pending=f.service.analyze(request);await Promise.resolve();f.setNow(NOW+RESEARCH_AI_LIMITS.totalMilliseconds);
  t.mock.timers.tick(RESEARCH_AI_LIMITS.totalMilliseconds);await assert.rejects(pending,{code:'BUDGET'});
  await assert.rejects(f.service.analyze({...request,eventId:'another'}),{code:'BUSY'});
  assert.equal(f.calls.length,1);release();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.toolCalls.length,0);
});
test('public evidence failure yields no fabricated successful trace, and can be retried',async()=>{
  const f=fixture();let fail=true;f.deps.getEvidence=async symbol=>{f.toolCalls.push(symbol);if(fail)throw new Error('private-response-sentinel');return f.evidence;};
  await assert.rejects(f.service.analyze(request),e=>e.code==='UNAVAILABLE'&&!e.message.includes('sentinel'));
  fail=false;f.provider.chatJSON=async messages=>{f.calls.push(messages);return f.calls.length===2?{tool:'funding'}:structuredClone(f.conclusion);};
  const result=await f.service.analyze(request);assert.equal(result.modelCalls,2);assert.equal(result.toolTrace.length,1);assert.equal(f.calls.length,3);
});
test('bounded input size and token-cap mismatch reject before an unbounded call',async()=>{
  const f=fixture();f.provider.maxOutputTokens=9999;await assert.rejects(f.service.analyze(request),{code:'BUDGET'});assert.equal(f.calls.length,0);
  const crowded=fixture();crowded.snapshot.events[0].facts=Array.from({length:41},(_,i)=>fact(`metric-${i}`,i));await assert.rejects(crowded.service.analyze(request),{code:'BUDGET'});assert.equal(crowded.calls.length,0);
  const oversized=fixture();oversized.snapshot.events[0].facts=Array.from({length:40},(_,i)=>({...fact(`metric-${i}`,i),label:'l'.repeat(160),source:'s'.repeat(240),window:'w'.repeat(80)}));
  await assert.rejects(oversized.service.analyze(request),{code:'BUDGET'});assert.equal(oversized.calls.length,0);
});
test('disabling or changing provider during a call prevents remaining tool/model work',async()=>{
  const f=fixture();const initial=f.provider.chatJSON;f.provider.chatJSON=async messages=>{const value=await initial(messages);f.disable();return value;};
  await assert.rejects(f.service.analyze(request),{code:'PROVIDER_CHANGED'});assert.equal(f.calls.length,1);assert.equal(f.toolCalls.length,0);
});
test('real configured adapter preserves explicit model, caps actual outbound max_tokens, and isolates existing holdings provider',async()=>{
  const {AIService}=require('../dist/main/services/ai/ai-service');const service=new AIService();
  service.setConfig({enabled:true,useCustomKeys:true,defaultProvider:'deepseek',credentials:{deepseek:{apiKey:'synthetic-key',model:'explicit-synthetic-model'}}});
  const adapter=service.getResearchProvider();const p=service.researchProviders.get('deepseek');const sent=[];
  p.client.defaults.adapter=async config=>{sent.push(JSON.parse(config.data));return{status:200,headers:{},config,data:{choices:[{message:{content:'{"tool":"funding"}'}}]}};};
  await adapter.chatJSON([{role:'user',content:'synthetic public facts'}]);
  assert.equal(sent[0].model,'explicit-synthetic-model');assert.equal(sent[0].max_tokens,1200);assert.equal(service.providers.get('deepseek').config.maxTokens,undefined);
  assert.equal(Object.hasOwn(adapter,'config'),false);assert.equal(JSON.stringify(adapter).includes('synthetic-key'),false);
  service.setConfig({enabled:false,useCustomKeys:true,defaultProvider:'deepseek',credentials:{}});assert.equal(adapter.isCurrent(),false);assert.throws(()=>service.getResearchProvider());
});
test('clearing cache or changing configuration rejects pending portfolio output and cannot overwrite fresh cached facts',async()=>{
  const {AIService}=require('../dist/main/services/ai/ai-service');
  const position={exchange:'binance',symbol:'BTCUSDT',positionAmt:'1',entryPrice:'90',markPrice:'100',unRealizedProfit:'10',marginType:'cross',isolatedMargin:'0',leverage:'5'};
  const accounts=[{exchange:'binance',totalMarginBalance:100}];
  for(const action of ['clear','config']){
    const service=new AIService();let release,calls=0;
    const provider={getProviderName:()=> 'synthetic',getModelName:()=> 'synthetic-model',chatJSON:()=>{
      calls++;return calls===1?new Promise(resolve=>{release=()=>resolve({summary:'obsolete synthetic facts',warnings:[],suggestions:[]});}):Promise.resolve({summary:'fresh synthetic facts',warnings:[],suggestions:[]});
    }};
    service.providers.set('synthetic',provider);
    const pending=service.analyzePortfolioHealth([position],accounts,'synthetic');
    if(action==='clear')service.clearCache();else service.setConfig({enabled:false,useCustomKeys:true,defaultProvider:'deepseek',credentials:{}});
    service.providers.set('synthetic',provider);
    const fresh=await service.analyzePortfolioHealth([position],accounts,'synthetic');assert.equal(fresh.summary,'fresh synthetic facts');
    release();await assert.rejects(pending,/配置或数据已变更/);
    const cached=await service.analyzePortfolioHealth([position],accounts,'synthetic');assert.equal(cached.summary,'fresh synthetic facts');assert.equal(calls,2);
    assert.equal(JSON.stringify([...service.cache.cache.values()]).includes('obsolete'),false);
  }
});
test('clearing conversation or changing configuration rejects pending chat and cannot repopulate cleared history',async()=>{
  const {AIService}=require('../dist/main/services/ai/ai-service');
  for(const action of ['clear','config']){
    const service=new AIService();let release,calls=0;
    const provider={chat:()=>{calls++;return calls===1?new Promise(resolve=>{release=()=>resolve('obsolete synthetic response');}):Promise.resolve('fresh synthetic response');}};
    service.providers.set('synthetic',provider);const pending=service.chat('obsolete synthetic prompt',undefined,'synthetic');
    if(action==='clear')service.clearConversation();else service.setConfig({enabled:false,useCustomKeys:true,defaultProvider:'deepseek',credentials:{}});
    assert.deepEqual(service.conversationHistory,[]);service.providers.set('synthetic',provider);
    assert.equal(await service.chat('fresh synthetic prompt',undefined,'synthetic'),'fresh synthetic response');
    release();await assert.rejects(pending,/配置或对话已变更/);
    assert.deepEqual(service.conversationHistory.map(m=>m.content),['fresh synthetic prompt','fresh synthetic response']);
  }
});
