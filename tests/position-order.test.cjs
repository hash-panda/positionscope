const { test } = require('node:test');
const assert = require('node:assert/strict');
const { orderPositions, positionKey } = require('../dist/main/utils/position-order.js');
const positions = [
  { exchange: 'binance', symbol: 'BTCUSDT', positionAmt: '1' },
  { exchange: 'okx', symbol: 'BTCUSDT', positionAmt: '2' },
  { exchange: 'binance', symbol: 'BTCUSDT', positionAmt: '-1' },
  { exchange: 'bybit', symbol: 'ETHUSDT', positionAmt: '1' },
];
test('reordering preserves equal symbols across exchanges and hedge sides', () => {
  const order = [positionKey(positions[2]), positionKey(positions[1]), positionKey(positions[0])];
  assert.deepEqual(orderPositions(positions, order), [
    positions[2],
    positions[1],
    positions[0],
    positions[3],
  ]);
  assert.equal(new Set(positions.map(positionKey)).size, positions.length);
});
test('native position IDs distinguish same-symbol same-side margin positions', () => {
 const a={...positions[0],positionId:'a',instrumentId:'BTCUSDT'},b={...a,positionId:'b'};
 assert.notEqual(positionKey(a),positionKey(b));assert.deepEqual(orderPositions([a,b],[positionKey(b)]),[b,a]);
});
test('closed positions and duplicate saved IDs never drop new positions', () => {
  const key = positionKey(positions[1]);
  assert.deepEqual(orderPositions(positions, ['missing', key, key]), [
    positions[1],
    positions[0],
    positions[2],
    positions[3],
  ]);
  assert.deepEqual(orderPositions([], ['missing']), []);
});
