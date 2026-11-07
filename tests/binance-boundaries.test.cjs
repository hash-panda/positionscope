const {test} = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const {BinanceService} = require('../dist/main/services/binance');
const {ExchangeManager} = require('../dist/main/services/exchangeManager');
const {normalizeBinancePosition} = require('../dist/main/services/position-normalize');
const {buildRiskFacts} = require('../dist/main/services/ai/risk-facts');
const {PublicMarketService} = require('../dist/main/services/public-market');
const {AIService} = require('../dist/main/services/ai/ai-service');
const {exchangeFailure} = require('../dist/main/utils/exchange-diagnostics');
const {BinanceDataError} = require('../dist/main/utils/binance-diagnostics');
const {binanceUsdtBaseAsset, binanceResearchSymbol} = require('../dist/main/utils/binance-symbol');

// Officially listed identifier, entirely synthetic balances, prices and keys.
const symbol = '币安人生USDT';
const raw = {
  symbol, marginAsset: 'USDT', positionSide: 'BOTH', positionAmt: '2',
  entryPrice: '90', markPrice: '100', unRealizedProfit: '20',
  liquidationPrice: '50', positionInitialMargin: '40', maintMargin: '2', isolatedWallet: '0',
};
const config = {symbol, marginType: 'CROSSED', leverage: 5};
const marker = 'SYNTHETIC_BINANCE_PRIVATE_57261';
const HOUR = 3_600_000;

async function privateFixture(action) {
  const logs = [], originals = {};
  for (const key of ['log', 'error', 'warn', 'info', 'debug']) {
    originals[key] = console[key]; console[key] = (...args) => logs.push(args);
  }
  try { await action(); } finally { Object.assign(console, originals); }
  assert(!JSON.stringify(logs).includes(marker), 'synthetic private payload reached logs');
}

function serviceFixture(overrides = {}) {
  const service = new BinanceService(), calls = [];
  service.setCredentials({exchange: 'binance', apiKey: marker, apiSecret: marker});
  const defaults = {
    '/fapi/v3/positionRisk': [raw], '/fapi/v1/symbolConfig': [config],
    '/fapi/v1/accountConfig': {multiAssetsMargin: false},
    '/fapi/v3/account': {totalWalletBalance: '80', totalMarginBalance: '100', totalUnrealizedProfit: '20'},
    '/api/v3/account': {balances: []},
  };
  const adapter = async request => {
    calls.push(request.url); assert.equal(request.method, 'get');
    assert.equal(request.headers['X-MBX-APIKEY'], marker);
    assert(request.url in defaults, 'request outside fixture allowlist');
    const data = request.url in overrides ? overrides[request.url] : defaults[request.url];
    if (data instanceof Error) throw data;
    return {status: 200, data, config: request, headers: {}};
  };
  service.futuresClient.defaults.adapter = adapter;
  service.spotClient.defaults.adapter = adapter;
  return {service, calls};
}

function marketFixture() {
  const service = new PublicMarketService(), calls = [], now = Date.now();
  const symbols = ['BTCUSDT', 'ETHUSDT', symbol];
  service.client.defaults.adapter = async request => {
    assert.equal(request.method, 'get'); assert.equal(request.headers['X-MBX-APIKEY'], undefined);
    const requested = request.params.symbol; calls.push({path: request.url, symbol: requested});
    if (requested) assert.equal(new URL(service.client.getUri(request)).searchParams.get('symbol'), requested, 'UTF-8 query changed identifier');
    let data;
    if (request.url.endsWith('exchangeInfo')) data = {symbols: symbols.map(s => ({symbol: s, baseAsset: binanceUsdtBaseAsset(s), status: 'TRADING', contractType: 'PERPETUAL', quoteAsset: 'USDT', marginAsset: 'USDT', onboardDate: now - HOUR})).concat([
      {symbol: '错误USDT', baseAsset: '不匹配', status: 'TRADING', contractType: 'PERPETUAL', quoteAsset: 'USDT', marginAsset: 'USDT'},
      {symbol: '控制\nUSDT', baseAsset: '控制\n', status: 'TRADING', contractType: 'PERPETUAL', quoteAsset: 'USDT', marginAsset: 'USDT'},
    ])};
    else if (request.url.endsWith('ticker/24hr')) data = symbols.map(s => ({symbol: s, closeTime: now, lastPrice: '100', quoteVolume: '1000', priceChangePercent: '1'}));
    else if (request.url.endsWith('fundingInfo')) data = [];
    else if (request.url.endsWith('premiumIndex')) data = {symbol: requested, markPrice: '100', lastFundingRate: '.001', nextFundingTime: now + HOUR, time: now};
    else if (request.url.endsWith('fundingRate')) data = [9, 5, 1].map(h => ({symbol: requested, fundingTime: now - h * HOUR, fundingRate: '.001'}));
    else if (request.url.endsWith('openInterest')) data = {symbol: requested, openInterest: '30', time: now};
    else if (request.url.endsWith('klines')) {
      const end = Math.floor(now / HOUR) * HOUR;
      data = Array.from({length: 30}, (_, i) => [end - (30 - i) * HOUR, '0', '0', '0', '100', '0', end - (29 - i) * HOUR - 1]);
    } else throw new Error('request outside public GET fixture allowlist');
    return {status: 200, data, config: request, headers: {}};
  };
  return {service, calls};
}

test('Binance Han symbols survive the adapter, aggregate facts, public context and synthetic AI explanation unchanged', async () => privateFixture(async () => {
  const {service} = serviceFixture();
  const manager = new ExchangeManager(); manager.exchanges = new Map([['binance', service]]);
  const [positions, accounts] = await Promise.all([manager.getAllFuturesPositions(), manager.getAllAccountInfo()]);
  assert.equal(manager.hasAnyErrors(), false); assert.equal(positions.length, 1); assert.equal(accounts.length, 1);
  assert.equal(positions[0].symbol, symbol); assert.equal(positions[0].baseAsset, '币安人生');
  const facts = buildRiskFacts(positions, accounts);
  assert.equal(facts.largestAsset, '币安人生'); assert.equal(facts.grossNotional, 200); assert.equal(facts.positions[0].liquidationDistance, .5);
  const market = marketFixture();
  const snapshot = await market.service.snapshot(positions.map(binanceResearchSymbol));
  assert.equal(snapshot.status, 'available'); assert.equal(snapshot.breadth.eligibleContracts, 3);
  assert(snapshot.active.some(r => r.symbol === symbol)); assert(snapshot.assets.some(r => r.symbol === symbol));
  assert.equal(market.calls.filter(c => c.symbol === symbol).length, 4);
  let payload;
  const ai = new AIService(); ai.providers.set('synthetic', {getProviderName: () => 'synthetic', getModelName: () => 'synthetic', chatJSON: async messages => {
    payload = JSON.parse(messages[1].content); return {summary: '合成解释', warnings: [], suggestions: []};
  }});
  const analysis = await ai.analyzePortfolioHealth(positions, accounts, 'synthetic', snapshot);
  assert.equal(analysis.facts.largestAsset, '币安人生'); assert.equal(payload.facts.positions[0].symbol, symbol);
  assert.equal(analysis.fundingScenarios[0].symbol, symbol); assert.equal(analysis.fundingScenarios[0].estimatedCashflow, -.2);
  assert(!JSON.stringify(payload).includes(marker));
}));

test('Binance symbol gates preserve identifiers, reject controls and unsupported scripts, and do not broaden other venues', async () => {
  assert.equal(binanceUsdtBaseAsset('BTCUSDT'), 'BTC');
  assert.equal(binanceUsdtBaseAsset('1000币安人生USDT'), '1000币安人生');
  assert.equal(binanceUsdtBaseAsset('币安人生USDT_261225'), '币安人生');
  assert.equal(binanceUsdtBaseAsset('币安人生USDT_261225', false), null);
  assert.equal(binanceUsdtBaseAsset('𠀀'.repeat(40) + 'USDT_261225'), '𠀀'.repeat(40));
  const invalid = ['币安人生USDT\n', '币安\u202E人生USDT', '币安\u200B人生USDT', '币安 人生USDT', '币安/人生USDT', '币安人生USDC', '币安人生USDT?key=1', '币安人生USDT_1', 'A'.repeat(41) + 'USDT', 'ВTCUSDT', '币安😀USDT', '币安\u0301USDT', null];
  const market = marketFixture();
  for (const value of invalid) {
    assert.equal(binanceUsdtBaseAsset(value), null, String(value));
    assert.equal(binanceResearchSymbol({exchange: 'binance', symbol: value, baseAsset: '币安人生'}), null);
    assert.throws(() => normalizeBinancePosition({...raw, symbol: value}, config), e => e instanceof BinanceDataError && e.code === 'BINANCE_UNSUPPORTED_INSTRUMENT');
    await assert.rejects(market.service.snapshot([value]));
  }
  assert.equal(market.calls.length, 0, 'invalid symbols must fail before any public request');
  assert.equal(binanceResearchSymbol({exchange: 'binance', symbol}), symbol);
  assert.equal(binanceResearchSymbol({exchange: 'binance', symbol, baseAsset: 'OTHER'}), null);
  assert.equal(binanceResearchSymbol({exchange: 'binance', symbol: '币安人生USDT_261225', baseAsset: '币安人生'}), symbol);
  assert.equal(binanceResearchSymbol({exchange: 'okx', symbol, baseAsset: '币安人生'}), null);
  assert.equal(binanceResearchSymbol({exchange: 'okx', symbol: 'BTC-USDT-SWAP', baseAsset: 'BTC'}), 'BTCUSDT');
  const p = normalizeBinancePosition(raw, config);
  assert.throws(() => buildRiskFacts([{...p, baseAsset: 'OTHER'}], [{exchange: 'binance', totalMarginBalance: 100}]));
  assert.throws(() => buildRiskFacts([{...p, exchange: 'bybit'}], [{exchange: 'bybit', totalMarginBalance: 100}]));
});

test('Binance malformed payloads expose trusted local categories while raw provider codes and messages stay private', async () => privateFixture(async () => {
  const cases = [
    ['/fapi/v3/positionRisk', {message: marker}, 'BINANCE_INVALID_POSITION', 'getFuturesPositions'],
    ['/fapi/v3/positionRisk', [{...raw, positionAmt: marker}], 'BINANCE_INVALID_POSITION', 'getFuturesPositions'],
    ['/fapi/v3/positionRisk', [{...raw, marginAsset: 'USDC'}], 'BINANCE_UNSUPPORTED_INSTRUMENT', 'getFuturesPositions'],
    ['/fapi/v1/symbolConfig', null, 'BINANCE_INVALID_CONFIG', 'getFuturesPositions'],
    ['/fapi/v1/symbolConfig', [{...config, leverage: marker}], 'BINANCE_INVALID_CONFIG', 'getFuturesPositions'],
    ['/fapi/v1/symbolConfig', [config, config], 'BINANCE_INVALID_CONFIG', 'getFuturesPositions'],
    ['/fapi/v1/accountConfig', {multiAssetsMargin: 'false', message: marker}, 'BINANCE_INVALID_ACCOUNT', 'getFuturesAccountInfo'],
    ['/fapi/v3/account', null, 'BINANCE_INVALID_ACCOUNT', 'getFuturesAccountInfo'],
    ['/fapi/v3/account', {totalMarginBalance: marker}, 'BINANCE_INVALID_ACCOUNT', 'getFuturesAccountInfo'],
  ];
  for (const [path, data, expected, method] of cases) {
    const {service} = serviceFixture({[path]: data});
    await assert.rejects(service[method](), error => {
      assert(error instanceof BinanceDataError);
      assert.equal(exchangeFailure(error).errorCode, expected);
      assert(!JSON.stringify(exchangeFailure(error)).includes(marker));
      assert(!String(error).includes(marker)); return true;
    });
  }
  for (const code of ['BINANCE_INVALID_POSITION', 'BINANCE_INVALID_ACCOUNT', marker]) {
    assert.equal(exchangeFailure({code, message: marker, response: {data: marker}}).errorCode, 'UNKNOWN');
  }
  const upstream = new axios.AxiosError(marker, marker, {}, {}, {status: 401, data: {message: marker}});
  const {service} = serviceFixture({'/fapi/v3/positionRisk': upstream});
  await assert.rejects(service.getFuturesPositions(), e => exchangeFailure(e).errorCode === 'HTTP_401');
}));
