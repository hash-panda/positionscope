import type { ResearchEvidence, ResearchFact, ResearchLiquidity } from '../../types/research';
export const HOUR = 3_600_000;
export const RULE_VERSION = 'binance-events-v1';
export const source = (path: string) => `https://fapi.binance.com${path}`;
export function finite(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || (typeof value === 'string' && !value.trim())) throw new Error('数字缺失');
  const n = Number(value); if (!Number.isFinite(n)) throw new Error('数字无效'); return n;
}
export function positive(value: unknown): number { const n = finite(value); if (n <= 0) throw new Error('非正值'); return n; }
export function timestamp(value: unknown): number { const n = positive(value); if (!Number.isSafeInteger(n)) throw new Error('时间无效'); return n; }
export function fresh(value: unknown, now: number, age = 180_000): number {
  const t = timestamp(value); if (t > now + 60_000 || now - t > age) throw new Error('数据过期'); return t;
}
export function fact(symbol: string, metric: string, label: string, value: number, unit: ResearchFact['unit'], path: string, observedAt: number, fetchedAt: number, window: string): ResearchFact {
  if (!Number.isFinite(value)) throw new Error('计算超限');
  return { id: `${symbol}:${metric}`, label, value, unit, source: source(path), observedAt, fetchedAt, window };
}
export function emptyLiquidity(): ResearchLiquidity {
  return { spreadBps: null, midPrice: null, bidDepth1pctUSDT: null, askDepth1pctUSDT: null, bidBandCovered: false, askBandCovered: false, assumedOrderUSDT: 1000, buyImpactBps: null, sellImpactBps: null, buyFilled: false, sellFilled: false, observedAt: null, source: source('/fapi/v1/depth'), notes: ['仅限 Binance 可见普通盘口，不含 RPI 隐藏订单；快照并非成交承诺。', '假设 1,000 USDT 名义订单，不含手续费、延迟和后续盘口变化。'] };
}
/** Closed hourly close-to-close returns, not an account return or prediction. */
export function parseClosedHours(rows: unknown, now: number): { price1hPercent: number; price24hPercent: number; start: number; end: number; close: number } {
  if (!Array.isArray(rows) || rows.length > 30) throw new Error('小时历史格式无效');
  const closed = rows.filter(r => Array.isArray(r) && timestamp(r[6]) < now).map(r => ({ open: timestamp(r[0]), end: timestamp(r[6]), close: positive(r[4]) }));
  if (closed.length < 25) throw new Error('已收盘小时数据不足');
  for (let i = 0; i < closed.length; i++) {
    const row = closed[i];
    if (row.open % HOUR || row.end - row.open !== HOUR - 1 || (i && row.open - closed[i - 1].open !== HOUR)) throw new Error('小时历史不连续');
  }
  const last = closed[closed.length - 1]; fresh(last.end, now, 2 * HOUR);
  return { price1hPercent: (last.close / closed[closed.length - 2].close - 1) * 100, price24hPercent: (last.close / closed[closed.length - 25].close - 1) * 100, start: closed[closed.length - 25].end, end: last.end, close: last.close };
}
export function parseOpenInterest(rows: unknown, symbol: string, now: number): { change: number; value: number; start: number; end: number } {
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 3) throw new Error('持仓量历史不足');
  const parsed = rows.map(r => {
    if (!r || r.symbol !== symbol) throw new Error('持仓量标的不符');
    return { time: timestamp(r.timestamp), amount: positive(r.sumOpenInterest), value: positive(r.sumOpenInterestValue) };
  });
  for (let i = 1; i < parsed.length; i++) if (parsed[i].time - parsed[i - 1].time !== HOUR) throw new Error('持仓量小时历史不连续');
  const last = parsed[parsed.length - 1], previous = parsed[parsed.length - 2]; fresh(last.time, now, 2 * HOUR);
  return { change: (last.amount / previous.amount - 1) * 100, value: last.value, start: previous.time, end: last.time };
}
export function parseFunding(rows: unknown, symbol: string, now: number): { rate: number; at: number; intervalHours: number | null } {
  if (!Array.isArray(rows) || !rows.length || rows.length > 3) throw new Error('资金费历史缺失');
  const parsed = rows.map(r => {
    if (!r || r.symbol !== symbol) throw new Error('资金费标的不符');
    const at = timestamp(r.fundingTime); if (at > now) throw new Error('未结算费率');
    return { at, rate: finite(r.fundingRate) };
  });
  for (let i = 1; i < parsed.length; i++) if (parsed[i].at <= parsed[i - 1].at) throw new Error('资金费重复或乱序');
  const last = parsed[parsed.length - 1]; fresh(last.at, now, 24 * HOUR);
  const interval = parsed.length === 3 && parsed[2].at - parsed[1].at === parsed[1].at - parsed[0].at ? (parsed[2].at - parsed[1].at) / HOUR : null;
  return { rate: last.rate, at: last.at, intervalHours: interval && interval > 0 && interval <= 24 ? interval : null };
}
type Level = { price: number; quantity: number };
function levels(input: unknown, side: 'bid' | 'ask'): Level[] {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new Error('盘口档位无效');
  const result = input.map(row => { if (!Array.isArray(row) || row.length !== 2) throw new Error('盘口格式无效'); return { price: positive(row[0]), quantity: positive(row[1]) }; });
  for (let i = 1; i < result.length; i++) if (side === 'bid' ? result[i].price >= result[i - 1].price : result[i].price <= result[i - 1].price) throw new Error('盘口重复或乱序');
  return result;
}
function sweep(rows: Level[], mid: number, buy: boolean): { filled: boolean; impact: number | null } {
  // Buy spends 1000 quote; sell disposes 1000 / mid base. This difference is intentional.
  let remaining = buy ? 1000 : 1000 / mid, quote = 0, base = 0;
  for (const row of rows) {
    const quantity = Math.min(row.quantity, buy ? remaining / row.price : remaining);
    quote += quantity * row.price; base += quantity; remaining -= buy ? quantity * row.price : quantity;
    if (remaining <= 1e-10) break;
  }
  const filled = remaining <= 1e-10;
  const impact = filled && base > 0 ? (buy ? quote / base / mid - 1 : 1 - quote / base / mid) * 10_000 : null;
  if (impact !== null && !Number.isFinite(impact)) throw new Error('盘口计算超限');
  return { filled, impact };
}
export function parseLiquidity(book: unknown, depth: unknown, symbol: string, now: number): ResearchLiquidity {
  const b = book as any, d = depth as any;
  if (!b || b.symbol !== symbol || !d || !Number.isSafeInteger(d.lastUpdateId) || d.lastUpdateId <= 0) throw new Error('盘口标识无效');
  const bookAt = fresh(b.time, now, 60_000), depthAt = fresh(d.T, now, 60_000);
  // Asynchronous snapshots can be a few seconds apart, but cannot be conflated across minutes.
  if (Math.abs(bookAt - depthAt) > 15_000) throw new Error('盘口时刻不一致');
  const bid = positive(b.bidPrice), ask = positive(b.askPrice); positive(b.bidQty); positive(b.askQty);
  if (bid >= ask) throw new Error('盘口交叉');
  const bids = levels(d.bids, 'bid'), asks = levels(d.asks, 'ask');
  if (bids[0].price >= asks[0].price) throw new Error('深度盘口交叉');
  const mid = (bids[0].price + asks[0].price) / 2;
  if (Math.abs((bid + ask) / 2 / mid - 1) > .005) throw new Error('两个盘口快照价格偏离过大');
  const bidDepth = bids.filter(r => r.price >= mid * .99).reduce((sum, r) => sum + r.price * r.quantity, 0);
  const askDepth = asks.filter(r => r.price <= mid * 1.01).reduce((sum, r) => sum + r.price * r.quantity, 0);
  if (![mid, bidDepth, askDepth].every(Number.isFinite)) throw new Error('盘口计算超限');
  const bidCovered = bids[bids.length - 1].price <= mid * .99, askCovered = asks[asks.length - 1].price >= mid * 1.01;
  const buy = sweep(asks, mid, true), sell = sweep(bids, mid, false);
  const result = emptyLiquidity();
  Object.assign(result, { spreadBps: (asks[0].price - bids[0].price) / mid * 10_000, midPrice: mid, bidDepth1pctUSDT: bidDepth, askDepth1pctUSDT: askDepth, bidBandCovered: bidCovered, askBandCovered: askCovered, buyImpactBps: buy.impact, sellImpactBps: sell.impact, buyFilled: buy.filled, sellFilled: sell.filled, observedAt: depthAt });
  if (!bidCovered || !askCovered) result.notes.push('返回的 100 档未覆盖完整 ±1% 区间：深度仅为已见金额下界，不能当作完整流动性。');
  if (!buy.filled || !sell.filled) result.notes.push('可见盘口不足以模拟完整假设订单，相应冲击未知。');
  return result;
}
export function blankEvidence(symbol: string, snapshotId: string, now: number): ResearchEvidence {
  return { version: 'research-evidence-v1', ruleVersion: RULE_VERSION, snapshotId, symbol, fetchedAt: now, expiresAt: now + 60_000, status: 'unavailable', facts: [], changes: { price1hPercent: null, price24hPercent: null, openInterest1hPercent: null, settledFundingRate: null }, liquidity: emptyLiquidity(), conditions: [], gaps: ['未连接账户；不含基本面、解锁或全市场项目身份映射。'] };
}
