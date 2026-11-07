import { randomUUID } from 'crypto';
import { PaperLedger } from './ledger';
import { cycleMetrics } from './engine';
import { DEFAULT_PAPER_POLICY, PaperBook, PaperFundingWindow, PaperPolicy } from '../../types/paper';
import type { ResearchSnapshot } from '../../types/research';
import type { ResearchAIResult, ResearchAIRequest } from '../../types/research-ai';
interface Dependencies {
  ledger: PaperLedger;
  market: { snapshot(): Promise<ResearchSnapshot>; getPaperBook(symbol: string): Promise<PaperBook>; getPaperFunding(symbol: string, start: number, end: number): Promise<PaperFundingWindow> };
  provider(): { provider: string; model: string; isCurrent(): boolean };
  analyze(request: ResearchAIRequest): Promise<ResearchAIResult>;
  changed(): void; now?: () => number;
}
/** User-started local simulation. Market/exit polling never waits on a model flight. */
export class PaperController {
  private polling = false;
  private thinking = false;
  private enabled = true;
  private generation = 0;
  private lastPoll = 0;
  private note = '仅本地模拟，不会向交易所下单。';
  private now: () => number;
  constructor(private deps: Dependencies) { this.now = deps.now || Date.now; }
  snapshot() {
    const state = this.deps.ledger.snapshot(), at = this.now();
    return { ...state, metrics: Object.fromEntries(state.cycles.map(c => [c.id, cycleMetrics(c, state.books, at)])),
      note: this.note, thinking: this.thinking, observedAt: at,
      callsReserved24h: state.calls.filter(c => at - c.at < 86400000).length * 2, actualModelCost: null };
  }
  async start(input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('模拟周期参数无效');
    const x = input as Record<string, unknown>;
    if (Object.keys(x).some(k => !['capital','callsPerDay','consent'].includes(k)) || x.consent !== true || typeof x.capital !== 'string' || ![4, 12, 24].includes(x.callsPerDay as number)) throw new Error('请确认模拟本金与模型调用预算');
    this.deps.provider(); // Configuration must be ready, without making a model request.
    const policy: PaperPolicy = { ...DEFAULT_PAPER_POLICY, callsPerDay: x.callsPerDay as number };
    await this.deps.ledger.append({ kind: 'start', capital: x.capital, policy });
    this.generation++; this.note = '模拟运行中；仅在应用运行且联网时观察，模型调用有硬预算。'; this.deps.changed();
    void this.poll(); void this.think(); return this.snapshot();
  }
  async mode(cycleId: unknown, mode: unknown) {
    if (typeof cycleId !== 'string' || !['running','paused','settling'].includes(mode as string)) throw new Error('模拟操作无效');
    if (mode === 'running') this.deps.provider();
    await this.deps.ledger.append({ kind: 'mode', cycleId, mode: mode as 'running'|'paused'|'settling' });
    this.generation++; this.deps.changed(); return this.snapshot();
  }
  async invalidate(reason = '应用重启或配置变更；待成交委托取消，历史保留') {
    this.generation++;
    await this.deps.ledger.append({ kind: 'gap', reason });
    // User must explicitly resume autonomous model work after a restart/configuration change.
    for (const c of this.deps.ledger.snapshot().cycles.filter(c => c.status === 'running')) await this.deps.ledger.append({ kind:'mode',cycleId:c.id,mode:'paused' });
    this.note = '自动开仓已暂停；恢复运行后继续，已有模拟持仓仍按有效行情检查退出。'; this.deps.changed();
  }
  stop() { this.enabled = false; this.generation++; }
  async poll() {
    if (this.polling || !this.enabled) return;
    this.polling = true;
    try {
      const at = this.now();
      if (this.lastPoll && at - this.lastPoll > 60000) { this.generation++; await this.deps.ledger.append({kind:'gap',reason:'行情观察中断，未补造离线成交'}); }
      this.lastPoll = at;
      const state = this.deps.ledger.snapshot();
      const symbols = [...new Set(state.cycles.filter(c => c.status !== 'archived').flatMap(c => [...c.trades.filter(t => !t.exit).map(t => t.symbol), ...c.decisions.filter(d => d.status === 'pending').map(d => d.plan.symbol)]))];
      const quotes = await Promise.allSettled(symbols.slice(0, 6).map(symbol => this.deps.market.getPaperBook(symbol)));
      if (!this.enabled) return;
      let failed = false;
      for (const quote of quotes) {
        if (quote.status === 'fulfilled') await this.deps.ledger.append({kind:'book',book:quote.value}); else failed = true;
      }
      // Settled funding is read separately and at least five minutes behind current time.
      const trades = state.cycles.filter(c => c.status !== 'archived').flatMap(c => c.trades);
      const fundingSymbols = [...new Set(trades.filter(t => t.fundingThrough < (t.exit?.quoteAt ?? at - 300000)).map(t => t.symbol))];
      for (const symbol of fundingSymbols.slice(0,6)) {
        const wanted = trades.filter(t => t.symbol === symbol && t.fundingThrough < (t.exit?.quoteAt ?? at - 300000));
        const start = Math.min(...wanted.map(t => t.fundingThrough));
        const end = Math.min(at - 300000, start + 7 * 86400000);
        if (end < start) continue;
        try { const window = await this.deps.market.getPaperFunding(symbol,start,end); if (this.enabled) await this.deps.ledger.append({kind:'funding',window}); } catch { failed = true; }
      }
      this.note = failed ? '部分盘口或资金费暂不可用，缺口保留；没有补造成交。' : '本地模拟；盘口有时间戳，净值与资金费完整性分开显示。';
    } catch { this.note = '模拟读取或账本校验未通过，原历史保留；本次未确认新成交。'; }
    finally { this.polling = false; this.deps.changed(); }
  }
  async think() {
    if (this.thinking || !this.enabled) return;
    const state = this.deps.ledger.snapshot(), cycle = state.cycles.find(c => c.status === 'running');
    if (!cycle || cycle.trades.filter(t => !t.exit).length >= cycle.policy.maxPositions || cycle.decisions.some(d => d.status === 'pending')) return;
    const calls = state.calls.filter(c => this.now() - c.at < 86400000);
    if ((calls.length + 1) * 2 > cycle.policy.callsPerDay || (calls.length && this.now() - calls[calls.length-1].at < cycle.policy.intervalMinutes * 60000)) return;
    this.thinking = true; this.deps.changed(); const generation = this.generation; let callId: string | undefined;
    try {
      const provider = this.deps.provider();
      const snapshot = await this.deps.market.snapshot();
      if (!this.enabled || generation !== this.generation || snapshot.status === 'unavailable' || snapshot.timestamps.expiresAt <= this.now()) return;
      const open = new Set(cycle.trades.filter(t => !t.exit).map(t => t.symbol));
      const candidates = snapshot.events.filter(e => e.deepResearchEligible && !open.has(e.symbol) && !cycle.decisions.some(d => d.plan.snapshotId === snapshot.snapshotId && d.plan.symbol === e.symbol));
      // Round-robin among the existing bounded research shortlist, not profit-ranked hindsight.
      const event = candidates[calls.length % Math.max(1,candidates.length)]; if (!event) return;
      callId = randomUUID();
      await this.deps.ledger.append({kind:'call',cycleId:cycle.id,provider:provider.provider,model:provider.model},callId);
      const result = await this.deps.analyze({eventId:event.id,snapshotId:snapshot.snapshotId});
      const current = this.deps.ledger.snapshot().cycles.find(c => c.id === cycle.id);
      if (!this.enabled || generation !== this.generation || !provider.isCurrent() || current?.status !== 'running' || result.expiresAt <= this.now() || result.symbol !== event.symbol || result.snapshotId !== snapshot.snapshotId || result.provider !== provider.provider || result.model !== provider.model) throw new Error('Research changed');
      const triggers = result.triggerConditionIds.length > 0 && result.triggerConditionIds.every(id => result.conditions.some(c => c.id === id && c.state === 'met'));
      const invalid = result.invalidationConditionIds.some(id => !result.conditions.some(c => c.id === id && c.state === 'not-met'));
      const direction = triggers && !invalid && result.status !== 'observation' ? result.status === 'conditional-long' ? 'long' : 'short' : 'abstain';
      await this.deps.ledger.append({kind:'decision',cycleId:cycle.id,plan:{symbol:event.symbol,direction,
        reason:direction === 'abstain' ? '未满足完整触发条件，保持观察。' : result.summary,
        evidence:result.facts,conditions:result.conditions,evidenceIds:[...result.supportFactIds,...result.counterFactIds],snapshotId:result.snapshotId,provider:result.provider,model:result.model}});
      await this.deps.ledger.append({kind:'call-result',callId,status:'complete',note:'已校验研究条件，结果已冻结；实际模型费用未知'}); callId = undefined;
    } catch {
      if (callId && this.enabled) await this.deps.ledger.append({kind:'call-result',callId,status:'failed',note:'研究或配置校验失败，预算保留占用；没有生成模拟成交'}).catch(()=>undefined);
      this.note = '本次 AI 查证未通过；未生成模拟交易，失败记录保留。';
    } finally { this.thinking = false; this.deps.changed(); }
  }
}

export type PaperSnapshot = ReturnType<PaperController["snapshot"]>;
