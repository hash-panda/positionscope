const {test}=require('node:test');
const assert=require('node:assert/strict');
const axios=require('axios');
const {requestDiagnostic,aiRequestError}=require('../dist/main/utils/request-diagnostics');
const {createHttpClient,streamSSE}=require('../dist/main/utils/http-client');
const marker='SYNTHETIC_PRIVATE_492753';
const messages=()=>[{role:'user',content:marker}];
function rejected(config,status=429){
 return new axios.AxiosError(marker,'ERR_BAD_RESPONSE',config,{private:marker},{status,data:{error:{message:marker}},headers:{secret:marker},config});
}
async function capture(fn){
 const logs=[],saved={};
 for(const key of ['log','error','warn','info','debug']){saved[key]=console[key];console[key]=(...args)=>logs.push(args);}
 try{await fn(logs);}finally{Object.assign(console,saved);}
 assert(!JSON.stringify(logs).includes(marker),'private marker entered logs');
}
async function safeFailure(fn,category,status){
 await assert.rejects(fn,error=>{
  assert(!JSON.stringify(error).includes(marker));assert(!String(error).includes(marker));assert(!error.stack.includes(marker));
  assert.equal(error.cause,undefined);assert.equal(error.config,undefined);assert.equal(error.response,undefined);
  assert.deepEqual(requestDiagnostic(error),{category,...(status?{status}:{})});return true;
 });
}
test('diagnostics only retain bounded status/category and discard arbitrary error text/config/codes',()=>{
 for(const status of [401,403,429,503])assert.deepEqual(requestDiagnostic(rejected({},status)),{category:'http',status});
 for(const status of [NaN,Infinity,99,600,401.1,marker])assert.deepEqual(requestDiagnostic({response:{status},message:marker,code:marker}),{category:'unknown'});
 for(const [code,category] of [['ETIMEDOUT','timeout'],['ECONNABORTED','timeout'],['ERR_NETWORK','network'],['ECONNREFUSED','network'],['ERR_CANCELED','cancelled']]){
  const error=aiRequestError({code,message:marker});assert.deepEqual(requestDiagnostic(error),{category});assert(!error.message.includes(marker));
 }
 assert.deepEqual(requestDiagnostic(new SyntaxError(marker)),{category:'invalid-response'});
 assert.deepEqual(requestDiagnostic(null),{category:'unknown'});
});
test('HTTP and SSE error boundaries discard echoed input, authorization and private URL components',async()=>capture(async logs=>{
 const client=createHttpClient({baseURL:`https://${marker}:${marker}@example.invalid/${marker}`,headers:{Authorization:`Bearer ${marker}`},adapter:async config=>{throw rejected(config);}});
 await safeFailure(()=>client.post(`/${marker}?key=${marker}`,{prompt:marker}),'http',429);
 assert(logs.some(args=>args.some(a=>a?.status===429)),'safe HTTP diagnostic absent');
 const previous=axios.defaults.adapter;
 try{
  axios.defaults.adapter=async config=>{throw rejected(config,503);};
  await safeFailure(async()=>{for await(const _ of streamSSE(`https://example.invalid/${marker}`,{headers:{Authorization:marker},data:{prompt:marker}})){}},'http',503);
 }finally{axios.defaults.adapter=previous;}
}));
test('all six provider paths reject echoed transport errors and invalid JSON without exposing content',async()=>capture(async()=>{
 const {OpenAIProvider}=require('../dist/main/services/ai/providers/openai-provider');
 const {AnthropicProvider}=require('../dist/main/services/ai/providers/anthropic-provider');
 const {DeepSeekProvider}=require('../dist/main/services/ai/providers/deepseek-provider');
 const {QwenProvider,GrokProvider,GeminiProvider}=require('../dist/main/services/ai/providers/generic-provider');
 for(const [Class,provider] of [[OpenAIProvider,'openai'],[AnthropicProvider,'anthropic'],[DeepSeekProvider,'deepseek'],[QwenProvider,'qwen'],[GrokProvider,'grok'],[GeminiProvider,'gemini']]){
  const p=new Class({provider,apiKey:marker,model:'explicit-synthetic-model',baseURL:`https://example.invalid/${marker}`});
  p.client.defaults.adapter=async config=>{throw rejected(config,401);};
  await safeFailure(()=>p.chat(messages()),'http',401);
  await safeFailure(()=>p.chatJSON(messages()),'http',401);
  p.client.defaults.adapter=async config=>({status:200,headers:{},config,data:provider==='anthropic'?{content:[{text:marker}]}:{choices:[{message:{content:marker}}]}});
  await safeFailure(()=>p.chatJSON(messages()),'invalid-response');
 }
 const previous=axios.defaults.adapter;
 try{
  axios.defaults.adapter=async config=>{throw rejected(config,429);};
  for(const [Class,provider] of [[OpenAIProvider,'openai'],[AnthropicProvider,'anthropic']]){
   const p=new Class({provider,apiKey:marker,model:'synthetic-model'});
   await safeFailure(()=>p.chatStream(messages(),()=>{}),'http',429);
  }
 }finally{axios.defaults.adapter=previous;}
}));
test('chat prompt prefixes and validation errors are absent from service/base-provider logs',async()=>capture(async()=>{
 const {AIService}=require('../dist/main/services/ai/ai-service');
 const {OpenAIProvider}=require('../dist/main/services/ai/providers/openai-provider');
 const service=new AIService();service.providers.set('deepseek',{chat:async()=> 'synthetic response'});
 assert.equal(await service.chat(marker,undefined,'deepseek'),'synthetic response');
 const p=new OpenAIProvider({provider:'openai',apiKey:marker,model:'synthetic-model'});
 p.chat=async()=>{throw rejected({headers:{Authorization:marker}},403);};
 assert.equal(await p.validateApiKey(),false);
}));
