const {test}=require('node:test');const assert=require('node:assert/strict');
const axios=require('axios');const {Readable}=require('node:stream');
const {AnthropicProvider}=require('../dist/main/services/ai/providers/anthropic-provider');
const messages=()=>[{role:'system',content:'synthetic instructions'},{role:'user',content:'synthetic facts'}];
function provider(extra={}){return new AnthropicProvider({provider:'anthropic',apiKey:'synthetic-key',model:'explicit-synthetic-model',...extra});}
function mockChat(p){const requests=[];p.client.defaults.adapter=async config=>{
 const body=JSON.parse(config.data);requests.push({body,version:config.headers['anthropic-version']});
 return {status:200,headers:{},config,data:{content:[{type:'text',text:'{"summary":"synthetic","warnings":[],"suggestions":[]}'}]}};
};return requests;}
test('normal application config omits sampling fields in Anthropic chat and JSON requests',async()=>{
 const {AIService}=require('../dist/main/services/ai/ai-service');const service=new AIService();
 service.setConfig({enabled:true,useCustomKeys:true,defaultProvider:'anthropic',credentials:{anthropic:{apiKey:'synthetic-key',model:'explicit-synthetic-model'}}});
 const p=service.providers.get('anthropic'),requests=mockChat(p);
 await p.chat(messages());await p.chatJSON(messages());
 assert.equal(requests.length,2);
 for(const {body,version} of requests){
  for(const key of ['temperature','top_p','top_k'])assert.equal(Object.hasOwn(body,key),false,key);
  assert.equal(body.model,'explicit-synthetic-model');assert.equal(body.max_tokens,2000);assert.equal(version,'2023-06-01');
 }
});
test('explicit sampling overrides retain zero and per-call precedence without changing token budgets',async()=>{
 const p=provider({temperature:.2,maxTokens:1200}),requests=mockChat(p);
 await p.chat(messages());await p.chat(messages(),{temperature:0,maxTokens:600});await p.chat(messages(),{temperature:.4});
 assert.deepEqual(requests.map(r=>r.body.temperature),[.2,0,.4]);
 assert.deepEqual(requests.map(r=>r.body.max_tokens),[1200,600,1200]);
});
test('Anthropic SSE omits implicit sampling and preserves explicit config, model, API version and text deltas',async()=>{
 const previous=axios.defaults.adapter;const requests=[];
 try{
  axios.defaults.adapter=async config=>{
   requests.push({body:JSON.parse(config.data),version:config.headers['anthropic-version']});
   return {status:200,headers:{},config,data:Readable.from(['data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"synthetic"}}\n\ndata: [DONE]\n'])};
  };
  for(const extra of [{},{temperature:0,maxTokens:600}]){
   const chunks=[];await provider(extra).chatStream(messages(),c=>chunks.push(c));assert.deepEqual(chunks,['synthetic']);
  }
  assert.equal(Object.hasOwn(requests[0].body,'temperature'),false);
  assert.equal(requests[1].body.temperature,0);assert.equal(requests[1].body.max_tokens,600);
  for(const {body,version} of requests){assert.equal(body.stream,true);assert.equal(body.model,'explicit-synthetic-model');assert.equal(version,'2023-06-01');}
 }finally{axios.defaults.adapter=previous;}
});
