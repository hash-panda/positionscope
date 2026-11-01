const {test}=require('node:test');
const assert=require('node:assert/strict');
const {AIService}=require('../dist/main/services/ai/ai-service');
const marker='SYNTHETIC_PRIVATE_JSON_615790';
const position={exchange:'binance',symbol:'BTCUSDT',positionAmt:'1',entryPrice:'90',markPrice:'100',unRealizedProfit:'10',marginType:'cross',leverage:'5'};
const accounts=[{exchange:'binance',totalMarginBalance:100}];
const valid={summary:'合成事实：总名义价值100；非收益预测。',warnings:[],suggestions:[]};

async function recover(content,finishReason,expectedError){
 const logs=[],saved={};
 for(const key of ['log','error','warn','info','debug']){saved[key]=console[key];console[key]=(...args)=>logs.push(args);}
 try{
  const service=new AIService();
  service.setConfig({enabled:true,defaultProvider:'deepseek',useCustomKeys:true,credentials:{deepseek:{provider:'deepseek',apiKey:marker,model:'synthetic-explicit-model'}}});
  const provider=service.providers.get('deepseek');let calls=0,reply=content,finish=finishReason;
  provider.client.defaults.adapter=async config=>{
   calls++;
   const body=JSON.parse(config.data);
   assert.deepEqual(body.response_format,{type:'json_object'});
   assert.equal(body.model,'synthetic-explicit-model');
   const input=JSON.parse(body.messages.find(m=>m.role==='user').content);
   assert.equal(input.facts.grossNotional,100);
   return {status:200,headers:{},config,data:{choices:[{message:{content:reply},finish_reason:finish}]}};
  };
  const analyze=()=>service.analyzePortfolioHealth([position],accounts,'deepseek');
  await assert.rejects(analyze(),error=>{
   assert.match(error.message,expectedError);
   assert(!String(error).includes(marker));assert(!error.stack.includes(marker));return true;
  });
  assert.equal(calls,1,'no automatic paid retry');
  reply=JSON.stringify(valid);finish='stop';
  const result=await analyze();
  assert.equal(calls,2,'failed result must not poison snapshot cache');
  assert.equal(result.summary,valid.summary);assert.equal(result.facts.grossNotional,100);
  assert.equal(result.model,'synthetic-explicit-model');assert.equal(result.provider,'deepseek');
  reply=marker; // A cached success must avoid this invalid response entirely.
  const cached=await analyze();
  assert.equal(calls,2);assert.equal(cached.snapshotId,result.snapshotId);assert.equal(cached.summary,valid.summary);
 }finally{Object.assign(console,saved);}
 assert(!JSON.stringify(logs).includes(marker),'key or echoed JSON entered diagnostics');
}
test('DeepSeek whitespace-only JSON content with finish_reason stop fails and permits same-snapshot recovery',()=>recover('   \n\t   ','stop',/响应格式无效/));
test('empty or null content cannot become a successful empty-object portfolio analysis',async()=>{
 for(const content of ['',null])await recover(content,'stop',/分析摘要无效/);
});
test('truncated JSON is rejected without echoing content and without caching failure',()=>recover('{"summary":"'+marker,'length',/响应格式无效/));
test('valid JSON with invalid narrative schema cannot enter the successful-analysis cache',()=>recover(JSON.stringify({summary:marker,warnings:'invalid',suggestions:[]}),'stop',/分析列表格式无效/));
