// Fixed public synthetic inputs only: no config, credentials or network clients.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const catalog = require('../tests/fixtures/model-eval-cases.json');
const {buildRiskFacts} = require('../dist/main/services/ai/risk-facts');

function verifyCase(entry) {
  assert.equal(entry.synthetic, true);
  assert.match(entry.id, /^[a-z0-9-]+$/);
  assert(entry.reviewCriteria.length > 0);
  if (entry.expectedError) {
    assert.throws(() => buildRiskFacts(entry.positions, entry.accounts), {message:entry.expectedError});
    return {id:entry.id, title:entry.title, inputStatus:'blocked-input', facts:null,
      reason:entry.expectedError, reviewCriteria:entry.reviewCriteria};
  }
  const facts = buildRiskFacts(entry.positions, entry.accounts);
  for (const [key, expected] of Object.entries(entry.expected)) {
    const actual = key.split('.').reduce((v,part) => v?.[part], facts);
    if (typeof expected === 'number') {
      assert.equal(typeof actual, 'number', key);
      assert(Math.abs(actual - expected) <= 1e-10 * Math.max(1,Math.abs(expected)), key);
    } else assert.equal(actual, expected, key);
  }
  return {id:entry.id, title:entry.title, inputStatus:'ready', facts, reviewCriteria:entry.reviewCriteria};
}
function buildEvaluationPack() {
  assert.equal(new Set(catalog.cases.map(c=>c.id)).size, catalog.cases.length);
  return {
    version:catalog.version, synthetic:true,
    fixtureSha256:createHash('sha256').update(JSON.stringify(catalog)).digest('hex'),
    status:'not-run', provider:null, model:null, latencyMs:null, tokens:null, cost:null,
    semanticReview:'unverified',
    notice:'只导出合成事实与人工评审标准；不是生产请求或模型调用，不证明模型语义正确。',
    cases:catalog.cases.map(verifyCase),
  };
}
if (require.main === module) process.stdout.write(JSON.stringify(buildEvaluationPack(),null,2)+'\n');
module.exports = {buildEvaluationPack, verifyCase};
