const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HyperliquidService } = require('../dist/main/services/hyperliquid');
const { ExchangeManager } = require('../dist/main/services/exchangeManager');

function fixture(overrides = {}) {
  const data = {
    userAbstraction: 'disabled',
    clearinghouseState: {
      marginSummary: { accountValue: '100', totalMarginUsed: '30', totalNtlPos: '7000' },
      withdrawable: '42', assetPositions: [{ position: {
        coin: 'ETH', szi: '-2', unrealizedPnl: '-5', entryPx: '2000', positionValue: '4100',
        leverage: { type: 'isolated', value: 2 }, marginUsed: '25',
      } }],
    },
    spotClearinghouseState: { balances: [
      { coin: 'USDC', token: 0, total: '10.25', hold: '2.25' },
      { coin: 'PURR', token: 1, total: '3', hold: '1', entryNtl: '999' },
    ] },
    spotMetaAndAssetCtxs: [{ tokens: [{ name: 'USDC', index: 0 }, { name: 'PURR', index: 1 }],
      universe: [{ name: 'PURR/USDC', tokens: [1, 0], index: 0 }] }, [{ markPx: '2' }]],
    ...overrides,
  };
  const service = new HyperliquidService();
  service.setCredentials('0x' + '1'.repeat(40), 'ignored-private-key');
  const calls = [];
  service.client = { post: async (path, body) => {
    assert.equal(path, '/info');
    assert.ok(Object.hasOwn(data, body.type), 'request outside read-only fixture allowlist');
    assert.deepEqual(Object.keys(body).sort(), body.type === 'spotMetaAndAssetCtxs' ? ['type'] : ['type', 'user']);
    calls.push(body.type);
    if (data[body.type] instanceof Error) throw data[body.type];
    return { data: structuredClone(data[body.type]) };
  } };
  return { service, data, calls };
}

test('Hyperliquid balances preserve coin identity, free/hold and current mark valuation', async () => {
  const { service } = fixture();
  const balances = await service.getSpotBalances();
  assert.deepEqual(balances.map(({ asset, free, locked, total, usdValue }) =>
    ({ asset, free, locked, total, usdValue })), [
    { asset: 'USDC', free: '8', locked: '2.25', total: 10.25, usdValue: 10.25 },
    { asset: 'PURR', free: '2', locked: '1', total: 3, usdValue: 6 },
  ]);
  const account = await service.getFuturesAccountInfo();
  assert.equal(account.totalUnrealizedProfit, -5);
  assert.equal(account.totalWalletBalance, 105);
  assert.equal(account.maxWithdrawAmount, 42); // top-level, not marginSummary
  assert.equal(account.availableBalance, 70);
  assert.equal(account.spotTotalUSDT, 16.25);
  assert.equal(account.totalAssets, 116.25);
});

test('Hyperliquid zero and negative spot quantities do not fabricate positive assets', async () => {
  const { service, data } = fixture();
  data.spotClearinghouseState.balances[1].total = '-3';
  data.spotClearinghouseState.balances[1].hold = '0';
  data.spotClearinghouseState.balances.push({ coin: 'ZERO', token: 2, total: '0', hold: '0' });
  const balances = await service.getSpotBalances();
  assert.equal(balances.length, 2);
  assert.equal(balances[1].free, '-3');
  assert.equal(balances[1].usdValue, -6);
  assert.equal((await service.getFuturesAccountInfo()).totalAssets, 104.25);
  data.spotClearinghouseState.balances = [];
  assert.equal((await service.getFuturesAccountInfo()).spotTotalUSDT, 0);
});

test('missing balance, mark price, token identity or failed spot read never becomes a zero estimate', async () => {
  const mutations = [
    d => { d.spotClearinghouseState = {}; },
    d => { d.spotClearinghouseState.balances[0].hold = '11'; },
    d => { d.spotClearinghouseState.balances[0].total = '10junk'; },
    d => { d.spotClearinghouseState.balances[1].coin = 'UNKNOWN'; },
    d => { d.spotClearinghouseState.balances[1].token = 0; },
    d => { d.spotMetaAndAssetCtxs[1][0].markPx = null; },
    d => { d.spotMetaAndAssetCtxs[1][0].markPx = '0'; },
    d => { d.spotMetaAndAssetCtxs[0].universe[0].tokens = [1, 99]; },
    d => { d.spotMetaAndAssetCtxs[1] = []; },
    d => { d.spotClearinghouseState = new Error('private response'); },
    d => { d.spotMetaAndAssetCtxs = new Error('private response'); },
    d => { delete d.clearinghouseState.withdrawable; },
    d => { d.clearinghouseState.marginSummary.accountValue = 'Infinity'; },
    d => { d.clearinghouseState.marginSummary.totalMarginUsed = '-2'; },
  ];
  for (const mutate of mutations) {
    const { service, data } = fixture(); mutate(data);
    await assert.rejects(service.getFuturesAccountInfo(), error =>
      /^Hyperliquid /.test(error.message) && !error.message.includes('private response'));
  }
});

test('unsupported, ambiguous, unknown or unavailable modes fail closed before balance/position reads', async () => {
  for (const mode of ['unifiedAccount', 'portfolioMargin', 'dexAbstraction', 'default', 'futureMode', null, new Error('private')]) {
    const { service, calls } = fixture({ userAbstraction: mode });
    for (const operation of ['getFuturesAccountInfo', 'getFuturesPositions', 'getSpotBalances', 'getAccountBalance']) {
      await assert.rejects(service[operation](), /^Error: Hyperliquid /);
    }
    assert.deepEqual(calls, Array(4).fill('userAbstraction'));
  }
});

test('account mode is checked on every refresh and mode failures expose a useful recovery message', async () => {
  const { service, data } = fixture();
  const manager = new ExchangeManager();
  manager.exchanges = new Map([['hyperliquid', service]]);
  assert.equal((await manager.getAllAccountInfo()).length, 1);
  data.userAbstraction = 'unifiedAccount';
  assert.equal((await manager.getAllAccountInfo()).length, 0);
  assert.match(manager.getAllErrors()[0].suggestion, /不会更改账户模式/);
  data.userAbstraction = 'disabled';
  assert.equal((await manager.getAllAccountInfo()).length, 1);
  assert.equal(manager.hasAnyErrors(), false);
});

test('negative equity never yields negative available margin, and position mapping preserves isolated/short semantics', async () => {
  const { service, data } = fixture();
  data.clearinghouseState.marginSummary.accountValue = '-5';
  assert.equal((await service.getFuturesAccountInfo()).availableBalance, 0);
  const [position] = await service.getFuturesPositions();
  assert.equal(position.marginType, 'isolated');
  assert.equal(position.isolatedMargin, null);
  assert.equal(position.usedMargin, '25');
  assert.equal(position.maintenanceMargin, null);
  assert.equal(position.positionAmt, '-2');
  assert.equal(position.markPrice, '2050');
  assert.equal(position.leverage, '2');
  data.clearinghouseState.assetPositions = null;
  await assert.rejects(service.getFuturesPositions(), /数据不完整/);
});

test('transport errors never propagate wallet addresses or private response text to logs or UI', async () => {
  const { service } = fixture({ userAbstraction: new Error('wallet=0xPRIVATE response=secret') });
  const logger = require('../dist/main/utils/logger').logger;
  const previous = logger.error;
  const messages = [];
  try {
    logger.error = (...args) => messages.push(args.join(' '));
    await assert.rejects(service.getFuturesAccountInfo(), { message: 'Hyperliquid 读取失败，请检查网络后重试' });
    assert.ok(!messages.join('\n').includes('PRIVATE'));
    assert.ok(!messages.join('\n').includes('secret'));
  } finally { logger.error = previous; }
});
