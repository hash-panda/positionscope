import type { ResearchFact, ResearchCondition } from './research';
export interface PaperPolicy {
  version: string;
  allocationBps: number; riskBps: number; stopBps: number; targetBps: number;
  maxHoldMinutes: number; maxPositions: number; feeBps: number; slippageBps: number;
  callsPerDay: number; intervalMinutes: number;
}
export const DEFAULT_PAPER_POLICY: PaperPolicy = Object.freeze({ version: 'paper-v1', allocationBps: 2000,
  riskBps: 100, stopBps: 200, targetBps: 400, maxHoldMinutes: 240, maxPositions: 3,
  feeBps: 5, slippageBps: 2, callsPerDay: 12, intervalMinutes: 30 });
export interface PaperBook {
  symbol: string; updateId: string; observedAt: number; fetchedAt: number;
  bids: [string, string][]; asks: [string, string][];
  stepSize: string; minQty: string; maxQty: string; minNotional: string;
}
export interface PaperPlan {
  symbol: string; direction: 'long' | 'short' | 'abstain';
  reason: string; evidence: ResearchFact[]; conditions: ResearchCondition[]; evidenceIds: string[]; snapshotId: string; provider: string; model: string;
}
export interface PaperDecision {
  id: string; at: number; plan: PaperPlan; policy: PaperPolicy;
  status: 'pending' | 'filled' | 'abstained' | 'rejected' | 'expired' | 'cancelled'; note: string;
}
export interface PaperFill {
  at: number; quoteId: string; quoteAt: number; quantity: string; price: string; notional: string; fee: string;
  reason: 'entry' | 'stop' | 'target' | 'time' | 'cycle-end';
}
export interface PaperTrade {
  id: string; symbol: string; direction: 'long' | 'short'; policyVersion: string;
  entry: PaperFill; exit: PaperFill | null; stop: string; target: string; dueAt: number;
  grossPnl: string; fees: string; funding: string; fundingThrough: number;
  fundingIds: string[]; policy: PaperPolicy;
}
export interface PaperEquity { at: number; equity: string | null; knownNetPnl: string | null; fundingComplete: boolean; }
export interface PaperCycle {
  id: string; startedAt: number; endedAt: number | null; settleRequestedAt: number | null; capital: string;
  status: 'running' | 'paused' | 'settling' | 'archived'; policy: PaperPolicy;
  decisions: PaperDecision[]; trades: PaperTrade[]; curve: PaperEquity[];
  gaps: { at: number; reason: string }[];
}
export interface PaperCall { id: string; cycleId: string; at: number; provider: string; model: string; status: 'reserved' | 'complete' | 'failed'; note: string; }
export interface PaperState { version: 'paper-ledger-v1'; cycles: PaperCycle[]; books: Record<string, PaperBook>; calls: PaperCall[]; }
export interface PaperFundingWindow {
  symbol: string; start: number; end: number;
  rows: { time: number; rate: string; markPrice: string }[];
}
export type PaperCommand =
  | { kind: 'start'; capital: string; policy: PaperPolicy }
  | { kind: 'mode'; cycleId: string; mode: 'running' | 'paused' | 'settling' }
  | { kind: 'decision'; cycleId: string; plan: PaperPlan }
  | { kind: 'book'; book: PaperBook }
  | { kind: 'funding'; window: PaperFundingWindow }
  | { kind: 'call'; cycleId: string; provider: string; model: string }
  | { kind: 'call-result'; callId: string; status: 'complete' | 'failed'; note: string }
  | { kind: 'gap'; reason: string };
export interface PaperEvent { id: string; at: number; command: PaperCommand; }
