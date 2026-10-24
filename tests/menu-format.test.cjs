const { test } = require('node:test');
const assert = require('node:assert/strict');
const { menuValues } = require('../dist/main/utils/menu-format.js');
test('menu preview and native display share rounding and direction-aware price percentages', () => {
  const position = {
    symbol: 'FOLKSUSDT',
    markPrice: '2.4180',
    entryPrice: '1.2825',
    unRealizedProfit: '431.73',
    positionAmt: '380',
  };
  assert.deepEqual(menuValues(position), {
    symbol: 'FOLKS',
    price: '2.42',
    pnlText: '+432',
    percentText: '+88.5%',
  });
  assert.equal(
    menuValues({ ...position, positionAmt: '-380', unRealizedProfit: '-431.73' }).percentText,
    '-88.5%'
  );
  assert.equal(menuValues({ ...position, entryPrice: '0' }).percentText, '--');
});
