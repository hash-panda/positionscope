const test = require('node:test');
const assert = require('node:assert/strict');
test('signed builder uses the unprefixed selector required by electron-builder 24', () => {
  const previous = process.env.APPLE_SIGNING_IDENTITY;
  try {
    process.env.APPLE_SIGNING_IDENTITY = 'Developer ID Application: Synthetic Test (TEST123456)';
    const config = require('../build/electron-signed.cjs');
    assert.equal(config.mac.identity, 'Synthetic Test (TEST123456)');
    assert.equal(config.forceCodeSigning, true);
    assert.equal(config.mac.hardenedRuntime, true);
    assert.equal(require('../package.json').build.mac.identity, null);
  } finally {
    if (previous === undefined) delete process.env.APPLE_SIGNING_IDENTITY;
    else process.env.APPLE_SIGNING_IDENTITY = previous;
  }
});
