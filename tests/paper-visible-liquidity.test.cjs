const test = require('node:test'), assert = require('node:assert/strict');
const { consumeVisibleLiquidity } = require('../dist/main/services/paper/visible-liquidity');
const { decimal } = require('../dist/main/services/paper/decimal');

const book = Object.freeze({
  symbol: 'BTCUSDT', updateId: '42', observedAt: 1000, fetchedAt: 1000,
  bids: Object.freeze([Object.freeze(['99', '1']), Object.freeze(['98', '1'])]),
  asks: Object.freeze([Object.freeze(['100', '1']), Object.freeze(['101', '1'])]),
  stepSize: '0.001', minQty: '0.001', maxQty: '1000', minNotional: '5',
});
const policy = Object.freeze({ feeBps: 5, slippageBps: 2 });

test('sequential synthetic orders consume each visible ask only once', () => {
  const before = JSON.stringify(book);
  const fills = consumeVisibleLiquidity(book, true, [
    { id: 'first', quantity: decimal('1.5') },
    { id: 'second', quantity: decimal('1') },
    { id: 'third', quantity: decimal('0.25') },
  ], policy);

  assert.deepEqual(fills.map(fill => ({ id: fill.id, status: fill.status, filled: fill.filledQuantity, remaining: fill.remainingQuantity })), [
    { id: 'first', status: 'filled', filled: '1.5', remaining: '0' },
    { id: 'second', status: 'partial', filled: '0.5', remaining: '0.5' },
    { id: 'third', status: 'unfilled', filled: '0', remaining: '0.25' },
  ]);
  assert.equal(fills.reduce((sum, fill) => sum + decimal(fill.filledQuantity), 0n), decimal('2'));
  assert.equal(fills[2].averagePrice, null);
  assert.equal(JSON.stringify(book), before);
});

test('sell-side consumption is deterministic and costs remain explicit', () => {
  const [fill] = consumeVisibleLiquidity(book, false, [{ id: 'sell', quantity: decimal('1.5') }], policy);
  assert.equal(fill.status, 'filled');
  assert.equal(fill.filledQuantity, '1.5');
  assert.ok(decimal(fill.notional) > 0n);
  assert.ok(decimal(fill.fee) > 0n);
  assert.ok(decimal(fill.averagePrice) < decimal('99'));
  assert.deepEqual(consumeVisibleLiquidity(book, false, [{ id: 'sell', quantity: decimal('1.5') }], policy), [fill]);
});

test('invalid quantities and cost policy fail closed', () => {
  assert.throws(() => consumeVisibleLiquidity(book, true, [{ id: 'zero', quantity: 0n }], policy));
  assert.throws(() => consumeVisibleLiquidity(book, true, [{ id: '', quantity: decimal('1') }], policy));
  assert.throws(() => consumeVisibleLiquidity(book, true, [{ id: 'duplicate', quantity: decimal('1') }, { id: 'duplicate', quantity: decimal('1') }], policy));
  assert.throws(() => consumeVisibleLiquidity(book, true, [{ id: 'off-step', quantity: decimal('1.0005') }], policy));
  assert.throws(() => consumeVisibleLiquidity(book, true, [{ id: 'fee', quantity: decimal('1') }], { feeBps: 101, slippageBps: 2 }));
});
