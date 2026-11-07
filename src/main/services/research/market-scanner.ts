import axios from 'axios';
import { createHash } from 'crypto';
import type { PublicResearchTransport, PublicResearchSample, ResearchWatchQuote, ResearchEvent, ResearchEventKind, ResearchEvidence, ResearchFact, ResearchSnapshot } from '../../types/research';
import { binanceUsdtBaseAsset, isBinanceBaseAsset, isBinanceUsdtPerpetualSymbol } from '../../utils/binance-symbol';
import { HOUR, RULE_VERSION, blankEvidence, fact, finite, fresh, parseClosedHours, parseFunding, parseLiquidity, parseOpenInterest, positive } from './evidence';
const PATHS = new Set(['/fapi/v1/exchangeInfo', '/fapi/v1/ticker/24hr', '/fapi/v1/premiumIndex', '/fapi/v1/klines', '/futures/data/openInterestHist', '/fapi/v1/fundingRate', '/fapi/v1/ticker/bookTicker', '/fapi/v1/depth']);
const FLOOR = 5_000_000, TTL = 60_000, BUDGET = 12;
type Row = { symbol: string; baseAsset: string; price: number; change: number; volume: number; at: number; funding: { rate: number; at: number } | null };
type Budget = { remaining: number; deadline: number; generation: number };
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
/** Null/empty/non-finite values never become zero and duplicate symbols are all excluded. */
function uniqueRows(input: unknown): Map<string, any> {
  if (!Array.isArray(input) || input.length > 20_000) throw new Error('公开数据格式无效');
  const result = new Map<string, any>(), duplicates = new Set<string>();
  for (const row of input) {
    if (!row || typeof row.symbol !== 'string') continue;
    if (result.has(row.symbol)) duplicates.add(row.symbol);
    else result.set(row.symbol, row);
  }
  for (const symbol of duplicates) result.delete(symbol);
  return result;
}
function blankSnapshot(now: number): ResearchSnapshot {
  return { version: 'research-snapshot-v1', ruleVersion: RULE_VERSION, snapshotId: '', status: 'unavailable', events: [], breadth: { eligible: 0, priced: 0, rising: 0, falling: 0, flat: 0, medianChange24h: null, quoteVolume24h: 0 }, coverage: { universe: 'Binance USDT perpetual', eligible: 0, tickerValid: 0, fundingValid: 0, aboveTurnoverFloor: 0, deepResearchBudget: BUDGET, selected: [], excluded: 0, turnoverFloorUSDT: FLOOR, scope: '全部在交易的 Binance USDT 永续；24h 成交额至少 500 万 USDT；最多 10 个优先标的 + 2 个轮转探索。横截面筛选，不是收益预测，也不证明相对自身历史异常。' }, timestamps: { fetchedAt: now, expiresAt: now + TTL, tickerOldestAt: null, fundingOldestAt: null }, gaps: ['不覆盖现货、其他交易所、基本面与代币解锁；成交额不等于盘口流动性。', '资金费参考值未按结算周期归一化，不用于跨币种收益比较。'] };
}
export class BinanceResearchService {
  private client: PublicResearchTransport;
  private proxy = '';
  private blockedUntil = 0;
  private now: () => number;
  private generation = 0;
  private snapshotCache: ResearchSnapshot | null = null;
  private snapshotFlight: Promise<ResearchSnapshot> | null = null;
  private evidenceCache = new Map<string, ResearchEvidence>();
  private evidenceFlights = new Map<string, Promise<ResearchEvidence>>();
  private samples: PublicResearchSample[] = [];
  private watchQuotes: ResearchWatchQuote[] = [];
  private metadata: { at: number; symbols: Map<string, any> } | null = null;
  private metadataFlight: Promise<Map<string, any>> | null = null;
  private active = 0;
  private waiters: Array<() => void> = [];
  constructor(options: { transport?: PublicResearchTransport; now?: () => number } = {}) {
    this.client = options.transport || axios.create({ baseURL: 'https://fapi.binance.com', timeout: 8000, proxy: false });
    this.now = options.now || Date.now;
  }
  setProxy(value: string) {
    if (this.proxy === value) return;
    let proxy: any = false;
    try {
      if (value) { const u = new URL(value); if (!['http:', 'https:'].includes(u.protocol)) throw new Error(); proxy = { host: u.hostname, port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80), protocol: u.protocol.slice(0, -1), ...(u.username ? { auth: { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) } } : {}) }; }
    } catch { throw new Error('研究代理地址无效'); }
    this.client = axios.create({ baseURL: 'https://fapi.binance.com', timeout: 8000, proxy });
    this.proxy = value; this.generation++; this.snapshotFlight = null; this.metadataFlight = null; this.evidenceFlights.clear(); this.snapshotCache = null; this.metadata = null; this.evidenceCache.clear(); this.samples = []; this.watchQuotes = [];
  }
  private async read(path: string, params: Record<string, string | number>, budget: Budget): Promise<any> {
    if (!PATHS.has(path)) throw new Error('研究接口不在只读允许范围');
    if (this.active >= 3) await new Promise<void>(resolve => this.waiters.push(resolve));
    else this.active++;
    try {
      if (budget.generation !== this.generation) throw new Error('研究代理设置已变更');
      if (this.now() < this.blockedUntil) throw new Error('公共市场限流冷却中');
      const remainingTime = budget.deadline - this.now();
      if (remainingTime <= 0 || budget.remaining-- <= 0) throw new Error('研究读取预算已用完');
      try { const data = (await this.client.get(path, { params, timeout: Math.min(8000, remainingTime) })).data; if (this.now() > budget.deadline || budget.generation !== this.generation) throw new Error('请求已过期'); return data; }
      catch (error: any) {
        const status = error?.response?.status;
        if (status === 429 || status === 418) {
          const raw = error?.response?.headers?.['retry-after'], seconds = Number(raw);
          const retry = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : Date.parse(raw) - this.now();
          this.blockedUntil = this.now() + Math.max(status === 418 ? 600_000 : 60_000, Number.isFinite(retry) ? Math.min(retry, 86_400_000) : 0);
        }
        throw new Error(status === 429 || status === 418 ? '公共市场限流，请稍后刷新' : '公开数据读取失败');
      }
    } finally { const next = this.waiters.shift(); if (next) next(); else this.active--; }
  }
  private async getMetadata(budget: Budget): Promise<Map<string, any>> {
    if (this.metadata && this.now() - this.metadata.at < 900_000) return this.metadata.symbols;
    if (this.metadataFlight) return this.metadataFlight;
    const generation = this.generation;
    const flight = (async () => {
      const info = await this.read('/fapi/v1/exchangeInfo', {}, budget);
      const symbols = new Map([...uniqueRows(info?.symbols)].filter(([symbol, spec]) => spec.status === 'TRADING' && spec.contractType === 'PERPETUAL' && spec.quoteAsset === 'USDT' && spec.marginAsset === 'USDT' && isBinanceBaseAsset(spec.baseAsset) && isBinanceUsdtPerpetualSymbol(symbol) && binanceUsdtBaseAsset(symbol, false) === spec.baseAsset));
      if (!symbols.size || generation !== this.generation) throw new Error('合约元数据暂不可用');
      this.metadata = { at: this.now(), symbols }; return symbols;
    })();
    this.metadataFlight = flight;
    try { return await flight; } finally { if (this.metadataFlight === flight) this.metadataFlight = null; }
  }
  async isSupportedSymbol(symbol: string): Promise<boolean> {
    if (!isBinanceUsdtPerpetualSymbol(symbol)) return false;
    try { return (await this.getMetadata({ remaining: 1, deadline: this.now() + 8000, generation: this.generation })).has(symbol); }
    catch { return false; }
  }
  /** Bounded watch/alert input; only current validated public source samples. */
  async getPublicSamples(symbols: string[]): Promise<PublicResearchSample[]> {
    if (!Array.isArray(symbols) || symbols.length > 32 || symbols.some(s => !isBinanceUsdtPerpetualSymbol(s))) throw new Error('观察标的列表无效');
    const snapshot = await this.snapshot();
    if (snapshot.status === 'unavailable' || this.now() >= snapshot.timestamps.expiresAt) return [];
    const wanted = new Set(symbols);
    return this.samples.filter(sample => wanted.has(sample.symbol) && this.now() - sample.observedAt <= 180_000);
  }
  async getWatchlistMarket(symbols: string[]): Promise<ResearchWatchQuote[]> {
    if (!Array.isArray(symbols) || symbols.length > 8 || symbols.some(s => !isBinanceUsdtPerpetualSymbol(s))) throw new Error('观察标的列表无效');
    const snapshot = await this.snapshot();
    if (snapshot.status === 'unavailable' || this.now() >= snapshot.timestamps.expiresAt) return [];
    const wanted = new Set(symbols);
    return this.watchQuotes.filter(quote => wanted.has(quote.symbol) && this.now() - quote.observedAt <= 180_000);
  }
  async snapshot(): Promise<ResearchSnapshot> {
    const now = this.now();
    if (this.snapshotCache && now < this.snapshotCache.timestamps.expiresAt) return this.snapshotCache;
    if (this.snapshotFlight) return this.snapshotFlight;
    const generation = this.generation;
    const flight = this.collect(); this.snapshotFlight = flight;
    try {
      const result = await flight;
      if (this.generation !== generation) throw new Error('研究代理设置已变更，请刷新');
      this.snapshotCache = result; return result;
    } finally { if (this.snapshotFlight === flight) this.snapshotFlight = null; }
  }
  private async collect(): Promise<ResearchSnapshot> {
    const now = this.now(), result = blankSnapshot(now), budget = { remaining: 3, deadline: now + 25_000, generation: this.generation };
    try {
      const instruments = await this.getMetadata(budget);
      result.coverage.eligible = result.breadth.eligible = instruments.size;
      const tickers = uniqueRows(await this.read('/fapi/v1/ticker/24hr', {}, budget));
      let premium = new Map<string, any>();
      try { premium = uniqueRows(await this.read('/fapi/v1/premiumIndex', {}, budget)); } catch { result.gaps.push('资金费参考快照不可用，相关候选未生成。'); }
      const rows: Row[] = [];
      for (const [symbol, spec] of instruments) {
        const ticker = tickers.get(symbol); if (!ticker) continue;
        try {
          const at = fresh(ticker.closeTime, this.now()), price = positive(ticker.lastPrice), change = finite(ticker.priceChangePercent), volume = finite(ticker.quoteVolume);
          if (volume < 0 || change <= -100) throw new Error();
          let funding: Row['funding'] = null; const p = premium.get(symbol);
          try { if (p) { positive(p.markPrice); funding = { rate: finite(p.lastFundingRate), at: fresh(p.time, this.now()) }; } } catch { /* Excluded, never substituted with zero. */ }
          rows.push({ symbol, baseAsset: spec.baseAsset, price, change, volume, at, funding });
        } catch { /* Coverage records rejected tickers. */ }
      }
      if (!rows.length) throw new Error('无有效行情');
      const changes = rows.map(r => r.change).sort((a, b) => a - b), mid = Math.floor(changes.length / 2);
      const total = rows.reduce((sum, r) => sum + r.volume, 0); if (!Number.isFinite(total)) throw new Error('汇总计算超限');
      result.breadth = { eligible: instruments.size, priced: rows.length, rising: rows.filter(r => r.change > 0).length, falling: rows.filter(r => r.change < 0).length, flat: rows.filter(r => r.change === 0).length, medianChange24h: changes.length % 2 ? changes[mid] : (changes[mid - 1] + changes[mid]) / 2, quoteVolume24h: total };
      const active = rows.filter(r => r.volume >= FLOOR).sort((a, b) => b.volume - a.volume || compare(a.symbol, b.symbol));
      const btc = rows.find(r => r.symbol === 'BTCUSDT');
      if (!btc) result.gaps.push('BTC 行情缺失，相对强弱筛选暂停。');
      result.coverage.tickerValid = rows.length; result.coverage.fundingValid = rows.filter(r => r.funding).length; result.coverage.aboveTurnoverFloor = active.length; result.coverage.excluded = instruments.size - rows.length;
      result.timestamps.tickerOldestAt = Math.min(...rows.map(r => r.at));
      const fundingTimes = rows.flatMap(r => r.funding ? [r.funding.at] : []);
      result.timestamps.fundingOldestAt = fundingTimes.length ? Math.min(...fundingTimes) : null;
      result.timestamps.fetchedAt = this.now();
      result.timestamps.expiresAt = Math.min(this.now() + TTL, result.timestamps.tickerOldestAt + 180_000, ...(fundingTimes.length ? [Math.min(...fundingTimes) + 180_000] : []));
      this.watchQuotes = rows.map(row => ({ symbol: row.symbol, baseAsset: row.baseAsset, lastPrice: row.price, change24hPercent: row.change, observedAt: row.at, fetchedAt: result.timestamps.fetchedAt }));
      this.samples = rows.flatMap(row => {
        const make = (metric: 'price' | 'funding', value: number, observedAt: number): PublicResearchSample => ({ id: createHash('sha256').update(JSON.stringify([row.symbol, metric, observedAt, value])).digest('hex').slice(0, 24), symbol: row.symbol, metric, value, observedAt, fetchedAt: result.timestamps.fetchedAt, source: metric === 'price' ? 'binance-last-price' : 'binance-funding-rate' });
        return [make('price', row.price, row.at), ...(row.funding ? [make('funding', row.funding.rate, row.funding.at)] : [])];
      });
      result.snapshotId = createHash('sha256').update(JSON.stringify({ version: RULE_VERSION, rows: [...rows].sort((a, b) => compare(a.symbol, b.symbol)) })).digest('hex').slice(0, 24);
      const events: ResearchEvent[] = [], seen = new Set<string>();
      const add = (row: Row, kind: ResearchEventKind, priority: number, title: string, reason: string, direction: ResearchEvent['direction'], extra: ResearchFact[] = []) => {
        const id = `${row.symbol}:${kind}:${RULE_VERSION}`; if (seen.has(id)) return; seen.add(id);
        events.push({ id, snapshotId: result.snapshotId, ruleVersion: RULE_VERSION, symbol: row.symbol, baseAsset: row.baseAsset, kind, direction, title, reason, priority, detectedAt: result.timestamps.fetchedAt, expiresAt: result.timestamps.expiresAt, facts: [fact(row.symbol, 'price-last', '最新成交价', row.price, 'USDT', '/fapi/v1/ticker/24hr', row.at, result.timestamps.fetchedAt, '当前'), fact(row.symbol, 'change-24h', '滚动 24h 涨跌', row.change, 'percent', '/fapi/v1/ticker/24hr', row.at, result.timestamps.fetchedAt, '滚动24h'), fact(row.symbol, 'quote-volume-24h', '滚动 24h 成交额', row.volume, 'USDT', '/fapi/v1/ticker/24hr', row.at, result.timestamps.fetchedAt, '滚动24h'), ...extra], gaps: ['横截面规则命中，不是买卖指令或未来收益预测。'], deepResearchEligible: false });
      };
      active.forEach((row, rank) => {
        if (btc && row.symbol !== btc.symbol) {
          const relative = row.change - btc.change;
          if (Math.abs(relative) >= 3) add(row, relative > 0 ? 'relative-strength' : 'relative-weakness', Math.min(90, 55 + Math.abs(relative)), relative > 0 ? '相对 BTC 走强' : '相对 BTC 走弱', `滚动 24h 涨跌差 ${relative.toFixed(2)} 个百分点，尚未验证持续性。`, relative > 0 ? 'long' : 'short', [fact(row.symbol, 'relative-btc-24h', '相对 BTC 涨跌差（百分点）', relative, 'percent', '/fapi/v1/ticker/24hr', Math.min(row.at, btc.at), result.timestamps.fetchedAt, '滚动24h横截面')]);
        }
        if (rank < Math.max(1, Math.ceil(active.length * .1))) add(row, 'active-turnover', 40 + 10 * (1 - rank / active.length), '成交活跃', '24h 成交额处于合格标的前 10%；不是相对自身历史放量。', 'neutral');
        if (row.funding && Math.abs(row.funding.rate) >= .001) add(row, 'funding-extreme', 65 + Math.min(25, Math.abs(row.funding.rate) * 1000), '资金费偏离', '参考资金费绝对值达到 0.10%；结算周期和实际下一次费率仍待复核。', 'neutral', [fact(row.symbol, 'funding-reference', '资金费参考值', row.funding.rate, 'ratio', '/fapi/v1/premiumIndex', row.funding.at, result.timestamps.fetchedAt, '当前参考值，非已结算')]);
      });
      events.sort((a, b) => b.priority - a.priority || compare(a.id, b.id));
      const selected = [...new Set(events.map(e => e.symbol))].slice(0, 10);
      const pool = active.filter(r => !selected.includes(r.symbol)).sort((a, b) => compare(a.symbol, b.symbol));
      const offset = pool.length ? Math.floor(now / TTL) % pool.length : 0;
      for (let i = 0; i < Math.min(2, pool.length); i++) {
        const row = pool[(offset + i) % pool.length]; selected.push(row.symbol);
        if (!events.some(e => e.symbol === row.symbol)) add(row, 'exploration', 10, '轮转观察', '从成交额合格池轮转抽取，减少仅关注热门标的的偏差；未识别方向。', 'neutral');
      }
      result.coverage.selected = selected;
      result.events = events.map(event => ({ ...event, deepResearchEligible: selected.includes(event.symbol) }));
      if (rows.length < instruments.size) result.gaps.push(`${instruments.size - rows.length} 个合约行情缺失、重复、过期或数值无效。`);
      if (result.coverage.fundingValid < rows.length) result.gaps.push(`${rows.length - result.coverage.fundingValid} 个已定价合约缺少有效资金费参考。`);
      result.status = rows.length === instruments.size && result.coverage.fundingValid === rows.length ? 'available' : 'partial';
    } catch { result.status = 'unavailable'; result.events = []; result.gaps.push(this.now() < this.blockedUntil ? '公共市场限流冷却中，请稍后刷新。' : '公开行情读取或校验失败；未生成研究结论。'); }
    return result;
  }
  async getEvidence(symbol: string): Promise<ResearchEvidence> {
    if (!isBinanceUsdtPerpetualSymbol(symbol)) throw new Error('研究标的无效');
    const snapshot = await this.snapshot();
    if (snapshot.status === 'unavailable' || !snapshot.coverage.selected.includes(symbol)) throw new Error('标的不在本轮 12 个研究预算内');
    const key = `${snapshot.snapshotId}:${symbol}`, cached = this.evidenceCache.get(key);
    if (cached && this.now() < cached.expiresAt) return cached;
    const flight = this.evidenceFlights.get(key); if (flight) return flight;
    const generation = this.generation, promise = this.collectEvidence(symbol, snapshot);
    this.evidenceFlights.set(key, promise);
    try { const result = await promise; if (generation !== this.generation) throw new Error('研究代理设置已变更，请刷新'); if (generation === this.generation) { if (this.evidenceCache.size >= 24) this.evidenceCache.delete(this.evidenceCache.keys().next().value!); this.evidenceCache.set(key, result); } return result; }
    finally { if (this.evidenceFlights.get(key) === promise) this.evidenceFlights.delete(key); }
  }
  private async collectEvidence(symbol: string, snapshot: ResearchSnapshot): Promise<ResearchEvidence> {
    const now = this.now(), result = blankEvidence(symbol, snapshot.snapshotId, now), budget = { remaining: 5, deadline: now + 30_000, generation: this.generation };
    const requests: Array<[string, Record<string, string | number>]> = [
      ['/fapi/v1/klines', { symbol, interval: '1h', limit: 26 }], ['/futures/data/openInterestHist', { symbol, period: '1h', limit: 3 }], ['/fapi/v1/fundingRate', { symbol, limit: 3 }], ['/fapi/v1/ticker/bookTicker', { symbol }], ['/fapi/v1/depth', { symbol, limit: 100 }]
    ];
    const data: any[] = [];
    // Sequential within an asset; global semaphore allows at most 3 public reads.
    for (const [path, params] of requests) { try { data.push(await this.read(path, params, budget)); } catch { data.push(null); } }
    const at = this.now(); let groups = 0;
    try {
      const p = parseClosedHours(data[0], at); result.changes.price1hPercent = p.price1hPercent; result.changes.price24hPercent = p.price24hPercent;
      result.facts.push(fact(symbol, 'closed-price', '最近已收盘小时价格', p.close, 'USDT', requests[0][0], p.end, at, '1h已收盘'), fact(symbol, 'price-change-1h', '已收盘 1h 涨跌', p.price1hPercent, 'percent', requests[0][0], p.end, at, '相邻小时收盘价'), fact(symbol, 'price-change-24h', '已收盘 24h 涨跌', p.price24hPercent, 'percent', requests[0][0], p.end, at, `${p.start}—${p.end}`)); groups++;
    } catch { result.gaps.push('已收盘 1h 价格历史不足、不连续或过期。'); }
    try {
      const oi = parseOpenInterest(data[1], symbol, at); result.changes.openInterest1hPercent = oi.change;
      result.facts.push(fact(symbol, 'oi-change-1h', '未平仓量 1h 变化', oi.change, 'percent', requests[1][0], oi.end, at, `${oi.start}—${oi.end}`), fact(symbol, 'oi-notional', '未平仓名义价值', oi.value, 'USDT', requests[1][0], oi.end, at, '小时采样')); groups++;
    } catch { result.gaps.push('未平仓量小时历史不足、不连续或过期；不能将其称为净资金流入。'); }
    try {
      const f = parseFunding(data[2], symbol, at); result.changes.settledFundingRate = f.rate;
      result.facts.push(fact(symbol, 'funding-settled', '最近已结算资金费率', f.rate, 'ratio', requests[2][0], f.at, at, '单次已结算'));
      if (f.intervalHours !== null) result.facts.push(fact(symbol, 'funding-interval', '观察到的结算间隔', f.intervalHours, 'hours', requests[2][0], f.at, at, '最近3次结算；非未来保证'));
      else result.gaps.push('不能从现有结算记录确认固定资金费周期。'); groups++;
    } catch { result.gaps.push('已结算资金费记录缺失或无效，不外推持有收益。'); }
    try {
      const l = parseLiquidity(data[3], data[4], symbol, at); result.liquidity = l;
      for (const [metric, label, value, unit] of [ ['spread', '可见盘口价差', l.spreadBps === null ? null : l.spreadBps / 100, 'percent'], ['depth-bid-1pct', l.bidBandCovered ? '买盘 1% 深度' : '买盘 1% 已见深度下界', l.bidDepth1pctUSDT, 'USDT'], ['depth-ask-1pct', l.askBandCovered ? '卖盘 1% 深度' : '卖盘 1% 已见深度下界', l.askDepth1pctUSDT, 'USDT'], ['buy-impact', '假设买入 1000 USDT 冲击', l.buyImpactBps === null ? null : l.buyImpactBps / 100, 'percent'], ['sell-impact', '假设卖出 1000 USDT 冲击', l.sellImpactBps === null ? null : l.sellImpactBps / 100, 'percent'] ] as const) {
        if (value !== null) result.facts.push(fact(symbol, metric, label, value, unit, requests[4][0], l.observedAt!, at, '100档盘口快照；非实际成交'));
      }
      if (!l.bidBandCovered || !l.askBandCovered) result.gaps.push('盘口未覆盖完整 ±1%；深度金额仅是下界。'); groups++;
    } catch { result.gaps.push('盘口缺失、过期、交叉或快照不一致，价差与冲击未知。'); }
    const condition = (id: string, label: string, metrics: string[], value: boolean | null) => ({ id: `${symbol}:condition:${id}`, label, factIds: metrics.map(metric => `${symbol}:${metric}`).filter(id => result.facts.some(f => f.id === id)), state: value === null ? 'unknown' as const : value ? 'met' as const : 'not-met' as const });
    const change = result.changes.price1hPercent, oi = result.changes.openInterest1hPercent, l = result.liquidity;
    result.conditions = [condition('price-positive', '已收盘 1h 涨幅大于 0', ['price-change-1h'], change === null ? null : change > 0), condition('price-negative', '已收盘 1h 跌幅小于 0', ['price-change-1h'], change === null ? null : change < 0), condition('oi-expanding', '未平仓量 1h 增加', ['oi-change-1h'], oi === null ? null : oi > 0), condition('liquidity-ready', '±1% 已覆盖、双边假设订单完整且价差不超过 10bp', ['spread', 'depth-bid-1pct', 'depth-ask-1pct', 'buy-impact', 'sell-impact'], l.spreadBps === null ? null : l.bidBandCovered && l.askBandCovered && l.buyFilled && l.sellFilled && l.spreadBps <= 10)];
    result.fetchedAt = at; result.expiresAt = Math.min(at + TTL, snapshot.timestamps.expiresAt, l.observedAt === null ? at + TTL : l.observedAt + 60_000);
    result.status = groups === 4 && result.gaps.length === 1 ? 'available' : groups ? 'partial' : 'unavailable';
    return result;
  }
}
