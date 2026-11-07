import { candidatePolicy, reviewFacts, validateReviewChoice, evaluateTrial, TRIAL_RULES } from './review';
import { isBinanceUsdtPerpetualSymbol } from '../../utils/binance-symbol';
import type { PaperBook, PaperCycle, PaperEvent, PaperFill, PaperPolicy, PaperState, PaperTrade } from '../../types/paper';
import { decimal as d, format as f, multiply as mul, divide as div, basisPoints as bps, cost, SCALE } from './decimal';
export const BOOK_TTL = 15_000, PLAN_TTL = 90_000;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
function check(ok: unknown): asserts ok { if (!ok) throw new Error('Invalid paper ledger event'); }
function time(x: unknown): asserts x is number { check(typeof x === 'number' && Number.isSafeInteger(x) && x >= 0); }
function text(x: unknown, max = 300): asserts x is string { check(typeof x === 'string' && x.trim() && x.length <= max && !/[\x00-\x1f\x7f]/.test(x)); }
function symbol(x: unknown): asserts x is string { check(isBinanceUsdtPerpetualSymbol(x)); }
function positive(x: unknown): bigint { const n = d(x); check(n > 0n); return n; }
export function validatePolicy(p: PaperPolicy): void {
  check(p && typeof p === 'object'); text(p.version, 80);
  for (const key of ['allocationBps', 'riskBps', 'stopBps', 'targetBps', 'maxHoldMinutes', 'maxPositions', 'feeBps', 'slippageBps', 'callsPerDay', 'intervalMinutes'] as const) check(Number.isSafeInteger(p[key]));
  check(p.allocationBps >= 100 && p.allocationBps <= 2500 && p.riskBps >= 10 && p.riskBps <= 100);
  check(p.stopBps >= 50 && p.stopBps <= 1000 && p.targetBps >= 50 && p.targetBps <= 3000);
  check(p.maxHoldMinutes >= 5 && p.maxHoldMinutes <= 1440 && p.maxPositions >= 1 && p.maxPositions <= 3);
  check(p.feeBps >= 1 && p.feeBps <= 100 && p.slippageBps >= 1 && p.slippageBps <= 100);
  check(p.callsPerDay >= 1 && p.callsPerDay <= 24 && p.intervalMinutes >= 15 && p.intervalMinutes <= 1440);
}
export function validateBook(b: PaperBook, at: number): void {
  check(b && typeof b === 'object'); symbol(b.symbol); check(typeof b.updateId === 'string' && /^\d{1,24}$/.test(b.updateId));
  time(b.observedAt); time(b.fetchedAt);
  check(b.observedAt <= b.fetchedAt + 2000 && b.fetchedAt <= at && at - b.observedAt <= BOOK_TTL && b.observedAt <= at + 2000 && at - b.fetchedAt <= BOOK_TTL);
  const step = positive(b.stepSize), minimum = positive(b.minQty), maximum = positive(b.maxQty);
  check(minimum <= maximum && minimum % step === 0n); positive(b.minNotional);
  for (const side of ['bids', 'asks'] as const) {
    const rows = b[side]; check(Array.isArray(rows) && rows.length > 0 && rows.length <= 100);
    let previous: bigint | null = null;
    for (const row of rows) {
      check(Array.isArray(row) && row.length === 2); const price = positive(row[0]); positive(row[1]);
      if (previous !== null) check(side === 'bids' ? price < previous : price > previous);
      previous = price;
    }
  }
  check(d(b.bids[0][0]) < d(b.asks[0][0]));
}
/** All-or-none local market fill, limited to visible depth. Never treats a price touch as a fill. */
export function fillBook(book: PaperBook, buy: boolean, quantity: bigint, policy: PaperPolicy): { price: bigint; notional: bigint; fee: bigint } | null {
  let remaining = quantity, notional = 0n;
  for (const [price, volume] of buy ? book.asks : book.bids) {
    const q = d(volume) < remaining ? d(volume) : remaining;
    // Buy amounts round upward, sell amounts downward, at the fixed-point boundary.
    const raw = d(price) * q;
    notional += buy ? (raw + SCALE - 1n) / SCALE : raw / SCALE;
    remaining -= q; if (remaining === 0n) break;
  }
  if (remaining > 0n || notional <= 0n) return null;
  notional += buy ? cost(notional, policy.slippageBps) : -cost(notional, policy.slippageBps);
  if (notional <= 0n) return null;
  return { price: div(notional, quantity), notional, fee: cost(notional, policy.feeBps) };
}
function direction(t: PaperTrade) { return t.direction === 'long' ? 1n : -1n; }
export function cycleMetrics(c: PaperCycle, books: Record<string, PaperBook>, at: number) {
  let balance = d(c.capital), unrealized = 0n, notional = 0n, available = true;
  for (const trade of c.trades) {
    balance += d(trade.grossPnl) - d(trade.fees) + d(trade.funding);
    if (!trade.exit) {
      const book = books[trade.symbol];
      if (!book || at - book.observedAt > BOOK_TTL || book.observedAt > at + 2000) { available = false; continue; }
      const quote = fillBook(book, trade.direction === 'short', d(trade.entry.quantity), trade.policy);
      if (!quote) { available = false; continue; }
      unrealized += (quote.notional - d(trade.entry.notional)) * direction(trade);
      notional += quote.notional;
    }
  }
  const fundingComplete = c.trades.every(t => t.fundingThrough >= (t.exit?.quoteAt ?? at));
  const equity = available ? balance + unrealized : null;
  return { balance: f(balance), equity: equity === null ? null : f(equity), unrealized: available ? f(unrealized) : null,
    knownNetPnl: equity === null ? null : f(equity - d(c.capital)), grossNotional: available ? f(notional) : null, fundingComplete,
    closed: c.trades.filter(t => t.exit).length, open: c.trades.filter(t => !t.exit).length };
}
function observe(c: PaperCycle, s: PaperState, at: number) {
  const m = cycleMetrics(c, s.books, at);
  c.curve.push({ at, equity: m.equity, knownNetPnl: m.knownNetPnl, fundingComplete: m.fundingComplete });
  if (c.status === 'settling' && c.trades.every(t => t.exit && t.fundingThrough >= t.exit.quoteAt)) { c.status = 'archived'; c.endedAt = at; }
}
function cancel(c: PaperCycle, note: string) { for (const p of c.decisions) if (p.status === 'pending') { p.status = 'cancelled'; p.note = note; } }
function execute(c: PaperCycle, s: PaperState, b: PaperBook, at: number) {
  for (const t of c.trades) {
    if (t.symbol !== b.symbol || t.exit || b.observedAt <= t.entry.quoteAt) continue;
    const price = d(t.direction === 'long' ? b.bids[0][0] : b.asks[0][0]);
    let reason: PaperFill['reason'] | null = c.status === 'settling' && c.settleRequestedAt !== null && b.observedAt > c.settleRequestedAt ? 'cycle-end' : null;
    if (!reason && (t.direction === 'long' ? price <= d(t.stop) : price >= d(t.stop))) reason = 'stop';
    if (!reason && (t.direction === 'long' ? price >= d(t.target) : price <= d(t.target))) reason = 'target';
    if (!reason && b.observedAt >= t.dueAt) reason = 'time';
    if (!reason) continue;
    const quote = fillBook(b, t.direction === 'short', d(t.entry.quantity), t.policy);
    if (!quote) continue; // Still open; insufficient visible depth cannot be fabricated into a settlement.
    t.exit = { at, quoteId: b.updateId, quoteAt: b.observedAt, quantity: t.entry.quantity, price: f(quote.price), notional: f(quote.notional), fee: f(quote.fee), reason };
    t.grossPnl = f((quote.notional - d(t.entry.notional)) * direction(t)); t.fees = f(d(t.fees) + quote.fee);
  }
  for (const p of c.decisions.filter(p => p.status === 'pending')) {
    if (at - p.at > PLAN_TTL) { p.status = 'expired'; p.note = '未在有效窗口获得后续报价'; continue; }
    if (c.status !== 'running' || p.plan.symbol !== b.symbol || b.observedAt <= p.at || b.fetchedAt <= p.at) continue;
    if (c.trades.some(t => t.symbol === b.symbol && t.exit?.quoteId === b.updateId)) continue;
    const reject = (note: string) => { p.status = 'rejected'; p.note = note; };
    const open = c.trades.filter(t => !t.exit);
    if (open.length >= p.policy.maxPositions || open.some(t => t.symbol === b.symbol)) { reject('持仓数量或同币种限制'); continue; }
    const m = cycleMetrics(c, s.books, at);
    if (m.equity === null || m.grossNotional === null || d(m.equity) <= 0n) { reject('权益不可验证或不足'); continue; }
    const equity = d(m.equity), allocation = bps(equity, p.policy.allocationBps);
    const riskBudget = bps(equity, p.policy.riskBps);
    const maxNotionalByRisk = riskBudget * 10_000n / BigInt(p.policy.stopBps + 2 * (p.policy.feeBps + p.policy.slippageBps));
    const budget = allocation < maxNotionalByRisk ? allocation : maxNotionalByRisk;
    const buy = p.plan.direction === 'long', top = d(buy ? b.asks[0][0] : b.bids[0][0]);
    const step = d(b.stepSize), quantity = div(budget, top + cost(top, p.policy.slippageBps)) / step * step;
    if (quantity < d(b.minQty) || quantity > d(b.maxQty) || quantity <= 0n) { reject('不满足合约数量规则'); continue; }
    const quote = fillBook(b, buy, quantity, p.policy);
    if (!quote || quote.notional < d(b.minNotional)) { reject('可见深度不足或低于最小名义金额'); continue; }
    // Slippage may consume the allocation headroom. Reject, never silently expand risk.
    if (quote.notional > allocation || quote.notional + quote.fee + d(m.grossNotional) > equity ||
        cost(quote.notional, p.policy.stopBps + 2 * (p.policy.feeBps + p.policy.slippageBps)) > riskBudget) { reject('名义敞口或预设损失预算超限'); continue; }
    const entry: PaperFill = { at, quoteId: b.updateId, quoteAt: b.observedAt, quantity: f(quantity), price: f(quote.price), notional: f(quote.notional), fee: f(quote.fee), reason: 'entry' };
    const sign = buy ? 1n : -1n;
    c.trades.push({ id: p.id, symbol: b.symbol, direction: buy ? 'long' : 'short', policyVersion: p.policy.version, entry, exit: null,
      stop: f(quote.price - sign * bps(quote.price, p.policy.stopBps)), target: f(quote.price + sign * bps(quote.price, p.policy.targetBps)),
      dueAt: b.observedAt + p.policy.maxHoldMinutes * 60_000, grossPnl: '0', fees: f(quote.fee), funding: '0',
      fundingThrough: b.observedAt, fundingIds: [], policy: clone(p.policy) });
    p.status = 'filled'; p.note = '按决策之后的可见盘口全量模拟成交';
  }
  observe(c, s, at);
}
export const emptyPaperState = (): PaperState => ({ version: 'paper-ledger-v1', cycles: [], books: {}, calls: [], reviews: [], trials: [] });
/** Pure deterministic reducer. The journal is the only persisted source of truth. */
export function applyPaperEvent(previous: PaperState, event: PaperEvent): PaperState {
  const s = clone(previous); text(event.id, 80); time(event.at); const at = event.at, command = event.command;
  check(command && typeof command === 'object');
  if (command.kind === 'start') {
    check(s.cycles.flatMap(c => c.trades).filter(t => !t.exit).length <= 3);
    const capital = positive(command.capital); check(capital >= d('100') && capital <= d('1000000')); validatePolicy(command.policy);
    for (const c of s.cycles) if (c.status === 'running' || c.status === 'paused') { c.status = 'settling'; c.settleRequestedAt = at; cancel(c, '新周期开始，旧周期停止开仓'); observe(c, s, at); }
    check(!s.cycles.some(c => c.id === event.id));
    s.cycles.push({ id: event.id, startedAt: at, endedAt: null, settleRequestedAt: null, capital: f(capital), policy: clone(command.policy), status: 'running', decisions: [], trades: [], curve: [{ at, equity: f(capital), knownNetPnl: '0', fundingComplete: true }], gaps: [] });
  } else if (command.kind === 'mode') {
    const c = s.cycles.find(c => c.id === command.cycleId); check(c && c.status !== 'archived');
    check(['running', 'paused', 'settling'].includes(command.mode)); check(c.status !== 'settling' || command.mode === 'settling');
    c.status = command.mode; if (c.status === 'settling' && c.settleRequestedAt === null) c.settleRequestedAt = at; if (c.status !== 'running') cancel(c, '周期停止开仓'); observe(c, s, at);
  } else if (command.kind === 'decision') {
    const c = s.cycles.find(c => c.id === command.cycleId); check(c && c.status === 'running');
    const p = command.plan; check(p && typeof p === 'object'); symbol(p.symbol); check(['long', 'short', 'abstain'].includes(p.direction));
    text(p.reason, 1000); text(p.snapshotId, 160); text(p.provider, 80); text(p.model, 120);
    check(Array.isArray(p.evidenceIds) && p.evidenceIds.length <= 16); p.evidenceIds.forEach(x => text(x, 160));
    if (p.direction !== 'abstain') check(p.evidenceIds.length > 0);
    check(Array.isArray(p.evidence) && p.evidence.length <= 40 && Array.isArray(p.conditions) && p.conditions.length <= 12);
    const ids = new Set<string>();
    for (const fact of p.evidence) {
      text(fact.id, 160); check(!ids.has(fact.id)); ids.add(fact.id); text(fact.label,160); check(Number.isFinite(fact.value));
      check(['USDT','base','percent','ratio','hours','contracts'].includes(fact.unit)); text(fact.source,300); text(fact.window,100);
      time(fact.observedAt); time(fact.fetchedAt); check(fact.observedAt <= at + 5000 && fact.fetchedAt <= at + 5000);
      check(/^((https:\/\/fapi\.binance\.com)?\/(fapi\/v1|futures\/data)\/)[a-zA-Z0-9/]+$/.test(fact.source));
    }
    check(p.evidenceIds.every(id => ids.has(id)));
    for (const condition of p.conditions) { text(condition.id,160); text(condition.label,300); check(['met','not-met','unknown'].includes(condition.state)); check(Array.isArray(condition.factIds) && condition.factIds.every(id => ids.has(id))); }

    const duplicate = c.decisions.some(x => x.plan.snapshotId === p.snapshotId && x.plan.symbol === p.symbol);
    check(!duplicate);
    c.decisions.push({ id: event.id, at, plan: clone(p), policy: clone(c.policy), status: p.direction === 'abstain' ? 'abstained' : 'pending', note: p.direction === 'abstain' ? '模型弃权，不创建模拟委托' : '等待决策之后的新鲜盘口' });
    for(const trial of s.trials.filter(t=>t.cycleId===c.id&&t.status==='observing'&&at>t.startedAt&&at<t.endAt)) for(const target of [trial.baseline,trial.challenger]) target.decisions.push({...clone(c.decisions[c.decisions.length-1]),policy:clone(target.policy)});
  } else if (command.kind === 'book') {
    const b = command.book; validateBook(b, at); const last = s.books[b.symbol];
    if (last && (BigInt(b.updateId) <= BigInt(last.updateId) || b.observedAt < last.observedAt)) return s;
    s.books[b.symbol] = clone(b);
    for (const c of s.cycles.filter(c => c.status !== 'archived')) execute(c, s, b, at);
    for (const trial of s.trials.filter(t => ['observing','settling'].includes(t.status))) for (const c of [trial.baseline,trial.challenger]) execute(c,s,b,at);
  } else if (command.kind === 'funding') {
    const w = command.window; check(w && typeof w === 'object'); symbol(w.symbol); time(w.start); time(w.end);
    check(w.start <= w.end && w.end <= at && Array.isArray(w.rows) && w.rows.length <= 1000);
    const seen = new Set<number>();
    for (const r of w.rows) { time(r.time); check(r.time >= w.start && r.time <= w.end && !seen.has(r.time)); seen.add(r.time); check(d(r.rate) >= -SCALE && d(r.rate) <= SCALE); positive(r.markPrice); }
    for (const c of [...s.cycles,...s.trials.filter(t=>['observing','settling'].includes(t.status)).flatMap(t=>[t.baseline,t.challenger])].filter(c => c.status !== 'archived')) {
      for (const t of c.trades.filter(t => t.symbol === w.symbol)) {
        if (w.start > t.fundingThrough + 1 || w.end < t.fundingThrough) continue; // Missing interval remains unknown.
        for (const r of w.rows) {
          if (r.time <= t.entry.quoteAt || (t.exit && r.time > t.exit.quoteAt) || t.fundingIds.includes(String(r.time))) continue;
          const charge = mul(mul(d(t.entry.quantity), d(r.markPrice)), d(r.rate)) * -direction(t);
          t.funding = f(d(t.funding) + charge); t.fundingIds.push(String(r.time));
        }
        t.fundingThrough = Math.max(t.fundingThrough, Math.min(w.end, t.exit?.quoteAt ?? w.end));
      }
      observe(c, s, at);
    }
  } else if (command.kind === 'review') {
    const c=s.cycles.find(c=>c.id===command.cycleId);check(c);
    const previousReviews=s.reviews.filter(r=>r.cycleId===c.id);const last=previousReviews[previousReviews.length-1];check(!last||at-last.at>=86400000||(c.status==='archived'&&last.at<c.endedAt!));
    const facts=reviewFacts(c);
    s.reviews.push({id:event.id,cycleId:c.id,at,sourcePolicy:clone(c.policy),facts,status:c.status==='running'&&facts.closedTrades>=3&&facts.fundingComplete?'awaiting-model':'insufficient',choice:'keep',provider:null,model:null,support:[],counter:[]});
  } else if(command.kind==='review-failed') {
    const r=s.reviews.find(r=>r.id===command.reviewId);check(r&&r.status==='awaiting-model');r.status='failed';
  } else if(command.kind==='review-result') {
    const review=s.reviews.find(r=>r.id===command.reviewId),call=s.calls.find(c=>c.id===command.callId);
    check(review&&review.status==='awaiting-model'&&call&&call.cycleId===review.cycleId&&call.status==='reserved');
    const c=s.cycles.find(c=>c.id===review.cycleId);check(c&&c.status==='running'&&c.policy.version===review.sourcePolicy.version);
    const result=validateReviewChoice({choice:command.choice,support:command.support,counter:command.counter});
    review.choice=result.choice;review.support=result.support;review.counter=result.counter;review.provider=call.provider;review.model=call.model;review.status='kept';
    if(result.choice!=='keep'&&!s.trials.some(t=>['observing','settling'].includes(t.status))) {
      const policy=candidatePolicy(c.policy,result.choice,`paper-${event.id.slice(0,12)}`);validatePolicy(policy);
      const changed=Object.keys(policy).some(k=>k!=='version'&&policy[k as keyof typeof policy]!==c.policy[k as keyof typeof policy]);
      if(changed){
        const account=(policy:typeof c.policy,side:string):PaperCycle=>({id:event.id+'-'+side,startedAt:at,endedAt:null,settleRequestedAt:null,capital:c.capital,status:'running',policy:clone(policy),decisions:[],trades:[],curve:[{at,equity:c.capital,knownNetPnl:'0',fundingComplete:true}],gaps:[]});
        s.trials.push({id:event.id,cycleId:c.id,reviewId:review.id,startedAt:at,endAt:at+TRIAL_RULES.minimumDays*86400000,sourceVersion:c.policy.version,rulesVersion:TRIAL_RULES.version,baseline:account(c.policy,'baseline'),challenger:account(policy,'challenger'),status:'observing',reasons:[],paired:0,advantageBps:null});review.status='trial';
      }
    }
  } else if(command.kind==='trial-check') {
    for(const trial of s.trials.filter(t=>['observing','settling'].includes(t.status))){
      const parent=s.cycles.find(c=>c.id===trial.cycleId);
      if(at>=trial.endAt||!parent||parent.status!=='running'||parent.policy.version!==trial.sourceVersion){
        trial.status='settling';for(const c of [trial.baseline,trial.challenger])if(c.status==='running'){c.status='settling';c.settleRequestedAt=at;cancel(c,'前向对照结束，等待真实后续报价');observe(c,s,at);}
      }
      if(trial.status==='settling'&&[trial.baseline,trial.challenger].every(c=>c.status==='archived')){
        const result=evaluateTrial(trial.baseline,trial.challenger,trial.startedAt,at);trial.paired=result.paired;trial.advantageBps=result.advantageBps;trial.reasons=result.reasons;
        if(parent?.status!=='running'||parent.policy.version!==trial.sourceVersion){trial.status='cancelled';trial.reasons.push('所属周期已结束、暂停或策略已变化');}
        else if(result.eligible){parent.policy=clone(trial.challenger.policy);trial.status='promoted';}
        else trial.status='rejected';
      }
    }
  } else if (command.kind === 'call') {
    const c = s.cycles.find(c => c.id === command.cycleId); check(c && c.status === 'running');
    text(command.provider, 80); text(command.model, 120);
    const recent = s.calls.filter(call => at - call.at < 86400000);
    check((recent.length + 1) * 2 <= c.policy.callsPerDay);
    check(!recent.length || at - recent[recent.length - 1].at >= c.policy.intervalMinutes * 60000);
    s.calls.push({ id: event.id, cycleId: c.id, at, provider: command.provider, model: command.model, status: 'reserved', note: '预留最多两次模型调用；实际 tokens 与费用未知' });
  } else if (command.kind === 'call-result') {
    const call = s.calls.find(call => call.id === command.callId); check(call && call.status === 'reserved');
    check(command.status === 'complete' || command.status === 'failed'); text(command.note, 300);
    call.status = command.status; call.note = command.note;
  } else if (command.kind === 'gap') {
    text(command.reason, 300);
    s.books = {}; // Old quotes cannot satisfy exits or equity after interruption.
    for (const c of [...s.cycles,...s.trials.filter(t=>['observing','settling'].includes(t.status)).flatMap(t=>[t.baseline,t.challenger])].filter(c => c.status !== 'archived')) { cancel(c, '运行中断，未成交委托取消'); c.gaps.push({ at, reason: command.reason }); observe(c, s, at); }
  } else throw new Error('Unknown paper command');
  return s;
}
