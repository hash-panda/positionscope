const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HyperliquidService } = require('../dist/main/services/hyperliquid');
const { ExchangeManager } = require('../dist/main/services/exchangeManager');

// Synthetic payloads only; replace the HTTP client before any service call.
function serviceFor(assetPositions) {
  const service = new HyperliquidService();
  const calls = [];
  service.client = { post: async (path, body) => {
    calls.push({ path, type: body.type });
    if (body.type === 'userAbstraction') return { data: 'disabled' };
    if (body.type === 'spotClearinghouseState') return { data: { balances: [] } };
    assert.equal(body.type, 'clearinghouseState');
    return { data: {
      marginSummary: { accountValue: '1000', totalMarginUsed: '100', totalNtlPos: '90000' }, withdrawable: '400',
      assetPositions,
    } };
  } };
  return { service, calls };
}
const position = (pnl, size = '1') => ({ position: { unrealizedPnl: pnl, szi: size } });

test('Hyperliquid account sums signed position PnL from the same snapshot, never notional', async () => {
  for (const [positions, expected] of [
    [[position('12.50'), position('-20.75', '-2')], -8.25],
    [[position('100.125'), position('-0.125')], 100],
    [[], 0],
    [[position('0')], 0],
  ]) {
    const { service, calls } = serviceFor(positions);
    const account = await service.getFuturesAccountInfo();
    assert.equal(account.totalUnrealizedProfit, expected);
    assert.equal(account.totalMarginBalance, 1000);
    assert.deepEqual(calls.map(c => c.type).sort(), ['clearinghouseState', 'spotClearinghouseState', 'userAbstraction']);
    assert.ok(calls.every(c => c.path === '/info'));
  }
});

test('Hyperliquid incomplete or invalid PnL rejects without exposing payloads', async () => {
  const invalid = [undefined, null, {}, [null], [{}], [position(undefined)],
    ...['', ' ', 'NaN', 'Infinity', '12junk', '0x10', '1e309', '9'.repeat(400)].map(v => [position(v)]),
    [position(null)], [position(false)], [position(3)],
    [position('9'.repeat(308)), position('9'.repeat(308))]];
  for (const payload of invalid) {
    const { service } = serviceFor(payload);
    await assert.rejects(service.getFuturesAccountInfo(), {
      message: 'Hyperliquid 未实现盈亏数据不完整，请重试',
    });
  }
});

test('invalid account PnL is visible through ExchangeManager; next valid snapshot recovers', async () => {
  const { service } = serviceFor([position('invalid')]);
  service.hasCredentials = () => true;
  const manager = new ExchangeManager();
  manager.exchanges = new Map([['hyperliquid', service]]);
  assert.equal((await manager.getAllAccountInfo()).length, 0);
  assert.equal(manager.hasAnyErrors(), true);
  service.client = serviceFor([position('-7.5')]).service.client;
  assert.equal((await manager.getAllAccountInfo())[0].totalUnrealizedProfit, -7.5);
  assert.equal(manager.hasAnyErrors(), false);
});

test('Hyperliquid account HTTP failures remain failures', async () => {
  const { service } = serviceFor([]);
  service.client.post = async () => { throw new Error('synthetic timeout'); };
  await assert.rejects(service.getFuturesAccountInfo(), /Hyperliquid 读取失败/);
});
