const {test}=require('node:test');const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');const path=require('node:path');
const {buildEvaluationPack,verifyCase}=require('../scripts/export-synthetic-eval.cjs');
const catalog=require('./fixtures/model-eval-cases.json');
test('six fixed synthetic cases reproduce their independently specified facts or block incomplete input',()=>{
 const pack=buildEvaluationPack();assert.equal(pack.cases.length,6);
 assert.equal(pack.cases.filter(c=>c.inputStatus==='ready').length,5);
 assert.equal(pack.cases.find(c=>c.id==='missing-account-source').facts,null);
 for(const c of pack.cases)assert(c.reviewCriteria.length>0);
});
test('a changed golden expectation or invalid input cannot silently export a passing baseline',()=>{
 const altered=structuredClone(catalog.cases[0]);altered.expected.grossNotional=999;
 assert.throws(()=>verifyCase(altered),/grossNotional/);
 const bad=structuredClone(catalog.cases[1]);bad.positions[0].markPrice='NaN';assert.throws(()=>verifyCase(bad));
 const incomplete=structuredClone(catalog.cases[5]);incomplete.accounts.push({exchange:'okx',totalMarginBalance:100});
 assert.throws(()=>verifyCase(incomplete),'blocked case unexpectedly became analyzable');
});
test('CLI exports deterministic facts without claiming model quality, calls or cost measurements',()=>{
 const script=path.resolve(__dirname,'../scripts/export-synthetic-eval.cjs');
 const a=execFileSync(process.execPath,[script],{encoding:'utf8'});
 const b=execFileSync(process.execPath,[script],{encoding:'utf8'});assert.equal(a,b);
 const pack=JSON.parse(a);assert.equal(pack.status,'not-run');assert.equal(pack.semanticReview,'unverified');
 for(const key of ['provider','model','latencyMs','tokens','cost'])assert.equal(pack[key],null);
 assert.match(pack.fixtureSha256,/^[a-f0-9]{64}$/);
 assert.equal(pack.synthetic,true);
});
