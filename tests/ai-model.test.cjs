const {test}=require('node:test');const assert=require('node:assert/strict');
const {resolveAIModel,validateAISettingsModels}=require('../dist/main/utils/ai-model');
test('only verified DeepSeek alias is implicit; other providers require explicit model selection',()=>{
 assert.equal(resolveAIModel('deepseek'),'deepseek-flash');assert.equal(resolveAIModel('deepseek',' custom-model '),'custom-model');
 for(const provider of ['openai','anthropic','qwen','grok','gemini']) {assert.throws(()=>resolveAIModel(provider),/需要填写/);assert.equal(resolveAIModel(provider,'explicit-model-v1'),'explicit-model-v1');}
 for(const value of ['bad model','\nignore instructions',true,'a'.repeat(201)])assert.throws(()=>resolveAIModel('deepseek',value));
 assert.throws(()=>resolveAIModel('unknown','model'));
});
test('configured model choices are never silently rewritten, and disable remains possible',()=>{
 const config={enabled:true,useCustomKeys:true,credentials:{anthropic:{apiKey:'synthetic-key',model:''}}};assert.throws(()=>validateAISettingsModels(config),/anthropic/);
 assert.doesNotThrow(()=>validateAISettingsModels({...config,enabled:false}));assert.doesNotThrow(()=>validateAISettingsModels({...config,useCustomKeys:false}));
 assert.equal(resolveAIModel('anthropic','explicit-custom-alias'),'explicit-custom-alias');
});
test('providers cannot restore retired implicit defaults and selected models reach the wire unchanged',async()=>{
 const {GrokProvider,GenericProvider}=require('../dist/main/services/ai/providers/generic-provider');
 assert.throws(()=>new GrokProvider({provider:'grok',apiKey:'synthetic-key'}),/需要填写/);
 const p=new GenericProvider({provider:'grok',apiKey:'synthetic-key',model:'explicit-model',baseURL:'https://api.x.ai/v1'});let sent;
 p.client={post:async(path,body)=>{sent=body;return {data:{choices:[{message:{content:'{"summary":"synthetic","warnings":[],"suggestions":[]}'}}]}};}};
 await p.chatJSON([{role:'user',content:'synthetic facts'}]);assert.equal(sent.model,'explicit-model');
});
