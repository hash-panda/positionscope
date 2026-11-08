import { promises as fs } from 'fs';
import { dirname } from 'path';
import { randomUUID, createHash } from 'crypto';
import { isBinanceUsdtPerpetualSymbol } from '../../utils/binance-symbol';
import type { LedgerObservation, PublicResearchSample, PublicSampleOutcome, ResearchAlert, ResearchAlertInput, ResearchJudgmentInput, ResearchLedgerSnapshot, ResearchRecord, ResearchShadow, ShadowRegistration } from '../../types/research-ledger';

export type ResearchLedgerFileSystem = Pick<typeof fs, 'readFile' | 'open' | 'mkdir' | 'rename' | 'unlink' | 'chmod'>;
export interface ResearchLedgerOptions { filePath?: string; fileSystem?: ResearchLedgerFileSystem; now?: () => number; maxRecords?: number; }
interface StoredLedger extends ResearchLedgerSnapshot { latestSamples: PublicResearchSample[]; }
export const MAX_ACTIVE_RESEARCH_SYMBOLS = 32;
const MAX_AGE = 120_000, MAX_OBSERVATIONS = 60, MAX_FILE_BYTES = 8 * 1024 * 1024;
const LIMITATIONS = [
  '仅保存 Binance 公共研究，关注和提醒均不代表委托或成交。',
  '原始判断冻结；后续观察追加。保留失败、弃权和未触发结果，数量上限会按时间淘汰。',
  '影子实验仅使用登记后的下一新鲜最新成交价；不是可执行报价或真实交易。',
  '手续费、滑点和资金费未知，净收益不可得；不计算胜率、夏普或盈利预测。',
  '离线或报价缺口会使影子实验删失；不得仅挑选完成样本证明效果。',
  '影子实验是自选样本、固定期限、无杠杆的价格变化观察；不代表全量策略或合约收益。',
];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function obj(value: unknown): Record<string, any> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid public research data'); return value as Record<string, any>; }
function text(value: unknown, max = 240): string { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new Error('Invalid research text'); return value; }
function number(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid research number'); return value; }
function time(value: unknown): number { const n = number(value); if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid research timestamp'); return n; }
function oneOf<T extends string>(value: unknown, choices: readonly T[]): T { if (!choices.includes(value as T)) throw new Error('Invalid research enum'); return value as T; }
function list<T>(value: unknown, maximum: number, parse: (value: unknown) => T): T[] { if (!Array.isArray(value) || value.length > maximum) throw new Error('Invalid research list'); return value.map(parse); }
function symbol(value: unknown): string { if (!isBinanceUsdtPerpetualSymbol(value)) throw new Error('Invalid Binance perpetual symbol'); return value; }
const PUBLIC_PATHS = new Set(['/fapi/v1/exchangeInfo', '/fapi/v1/ticker/24hr', '/fapi/v1/ticker/price', '/fapi/v1/ticker/bookTicker', '/fapi/v1/premiumIndex', '/fapi/v1/depth', '/fapi/v1/klines', '/fapi/v1/fundingRate', '/fapi/v1/openInterest', '/futures/data/openInterestHist']);
function publicSource(value: unknown): string {
  const source = text(value, 350), path = source.startsWith('https://fapi.binance.com/') ? source.slice('https://fapi.binance.com'.length) : source;
  if (!PUBLIC_PATHS.has(path)) throw new Error('Only documented public Binance evidence may be stored');
  return source;
}
function nullableText(value: unknown): string | null { return value == null ? null : text(value, 160); }
function parseJudgment(input: unknown): ResearchJudgmentInput {
  const x = obj(input);
  return { eventId: text(x.eventId), snapshotId: text(x.snapshotId), symbol: symbol(x.symbol), ruleVersion: text(x.ruleVersion, 100),
    provider: nullableText(x.provider), model: nullableText(x.model), decidedAt: time(x.decidedAt),
    decision: oneOf(x.decision, ['hypothesis', 'abstain', 'failed']), direction: oneOf(x.direction, ['long', 'short', 'neutral']), summary: text(x.summary, 1800),
    facts: list(x.facts, 48, item => { const f = obj(item); return { id: text(f.id), label: text(f.label), value: number(f.value), unit: text(f.unit, 40), source: publicSource(f.source), observedAt: time(f.observedAt), fetchedAt: time(f.fetchedAt), window: text(f.window, 100) }; }),
    conditions: list(x.conditions, 16, item => text(item, 350)), invalidation: list(x.invalidation, 16, item => text(item, 350)), gaps: list(x.gaps, 24, item => text(item, 350)) };
}
function parseSample(input: unknown): PublicResearchSample {
  const x = obj(input), metric = oneOf(x.metric, ['price', 'funding', 'openInterest']), source = oneOf(x.source, ['binance-last-price', 'binance-funding-rate', 'binance-open-interest']);
  const expected = { price: 'binance-last-price', funding: 'binance-funding-rate', openInterest: 'binance-open-interest' };
  const value = number(x.value);
  if (source !== expected[metric] || (metric === 'price' && value <= 0) || (metric === 'openInterest' && value < 0)) throw new Error('Invalid public research sample');
  return { id: text(x.id), symbol: symbol(x.symbol), metric, value, observedAt: time(x.observedAt), fetchedAt: time(x.fetchedAt), source };
}
function fresh(sample: PublicResearchSample, now: number): boolean {
  return sample.observedAt <= now + 5000 && sample.fetchedAt <= now + 5000 && sample.observedAt <= sample.fetchedAt + 5000 && now - sample.observedAt <= MAX_AGE && now - sample.fetchedAt <= MAX_AGE;
}
function parseAlertInput(input: unknown): ResearchAlertInput {
  const x = obj(input), metric = oneOf(x.metric, ['price', 'funding', 'openInterest']), threshold = number(x.threshold);
  if ((metric === 'price' && threshold <= 0) || (metric === 'openInterest' && threshold < 0)) throw new Error('Invalid alert threshold');
  return { symbol: symbol(x.symbol), metric, operator: oneOf(x.operator, ['above', 'below']), threshold, recordId: nullableText(x.recordId) };
}
function parseObservation(input: unknown): LedgerObservation { const x = obj(input); return { id: text(x.id), at: time(x.at), kind: oneOf(x.kind, ['follow-up', 'alert-triggered', 'expired', 'invalidated', 'failed']), message: text(x.message, 1200), sampleId: nullableText(x.sampleId) }; }
function append(record: ResearchRecord, observation: LedgerObservation): void {
  if (observation.sampleId && record.observations.some(o => o.kind === observation.kind && o.sampleId === observation.sampleId)) return;
  record.observations.push(observation);
  if (record.observations.length > MAX_OBSERVATIONS) { record.observations.shift(); record.omittedObservations++; }
}
function assertActiveCapacity(state: StoredLedger): void {
  const symbols = new Set([
    ...state.alerts.filter(a => a.status === 'armed').map(a => a.symbol),
    ...state.shadows.filter(s => s.status === 'awaiting-entry' || s.status === 'observing').map(s => s.symbol),
  ]);
  if (symbols.size > MAX_ACTIVE_RESEARCH_SYMBOLS) throw new Error('Active research monitoring is limited to 32 symbols');
}
const sampleKey = (s: PublicResearchSample) => `${s.symbol}:${s.metric}`;
const isMet = (a: ResearchAlert, s: PublicResearchSample) => a.operator === 'above' ? s.value > a.threshold : s.value < a.threshold;
function parseState(input: unknown, maxRecords: number): StoredLedger {
  const x = obj(input);
  if (x.version !== 'research-ledger-v1') throw new Error('Unsupported research ledger');
  const records = list(x.records, 500, item => { const r = obj(item); return { id: text(r.id), recordedAt: time(r.recordedAt), judgment: parseJudgment(r.judgment), observations: list(r.observations, MAX_OBSERVATIONS, parseObservation), omittedObservations: time(r.omittedObservations) }; });
  const alerts = list(x.alerts, 200, item => { const a = obj(item); return { ...parseAlertInput(a), id: text(a.id), createdAt: time(a.createdAt), armedAt: time(a.armedAt), status: oneOf(a.status, ['armed', 'triggered']), baseline: a.baseline == null ? null : parseSample(a.baseline), triggeredAt: a.triggeredAt == null ? null : time(a.triggeredAt), triggerSample: a.triggerSample == null ? null : parseSample(a.triggerSample) }; });
  const shadows = list(x.shadows, 500, item => {
    const s = obj(item), horizonMs = time(s.horizonMs);
    if (horizonMs < 60_000 || horizonMs > 30 * 86400_000 || s.basis !== 'next-observed-last-price-indicative') throw new Error('Invalid shadow experiment');
    return { id: text(s.id), recordId: text(s.recordId), symbol: symbol(s.symbol), direction: oneOf(s.direction, ['long', 'short']), registeredAt: time(s.registeredAt), horizonMs,
      entryDeadline: time(s.entryDeadline), exitDueAt: s.exitDueAt == null ? null : time(s.exitDueAt), status: oneOf(s.status, ['awaiting-entry', 'observing', 'complete', 'censored']),
      entry: s.entry == null ? null : parseSample(s.entry), exit: s.exit == null ? null : parseSample(s.exit), reason: nullableText(s.reason),
      grossPriceReturnPercent: s.grossPriceReturnPercent == null ? null : number(s.grossPriceReturnPercent), buyHoldPriceReturnPercent: s.buyHoldPriceReturnPercent == null ? null : number(s.buyHoldPriceReturnPercent),
      noActionReturnPercent: 0 as const, netReturnPercent: null, fees: 'unknown' as const, slippage: 'unknown' as const, funding: 'unknown' as const, basis: 'next-observed-last-price-indicative' as const };
  });
  for (const alert of alerts) {
    for (const sample of [alert.baseline, alert.triggerSample]) if (sample && (sample.symbol !== alert.symbol || sample.metric !== alert.metric)) throw new Error('Invalid stored alert evidence');
    if ((alert.status === 'triggered') !== (alert.triggerSample != null && alert.triggeredAt != null)) throw new Error('Invalid stored alert state');
    if (alert.status === 'armed' && (alert.triggerSample != null || alert.triggeredAt != null)) throw new Error('Invalid stored alert state');
  }
  for (const shadow of shadows) {
    if (shadow.entryDeadline !== shadow.registeredAt + MAX_AGE) throw new Error('Invalid shadow entry window');
    for (const sample of [shadow.entry, shadow.exit]) if (sample && (sample.symbol !== shadow.symbol || sample.metric !== 'price' || sample.observedAt <= shadow.registeredAt || sample.fetchedAt <= shadow.registeredAt)) throw new Error('Invalid shadow price evidence');
    if (shadow.entry && (shadow.entry.observedAt > shadow.entryDeadline || shadow.exitDueAt !== shadow.entry.observedAt + shadow.horizonMs)) throw new Error('Invalid shadow entry');
    if (!shadow.entry && shadow.exitDueAt != null) throw new Error('Invalid shadow horizon');
    if (shadow.status === 'awaiting-entry' && shadow.entry) throw new Error('Invalid shadow state');
    if (shadow.status === 'observing' && !shadow.entry) throw new Error('Invalid shadow state');
    if (shadow.status === 'complete') {
      if (!shadow.entry || !shadow.exit || shadow.exitDueAt == null || shadow.exit.observedAt < shadow.exitDueAt || shadow.exit.observedAt > shadow.exitDueAt + MAX_AGE) throw new Error('Invalid shadow exit');
      const hold = (shadow.exit.value / shadow.entry.value - 1) * 100;
      if (!Number.isFinite(hold)) throw new Error('Invalid shadow return');
      shadow.buyHoldPriceReturnPercent = hold; shadow.grossPriceReturnPercent = shadow.direction === 'long' ? hold : -hold;
    } else if (shadow.exit || shadow.grossPriceReturnPercent != null || shadow.buyHoldPriceReturnPercent != null) throw new Error('Invalid incomplete shadow result');
  }
  const retention = obj(x.retention), omittedRecords = time(retention.omittedRecords) + Math.max(0, records.length - maxRecords);
  for (const entries of [records, alerts, shadows]) if (new Set(entries.map(item => item.id)).size !== entries.length) throw new Error('Duplicate ledger identifiers');
  const state: StoredLedger = { version: 'research-ledger-v1', records: records.slice(-maxRecords), watchedSymbols: [...new Set(list(x.watchedSymbols, 100, symbol))], alerts, shadows,
    retention: { maxRecords, omittedRecords, omittedShadows: time(retention.omittedShadows) }, latestSamples: list(x.latestSamples, 300, parseSample), limitations: [...LIMITATIONS] };
  assertActiveCapacity(state);
  return state;
}

/** Public-only, transactional append ledger. The host supplies the application directory. */
export class ResearchLedger {
  private state: StoredLedger;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly now: () => number;
  private readonly io: ResearchLedgerFileSystem;
  private constructor(private readonly options: ResearchLedgerOptions) {
    this.now = options.now ?? Date.now; this.io = options.fileSystem ?? fs;
    const maximum = options.maxRecords ?? 500;
    if (!Number.isInteger(maximum) || maximum < 1 || maximum > 500) throw new Error('Invalid ledger retention');
    this.state = { version: 'research-ledger-v1', records: [], watchedSymbols: [], alerts: [], shadows: [], latestSamples: [], retention: { maxRecords: maximum, omittedRecords: 0, omittedShadows: 0 }, limitations: [...LIMITATIONS] };
  }
  /** Explicit delete-all recovery only: the host must first stop polling and pending writes.
   * Unlinks exactly the supplied ledger path without parsing or echoing corrupt contents. */
  static async eraseFile(filePath: string, fileSystem: Pick<typeof fs, 'unlink'> = fs): Promise<boolean> {
    try { await fileSystem.unlink(filePath); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw new Error('Research ledger could not be removed'); }
  }
  static async open(options: ResearchLedgerOptions = {}): Promise<ResearchLedger> {
    const ledger = new ResearchLedger(options);
    if (options.filePath) {
      let content: string;
      try { content = await ledger.io.readFile(options.filePath, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ledger; throw new Error('Research ledger could not be read'); }
      try {
        if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) throw new Error('Research ledger too large');
        ledger.state = parseState(JSON.parse(content), ledger.state.retention.maxRecords);
        await ledger.io.chmod(options.filePath, 0o600);
      } catch { throw new Error('Research ledger is invalid; original file was not changed'); }
    }
    return ledger;
  }
  snapshot(): ResearchLedgerSnapshot { const { latestSamples: _latest, ...publicState } = this.state; return clone(publicState); }
  clearAll(): Promise<boolean> {
    return this.change(state => { state.records = []; state.watchedSymbols = []; state.alerts = []; state.shadows = []; state.latestSamples = []; state.retention.omittedRecords = 0; state.retention.omittedShadows = 0; return true; });
  }
  private async save(next: StoredLedger): Promise<void> {
    if (!this.options.filePath) return;
    const data = JSON.stringify(next);
    if (Buffer.byteLength(data, 'utf8') > MAX_FILE_BYTES) throw new Error('Research ledger storage limit reached');
    const temporary = `${this.options.filePath}.${randomUUID()}.tmp`;
    try {
      await this.io.mkdir(dirname(this.options.filePath), { recursive: true, mode: 0o700 });
      const file = await this.io.open(temporary, 'wx', 0o600);
      try { await file.writeFile(data, 'utf8'); await file.sync(); }
      finally { await file.close(); }
      await this.io.rename(temporary, this.options.filePath);
    } catch { await this.io.unlink(temporary).catch(() => undefined); throw new Error('Research ledger could not be saved'); }
  }
  private change<T>(operation: (next: StoredLedger, now: number) => T): Promise<T> {
    const run = this.queue.then(async () => { const next = clone(this.state), result = operation(next, time(this.now())); assertActiveCapacity(next); await this.save(next); this.state = next; return clone(result); });
    this.queue = run.catch(() => undefined); return run;
  }
  recordJudgment(input: ResearchJudgmentInput): Promise<ResearchRecord> {
    // Parse before enqueue so caller mutation cannot alter the frozen input.
    const judgment = parseJudgment(input);
    return this.change((state, now) => {
      if (judgment.decidedAt > now + 5000) throw new Error('Judgment timestamp is in the future');
      const id = createHash('sha256').update(JSON.stringify(judgment)).digest('hex').slice(0, 32);
      const existing = state.records.find(r => r.id === id); if (existing) return existing;
      const record: ResearchRecord = { id, recordedAt: now, judgment, observations: [], omittedObservations: 0 };
      state.records.push(record);
      if (state.records.length > state.retention.maxRecords) { state.records.shift(); state.retention.omittedRecords++; }
      return record;
    });
  }
  addObservation(recordId: string, input: Pick<LedgerObservation, 'kind' | 'message'> & { sampleId?: string | null }): Promise<ResearchRecord> {
    const safe = { kind: oneOf(input.kind, ['follow-up', 'alert-triggered', 'expired', 'invalidated', 'failed']), message: text(input.message, 1200), sampleId: nullableText(input.sampleId) };
    return this.change((state, now) => { const record = state.records.find(r => r.id === recordId); if (!record) throw new Error('Research record not found'); append(record, { ...safe, id: randomUUID(), at: now }); return record; });
  }
  setWatched(input: string, watched: boolean): Promise<string[]> {
    const value = symbol(input); if (typeof watched !== 'boolean') throw new Error('Invalid follow setting');
    return this.change(state => { state.watchedSymbols = state.watchedSymbols.filter(s => s !== value); if (watched) { if (state.watchedSymbols.length >= 100) throw new Error('Watchlist limit reached'); state.watchedSymbols.push(value); } return state.watchedSymbols; });
  }
  createAlert(input: ResearchAlertInput): Promise<ResearchAlert> {
    const safe = parseAlertInput(input);
    return this.change((state, now) => {
      if (state.alerts.length >= 200) throw new Error('Alert limit reached');
      if (safe.recordId && !state.records.some(r => r.id === safe.recordId && r.judgment.symbol === safe.symbol)) throw new Error('Alert research record not found');
      const baseline = state.latestSamples.find(s => s.symbol === safe.symbol && s.metric === safe.metric && fresh(s, now)) ?? null;
      const alert: ResearchAlert = { ...safe, id: randomUUID(), createdAt: now, armedAt: now, status: 'armed', baseline, triggeredAt: null, triggerSample: null };
      state.alerts.push(alert); return alert;
    });
  }
  rearmAlert(id: string): Promise<ResearchAlert> {
    return this.change((state, now) => { const alert = state.alerts.find(a => a.id === id); if (!alert) throw new Error('Alert not found'); alert.status = 'armed'; alert.armedAt = now; alert.triggeredAt = null; alert.triggerSample = null; alert.baseline = state.latestSamples.find(s => s.symbol === alert.symbol && s.metric === alert.metric && fresh(s, now)) ?? null; return alert; });
  }
  removeAlert(id: string): Promise<boolean> { return this.change(state => { const found = state.alerts.some(a => a.id === id); state.alerts = state.alerts.filter(a => a.id !== id); return found; }); }
  registerShadow(input: ShadowRegistration): Promise<ResearchShadow> {
    if (input.acknowledgeIndicative !== true || !Number.isSafeInteger(input.horizonMs) || input.horizonMs < 60_000 || input.horizonMs > 30 * 86400_000) throw new Error('Explicit indicative experiment and valid horizon required');
    const recordId = text(input.recordId), horizonMs = input.horizonMs;
    return this.change((state, now) => {
      const record = state.records.find(r => r.id === recordId);
      if (!record || record.judgment.decision !== 'hypothesis' || record.judgment.direction === 'neutral') throw new Error('Directional hypothesis required');
      if (state.shadows.some(s => s.recordId === recordId)) throw new Error('A frozen judgment may register only one experiment');
      const shadow: ResearchShadow = { id: randomUUID(), recordId, symbol: record.judgment.symbol, direction: record.judgment.direction, registeredAt: now, horizonMs, entryDeadline: now + MAX_AGE, exitDueAt: null,
        status: 'awaiting-entry', entry: null, exit: null, reason: null, grossPriceReturnPercent: null, buyHoldPriceReturnPercent: null, noActionReturnPercent: 0, netReturnPercent: null,
        fees: 'unknown', slippage: 'unknown', funding: 'unknown', basis: 'next-observed-last-price-indicative' };
      if (state.shadows.length >= 500) { const old = state.shadows.findIndex(s => s.status === 'complete' || s.status === 'censored'); if (old < 0) throw new Error('Active experiment limit reached'); state.shadows.splice(old, 1); state.retention.omittedShadows++; }
      state.shadows.push(shadow); return shadow;
    });
  }
  observePublicSamples(inputs: PublicResearchSample[]): Promise<PublicSampleOutcome> {
    const samples = list(inputs, 300, parseSample).sort((a, b) => a.observedAt - b.observedAt);
    return this.change((state, now) => {
      const result: PublicSampleOutcome = { triggeredAlerts: [], completedShadows: [] };
      for (const sample of samples) {
        if (!fresh(sample, now)) continue;
        const previous = state.latestSamples.find(s => sampleKey(s) === sampleKey(sample));
        if (previous && (sample.id === previous.id || sample.observedAt <= previous.observedAt)) continue;
        state.latestSamples = state.latestSamples.filter(s => sampleKey(s) !== sampleKey(sample)); state.latestSamples.push(sample); state.latestSamples = state.latestSamples.slice(-300);
        for (const alert of state.alerts) {
          if (alert.status !== 'armed' || alert.symbol !== sample.symbol || alert.metric !== sample.metric || sample.observedAt <= alert.armedAt || sample.fetchedAt <= alert.armedAt) continue;
          const baseline = alert.baseline;
          alert.baseline = sample;
          if (!baseline || sample.observedAt - baseline.observedAt > MAX_AGE || !fresh(baseline, now) || isMet(alert, baseline) || !isMet(alert, sample)) continue;
          alert.status = 'triggered'; alert.triggeredAt = now; alert.triggerSample = sample; result.triggeredAlerts.push(alert);
          const record = state.records.find(r => r.id === alert.recordId);
          if (record) append(record, { id: randomUUID(), at: now, kind: 'alert-triggered', message: `公共 ${sample.metric} 条件越界；仅提醒，不代表成交。`, sampleId: sample.id });
        }
        if (sample.metric !== 'price') continue;
        for (const shadow of state.shadows) {
          if (shadow.symbol !== sample.symbol || sample.observedAt <= shadow.registeredAt || sample.fetchedAt <= shadow.registeredAt) continue;
          if (shadow.status === 'awaiting-entry' && sample.observedAt <= shadow.entryDeadline) { shadow.entry = sample; shadow.exitDueAt = sample.observedAt + shadow.horizonMs; shadow.status = 'observing'; }
          else if (shadow.status === 'observing' && shadow.exitDueAt != null && sample.observedAt >= shadow.exitDueAt && sample.observedAt <= shadow.exitDueAt + MAX_AGE) {
            const holdReturn = (sample.value / shadow.entry!.value - 1) * 100;
            if (!Number.isFinite(holdReturn)) { shadow.status = 'censored'; shadow.reason = '报价数值范围无效，不能复算价格变化。'; continue; }
            shadow.exit = sample; shadow.buyHoldPriceReturnPercent = holdReturn; shadow.grossPriceReturnPercent = shadow.direction === 'long' ? holdReturn : -holdReturn; shadow.status = 'complete';
            result.completedShadows.push(shadow);
          }
        }
      }
      for (const shadow of state.shadows) {
        if (shadow.status === 'awaiting-entry' && now > shadow.entryDeadline) { shadow.status = 'censored'; shadow.reason = '登记后未及时收到新鲜报价，未建立模拟观察。'; }
        else if (shadow.status === 'observing' && shadow.exitDueAt != null && now > shadow.exitDueAt + MAX_AGE) { shadow.status = 'censored'; shadow.reason = '到期报价缺失或程序离线；不使用更晚价格补写结果。'; }
      }
      return result;
    });
  }
}
