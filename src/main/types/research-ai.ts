import type { ChatMessage } from './ai';
import type { ResearchCondition, ResearchEvidence, ResearchFact, ResearchSnapshot } from './research';

export const RESEARCH_AI_LIMITS = Object.freeze({ modelCalls: 2, outputTokensPerCall: 1200, inputCharactersPerCall: 18000, totalMilliseconds: 75000, facts: 40, conditions: 12 });
export type ResearchAITool = 'price_history' | 'open_interest' | 'funding' | 'liquidity';
export type ResearchAIStatus = 'observation' | 'conditional-long' | 'conditional-short';
/** This capability contains no credential, private context, chat history or arbitrary network API. */
export interface ResearchAIProvider {
  provider: string;
  model: string;
  maxOutputTokens: number;
  isCurrent(): boolean;
  chatJSON(messages: ChatMessage[]): Promise<unknown>;
}
export interface ResearchAIRequest { eventId: string; snapshotId: string; }
export interface ResearchAIToolTrace {
  tool: ResearchAITool;
  operation: 'public-evidence-bundle';
  startedAt: number;
  completedAt: number;
  status: 'available' | 'partial' | 'unavailable';
  factIds: string[];
  note: string;
}
export interface ResearchAIResult {
  version: 'research-ai-v1';
  snapshotId: string; eventId: string; symbol: string;
  status: ResearchAIStatus;
  summary: string;
  summaryTemplate: string;
  supportFactIds: string[];
  counterFactIds: string[];
  triggerConditionIds: string[];
  invalidationConditionIds: string[];
  facts: ResearchFact[];
  conditions: ResearchCondition[];
  gaps: string[];
  provider: string; model: string;
  analyzedAt: number; expiresAt: number;
  toolTrace: ResearchAIToolTrace[];
  modelCalls: number;
  /** Existing adapters do not expose actual usage. Never infer billed tokens or costs. */
  usage: null;
  cost: null;
  limits: typeof RESEARCH_AI_LIMITS;
}
export interface ResearchAIDependencies {
  getSnapshot(): ResearchSnapshot | Promise<ResearchSnapshot>;
  getEvidence(symbol: string): Promise<ResearchEvidence>;
  getProvider(): ResearchAIProvider;
  now?: () => number;
}
