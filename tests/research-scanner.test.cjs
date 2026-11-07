const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BinanceResearchService } = require('../dist/main/services/research/market-scanner');
const { parseClosedHours, parseLiquidity, parseOpenInterest } = require('../dist/main/services/research/evidence');
const H = 3600000;
const NOW = 1794000000000;
function fixture(options = {}) {
  let now = NOW, active = 0, max = 0;
  const symbols = options.symbols || ['BTCUSDT', 'ETHUSDT', '币安人生USDT', ...Array.from({ length: 20 }, (_, i) => `ASSET${i}USDT`)];
  const calls = [];
  const transport = { get: async (path, config) => {
    calls.push({ path, config }); active++; max = Math.max(max, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    assert(config.timeout <= 8000); assert(!JSON.stringify(config).includes('APIKEY'));
    if (options.limited) throw { response: { status: 429, headers: { 'retry-after': '120' }, data: 'sensitive-synthetic-response' }, config: { password: 'secret-proxy' } };
    if (options.failPath === path) throw new Error('sensitive-synthetic-response');
    const symbol = config.params.symbol;
    if (path.endsWith('exchangeInfo')) return { data: { symbols: symbols.map(symbol => ({ symbol, baseAsset: symbol.slice(0, -4), quoteAsset: 'USDT', marginAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL' })).concat({ symbol: 'DELIVERYUSDT_261225', baseAsset: 'DELIVERY', quoteAsset: 'USDT', marginAsset: 'USDT', status: 'TRADING', contractType: 'CURRENT_QUARTER' }) } };
    if (path.endsWith('ticker/24hr')) {
      const rows = symbols.map((symbol, i) => ({ symbol, closeTime: options.stale ? now - 180001 : now - (options.atOffset || 0), lastPrice: '100', priceChangePercent: String(i === 0 ? 1 : 5 + i), quoteVolume: String(10000000 + i * 10000) }));
      if (options.duplicate) rows.push({ ...rows[1] });
      if (options.invalid) rows[2].quoteVolume = '';
      return { data: rows };
    }
    if (path.endsWith('premiumIndex')) { const rows = symbols.map((symbol, i) => ({ symbol, markPrice: '100', lastFundingRate: i === 1 ? '-.002' : '.0001', time: now })); if (options.badPremium) { rows.push({...rows[1]}); rows[2].lastFundingRate = 'Infinity'; } return { data: rows }; }
    if (path.endsWith('klines')) {
      const end = Math.floor(now / H) * H;
      return { data: Array.from({ length: 26 }, (_, i) => [end - (26 - i) * H, '0', '0', '0', String(90 + i), '0', end - (25 - i) * H - 1]) };
    }
    if (path.endsWith('openInterestHist')) return { data: [2, 1, 0].map((n, i) => ({ symbol, timestamp: Math.floor(now / H) * H - n * H, sumOpenInterest: String(100 + i * 10), sumOpenInterestValue: '12000' })) };
    if (path.endsWith('fundingRate')) return { data: [17, 9, 1].map(n => ({ symbol, fundingTime: now - n * H, fundingRate: '.001' })) };
    if (path.endsWith('bookTicker')) return { data: { symbol, bidPrice: '99.99', askPrice: '100.01', bidQty: '200', askQty: '200', time: now } };
    if (path.endsWith('depth')) return { data: depth(now, options.thin) };
    throw new Error('outside GET whitelist');
  } };
  const service = new BinanceResearchService({ transport, now: () => now });
  return { service, calls, symbols, getMax: () => max, advance: ms => { now += ms; } };
}
function depth(now = NOW, thin = false) { return { lastUpdateId: 55, T: now, bids: [['99.99', thin ? '.001' : '200'], ['99', '10'], ['98', '10']], asks: [['100.01', thin ? '.001' : '200'], ['101', '10'], ['102', '10']] }; }
function book(now = NOW) { return { symbol: 'BTCUSDT', bidPrice: '99.99', askPrice: '100.01', bidQty: '200', askQty: '200', time: now }; }
test('full legal Binance universe, deterministic event IDs, unique identities and 10+2 research cap', async () => {
  const f = fixture(); const s = await f.service.snapshot();
  assert.equal(s.status, 'available'); assert.equal(s.coverage.eligible, 23); assert.equal(s.breadth.priced, 23);
  assert.equal(s.coverage.selected.length, 12); assert(s.events.some(e => e.symbol === '币安人生USDT'));
  assert.equal(new Set(s.events.map(e => e.id)).size, s.events.length);
  assert(s.events.filter(e => e.kind === 'relative-strength').every(e => e.facts.some(f => f.id.endsWith('relative-btc-24h') && f.unit === 'percent')));
  assert(s.events.some(e => e.kind === 'funding-extreme' && e.direction === 'neutral'));
  const cached = await f.service.snapshot(); assert.equal(cached, s); assert.equal(f.calls.length, 3);
  f.advance(60001); const refreshed = await f.service.snapshot();
  assert(refreshed.events.some(e => s.events.some(before => before.id === e.id))); assert.notEqual(refreshed.snapshotId, s.snapshotId);
  assert.notDeepEqual(refreshed.coverage.selected.slice(-2), s.coverage.selected.slice(-2));
  assert.equal(f.calls.filter(c => c.path.endsWith('exchangeInfo')).length, 1);
});
test('duplicates and blank/non-finite/stale rows excluded, gap remains visible without zero substitution', async () => {
  const f = fixture({ duplicate: true, invalid: true }), s = await f.service.snapshot();
  assert.equal(s.status, 'partial'); assert.equal(s.coverage.tickerValid, 21); assert.equal(s.coverage.excluded, 2);
  assert(!s.events.some(e => e.symbol === 'ETHUSDT' || e.symbol === '币安人生USDT'));
  const stale = await fixture({ stale: true }).service.snapshot(); assert.equal(stale.status, 'unavailable'); assert.deepEqual(stale.events, []);
});
test('funding failure preserves price-only candidates and explicitly incomplete coverage', async () => {
  const s = await fixture({ failPath: '/fapi/v1/premiumIndex' }).service.snapshot();
  assert.equal(s.status, 'partial'); assert.equal(s.coverage.fundingValid, 0); assert(s.events.length); assert(!s.events.some(e => e.kind === 'funding-extreme'));
});
test('singleflight snapshots/evidence, fixed GET allowlist, source facts and closed-hour computations', async () => {
  const f = fixture(); const [s, s2] = await Promise.all([f.service.snapshot(), f.service.snapshot()]); assert.equal(s, s2);
  const symbol = s.coverage.selected[0];
  const [a, b] = await Promise.all([f.service.getEvidence(symbol), f.service.getEvidence(symbol)]); assert.equal(a, b);
  assert.equal(a.status, 'available'); assert.equal(a.snapshotId, s.snapshotId); assert.equal(a.changes.openInterest1hPercent, (120 / 110 - 1) * 100);
  assert(a.facts.every(f => Number.isFinite(f.value) && f.source.startsWith('https://fapi.binance.com/') && f.window && f.observedAt > 0));
  assert.equal(a.facts.find(f => f.id.endsWith('funding-interval')).value, 8);
  assert.equal(f.calls.length, 8); assert(a.conditions.every(c => c.factIds.every(id => a.facts.some(f => f.id === id))));
  assert.equal(a.liquidity.bidBandCovered, true); assert.equal(a.liquidity.askBandCovered, true); assert(a.liquidity.buyFilled); assert(a.liquidity.buyImpactBps > 0);
  await assert.rejects(f.service.getEvidence('https://bad.test/')); await assert.rejects(f.service.getEvidence('MISSINGUSDT'));
  const outside = f.symbols.find(symbol => !s2.coverage.selected.includes(symbol)); if (outside) await assert.rejects(f.service.getEvidence(outside));
});
test('global concurrency bound applies across simultaneous per-symbol evidence requests', async () => {
  const f = fixture(); const s = await f.service.snapshot();
  await Promise.all(s.coverage.selected.slice(0, 6).map(symbol => f.service.getEvidence(symbol)));
  assert(f.getMax() <= 3);
});
test('rate limit cooldown suppresses retried HTTP and sensitive errors never escape', async () => {
  const f = fixture({ limited: true }); const a = await f.service.snapshot(); assert.equal(a.status, 'unavailable'); assert.equal(f.calls.length, 1);
  f.advance(61000); const b = await f.service.snapshot(); assert.equal(f.calls.length, 1);
  assert(!JSON.stringify([a, b]).includes('sensitive')); assert(!JSON.stringify([a, b]).includes('secret-proxy'));
});
test('watch/alert samples use raw funding ratios, stable observation IDs and validated universe', async () => {
  const f = fixture(); const samples = await f.service.getPublicSamples(['ETHUSDT', 'BTCUSDT']);
  assert.equal(samples.length, 4); assert.equal(samples.find(s => s.symbol === 'ETHUSDT' && s.metric === 'funding').value, -.002);
  assert.equal(samples.find(s => s.metric === 'price').source, 'binance-last-price');
  assert(await f.service.isSupportedSymbol('币安人生USDT')); assert.equal(await f.service.isSupportedSymbol('MISSINGUSDT'), false);
  assert.deepEqual(await f.service.getPublicSamples(['ETHUSDT', 'BTCUSDT']), samples); assert.equal(f.calls.length, 3);
  const watch = await f.service.getWatchlistMarket(['ETHUSDT']); assert.equal(watch[0].change24hPercent, 6); assert.equal(watch[0].lastPrice, 100); assert.equal(f.calls.length, 3);
  await assert.rejects(f.service.getWatchlistMarket(Array(9).fill('BTCUSDT')));
  await assert.rejects(f.service.getPublicSamples(Array(33).fill('BTCUSDT')));
});
test('liquidity boundaries report observed lower bounds; insufficient depth never invents impact', () => {
  const d = depth(); d.bids = [['99.99', '.01']]; d.asks = [['100.01', '.01']];
  const l = parseLiquidity(book(), d, 'BTCUSDT', NOW);
  assert(!l.bidBandCovered && !l.askBandCovered); assert.equal(l.buyImpactBps, null); assert.equal(l.sellImpactBps, null); assert(!l.buyFilled);
  assert(l.notes.some(n => n.includes('下界'))); assert.equal(l.bidDepth1pctUSDT, .9999);
  const invalid = depth(); invalid.asks.push(['101', '1']); assert.throws(() => parseLiquidity(book(), invalid, 'BTCUSDT', NOW));
  assert.throws(() => parseLiquidity(book(NOW - 60001), depth(), 'BTCUSDT', NOW));
  assert.throws(() => parseLiquidity(book(), { ...depth(), T: NOW - 16000 }, 'BTCUSDT', NOW));
});
test('price and OI histories reject duplicate/gapped series instead of interpreting missing samples', async () => {
  const f = fixture(); const s = await f.service.snapshot(); await f.service.getEvidence(s.coverage.selected[0]);
  const end = Math.floor(NOW / H) * H;
  const rows = Array.from({ length: 26 }, (_, i) => [end - (26 - i) * H, '', '', '', '100', '', end - (25 - i) * H - 1]);
  assert.equal(parseClosedHours(rows, NOW).price24hPercent, 0); rows[5][0] = rows[4][0]; assert.throws(() => parseClosedHours(rows, NOW));
  assert.throws(() => parseOpenInterest([{ symbol: 'BTCUSDT', timestamp: NOW - 2 * H, sumOpenInterest: '10', sumOpenInterestValue: '100' }, { symbol: 'BTCUSDT', timestamp: NOW, sumOpenInterest: '20', sumOpenInterestValue: '200' }], 'BTCUSDT', NOW));
});


test('supported-symbol validation only requests shared metadata, no market sweep or account data', async () => {
  const f = fixture();
  const results = await Promise.all([f.service.isSupportedSymbol('BTCUSDT'), f.service.isSupportedSymbol('ETHUSDT')]);
  assert.deepEqual(results, [true, true]); assert.equal(f.calls.length, 1); assert(f.calls[0].path.endsWith('exchangeInfo'));
  assert.equal(await f.service.isSupportedSymbol('DELIVERYUSDT_261225'), false);
  await f.service.snapshot(); assert.equal(f.calls.length, 3);
});


test('premium duplicates and non-finite funding cannot create extreme events or funding samples', async () => {
  const f = fixture({ badPremium: true }); const s = await f.service.snapshot();
  assert.equal(s.coverage.fundingValid, 21); assert.equal(s.status, 'partial');
  assert(!s.events.some(e => e.kind === 'funding-extreme'));
  assert.deepEqual((await f.service.getPublicSamples(['ETHUSDT'])).map(s => s.metric), ['price']);
});
test('cached snapshot expires by the oldest source time, not merely the fetch clock', async () => {
  const f = fixture({ atOffset: 179000 }); const s = await f.service.snapshot();
  assert.equal(s.timestamps.expiresAt, NOW + 1000);
  f.advance(1001); await f.service.snapshot(); assert.equal(f.calls.length, 5);
});

test('proxy changes invalidate old in-flight snapshots without clearing a newer singleflight', async () => {
  const f = fixture(); const transport = f.service.client;
  let release, reached; const entered = new Promise(resolve => { reached = resolve; });
  const blocked = new Promise(resolve => { release = resolve; }); let first = true;
  f.service.client = { get: async (...args) => { const response = await transport.get(...args); if (first) { first = false; reached(); await blocked; } return response; } };
  const old = f.service.snapshot(); const rejected = assert.rejects(old, /设置已变更/);
  await entered; f.service.setProxy('http://127.0.0.1:12345'); f.service.client = transport;
  const current = f.service.snapshot(); release(); await rejected;
  const result = await current; assert.equal(result.status, 'available'); assert.equal(await f.service.snapshot(), result);
  assert.equal(f.calls.filter(c => c.path.endsWith('exchangeInfo')).length, 2);
});
test('proxy changes discard in-flight evidence and stop the remaining old-budget requests', async () => {
  const f = fixture(); const snapshot = await f.service.snapshot(); const transport = f.service.client;
  let release, reached; const entered = new Promise(resolve => { reached = resolve; }); const blocked = new Promise(resolve => { release = resolve; });
  f.service.client = { get: async (...args) => { const response = await transport.get(...args); reached(); await blocked; return response; } };
  const old = f.service.getEvidence(snapshot.coverage.selected[0]); const rejected = assert.rejects(old, /设置已变更/);
  await entered; f.service.setProxy('http://127.0.0.1:12345'); f.service.client = transport; release(); await rejected;
  assert.equal(f.calls.length, 4, 'metadata/ticker/premium plus only first old evidence request');
});
