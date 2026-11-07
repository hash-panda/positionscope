/** Only public Binance research belongs here. Never pass an account snapshot or credentials. */
export type LedgerDirection = 'long' | 'short' | 'neutral';
export type LedgerDecision = 'hypothesis' | 'abstain' | 'failed';
export interface LedgerFact {
  id: string; label: string; value: number; unit: string; source: string;
  observedAt: number; fetchedAt: number; window: string;
}
export interface ResearchJudgmentInput {
  eventId: string; snapshotId: string; symbol: string; ruleVersion: string;
  provider: string | null; model: string | null; decidedAt: number;
  decision: LedgerDecision; direction: LedgerDirection; summary: string;
  facts: LedgerFact[]; conditions: string[]; invalidation: string[]; gaps: string[];
}
export interface LedgerObservation {
  id: string; at: number; kind: 'follow-up' | 'alert-triggered' | 'expired' | 'invalidated' | 'failed';
  message: string; sampleId: string | null;
}
export interface ResearchRecord {
  id: string; recordedAt: number; judgment: ResearchJudgmentInput;
  observations: LedgerObservation[]; omittedObservations: number;
}
export type AlertMetric = 'price' | 'funding' | 'openInterest';
export interface PublicResearchSample {
  /** Unique source snapshot identifier; the same sample must not be reapplied. */
  id: string; symbol: string; metric: AlertMetric; value: number;
  observedAt: number; fetchedAt: number;
  /** Price samples use last traded price. Mark price must not enter price simulations. */
  source: 'binance-last-price' | 'binance-funding-rate' | 'binance-open-interest';
}
export interface ResearchAlertInput {
  symbol: string; metric: AlertMetric; operator: 'above' | 'below'; threshold: number;
  recordId?: string | null;
}
export interface ResearchAlert extends ResearchAlertInput {
  id: string; createdAt: number; armedAt: number; status: 'armed' | 'triggered';
  baseline: PublicResearchSample | null; triggeredAt: number | null; triggerSample: PublicResearchSample | null;
}
export interface ShadowRegistration {
  recordId: string; horizonMs: number;
  /** Explicit opt-in, since price-only shadow experiments are not execution or profitability evidence. */
  acknowledgeIndicative: true;
}
export interface ResearchShadow {
  id: string; recordId: string; symbol: string; direction: 'long' | 'short'; registeredAt: number;
  horizonMs: number; entryDeadline: number; exitDueAt: number | null;
  status: 'awaiting-entry' | 'observing' | 'complete' | 'censored';
  entry: PublicResearchSample | null; exit: PublicResearchSample | null; reason: string | null;
  grossPriceReturnPercent: number | null; buyHoldPriceReturnPercent: number | null;
  noActionReturnPercent: 0;
  netReturnPercent: null; fees: 'unknown'; slippage: 'unknown'; funding: 'unknown';
  basis: 'next-observed-last-price-indicative';
}
export interface ResearchLedgerSnapshot {
  version: 'research-ledger-v1'; records: ResearchRecord[]; watchedSymbols: string[];
  alerts: ResearchAlert[]; shadows: ResearchShadow[];
  retention: { maxRecords: number; omittedRecords: number; omittedShadows: number };
  /** Never infer live execution, net performance, win rate or Sharpe from these records. */
  limitations: string[];
}
export interface PublicSampleOutcome { triggeredAlerts: ResearchAlert[]; completedShadows: ResearchShadow[]; }
