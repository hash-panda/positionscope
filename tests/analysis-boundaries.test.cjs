const {test}=require('node:test');
const assert=require('node:assert/strict');
const {AIService}=require('../dist/main/services/ai/ai-service');
const position={exchange:'binance',symbol:'BTCUSDT',positionAmt:'1',entryPrice:'90',markPrice:'100',unRealizedProfit:'10',marginType:'cross',leverage:'5'};
const accounts=[{exchange:'binance',totalMarginBalance:100}];
const providers=['openai','anthropic','deepseek','qwen','grok','gemini'];
const key='SYNTHETIC_KEY_ANALYSIS_BOUNDARY';
function configure(service,provider='deepseek',patch={},enabled=true){
 service.setConfig({enabled,useCustomKeys:true,defaultProvider:provider,credentials:{[provider]:{provider,apiKey:key,model:'synthetic-explicit-model',baseURL:'https://analysis.example.invalid/v1',...patch}}});
 return service.providers.get(provider);
}
function intercept(provider,reply){
 const requests=[];
 provider.client.defaults.adapter=async config=>{
  const body=JSON.parse(config.data);requests.push({body,baseURL:config.baseURL,authorization:config.headers.Authorization});
  return {status:200,headers:{},config,data:provider.getProviderName()==='anthropic'?{content:[{type:'text',text:JSON.stringify(reply())}]}:{choices:[{message:{content:JSON.stringify(reply())},finish_reason:'stop'}]}};
 };
 return requests;
}
const narrative=()=>({summary:'合成说明；不是收益预测。',warnings:[],suggestions:[]});

test('all six HTTP provider paths cannot replace local risk facts or provenance with model extra fields',async()=>{
 for(const name of providers){
  const service=new AIService(),provider=configure(service,name);
  const requests=intercept(provider,()=>({...narrative(),facts:{grossNotional:999999},snapshotId:'forged',provider:'forged',model:'forged',analyzedAt:'forged',market:{forged:true},fundingScenarios:[{forged:true}],overallScore:100}));
  const result=await service.analyzePortfolioHealth([position],accounts,name);
  assert.equal(requests.length,1);assert.equal(requests[0].body.model,'synthetic-explicit-model');
  // Anthropic/generic adapters append prose after the serialized JSON input.
  const input=requests[0].body.messages.find(m=>m.role==='user').content;
  const user=JSON.parse(input.split('\n\n')[0]);
  assert.equal(user.facts.grossNotional,100);assert.equal(user.facts.marginEquity,100);
  assert(!JSON.stringify(user).includes(key),'credential entered facts payload');
  assert.equal(result.facts.grossNotional,100);assert.equal(result.facts.marginEquity,100);
  assert.equal(result.provider,name);assert.equal(result.model,'synthetic-explicit-model');
  assert.match(result.snapshotId,/^[a-f0-9]{16}$/);assert(Number.isFinite(Date.parse(result.analyzedAt)));
  assert.equal(result.market,undefined);assert.deepEqual(result.fundingScenarios,[]);assert.equal(result.overallScore,undefined);
  const cached=await service.analyzePortfolioHealth([position],accounts,name);
  assert.equal(requests.length,1);assert.equal(cached.snapshotId,result.snapshotId);
 }
});

test('changing credentials or base URL with the same model invalidates the previous narrative cache',async()=>{
 const service=new AIService();let provider=configure(service),requests=intercept(provider,()=>({...narrative(),summary:'first synthetic endpoint'}));
 const first=await service.analyzePortfolioHealth([position],accounts,'deepseek');assert.equal(requests.length,1);
 for(const patch of [{apiKey:'SYNTHETIC_REPLACEMENT_KEY'},{baseURL:'https://second.example.invalid/v1'}]){
  provider=configure(service,'deepseek',patch);
  requests=intercept(provider,()=>({...narrative(),summary:'fresh configured endpoint'}));
  const fresh=await service.analyzePortfolioHealth([position],accounts,'deepseek');
  assert.equal(requests.length,1,'old cache crossed configuration boundary');
  assert.equal(fresh.summary,'fresh configured endpoint');assert.equal(fresh.snapshotId,first.snapshotId,'configuration refresh need not change facts identity');
  assert.equal(requests[0].baseURL,patch.baseURL||'https://analysis.example.invalid/v1');
  assert.equal(requests[0].authorization,`Bearer ${patch.apiKey||key}`);
 }
 configure(service,'deepseek',{},false);assert.equal(service.isAvailable(),false);
 await assert.rejects(service.analyzePortfolioHealth([position],accounts,'deepseek'),/未就绪/);
 provider=configure(service);requests=intercept(provider,narrative);
 assert.equal((await service.analyzePortfolioHealth([position],accounts,'deepseek')).summary,narrative().summary);
 assert.equal(requests.length,1,'reenabling must not revive an earlier cached narrative');
});

test('the five-minute cache expires at its boundary without waiting or making automatic model requests',async t=>{
 let now=1800000000000;t.mock.method(Date,'now',()=>now);
 const service=new AIService(),provider=configure(service);let revision=0;
 const requests=intercept(provider,()=>({...narrative(),summary:`synthetic revision ${++revision}`}));
 const analyze=()=>service.analyzePortfolioHealth([position],accounts,'deepseek');
 assert.equal((await analyze()).summary,'synthetic revision 1');
 now+=299999;assert.equal((await analyze()).summary,'synthetic revision 1');assert.equal(requests.length,1);
 now+=1;assert.equal(requests.length,1,'clock movement must not trigger background calls');
 assert.equal((await analyze()).summary,'synthetic revision 2');assert.equal(requests.length,2);
 assert.equal((await analyze()).summary,'synthetic revision 2');assert.equal(requests.length,2);
});
