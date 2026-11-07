/** Public Binance research only. All percentages are percentage points unless unit says ratio. */
export type ResearchEventKind = 'relative-strength' | 'relative-weakness' | 'active-turnover' | 'funding-extreme' | 'exploration';
export type ResearchDirection = 'long' | 'short' | 'neutral';
export interface ResearchFact {
  id: string; label: string; value: number; unit: 'USDT' | 'base' | 'percent' | 'ratio' | 'hours' | 'contracts';
  source: string; observedAt: number; fetchedAt: number; window: string;
}
export interface ResearchCondition { id: string; label: string; factIds: string[]; state: 'met' | 'not-met' | 'unknown'; }
export interface ResearchEvent {
  id: string; snapshotId: string; ruleVersion: string; symbol: string; baseAsset: string;
  kind: ResearchEventKind; direction: ResearchDirection; title: string; reason: string;
  priority: number; detectedAt: number; expiresAt: number;
  facts: ResearchFact[]; gaps: string[]; deepResearchEligible: boolean;
}
export interface ResearchSnapshot {
  version: 'research-snapshot-v1'; ruleVersion: string; snapshotId: string;
  status: 'available' | 'partial' | 'unavailable'; events: ResearchEvent[];
  breadth: { eligible: number; priced: number; rising: number; falling: number; flat: number; medianChange24h: number | null; quoteVolume24h: number };
  coverage: { universe: 'Binance USDT perpetual'; eligible: number; tickerValid: number; fundingValid: number; aboveTurnoverFloor: number; deepResearchBudget: number; selected: string[]; excluded: number; turnoverFloorUSDT: number; scope: string };
  timestamps: { fetchedAt: number; expiresAt: number; tickerOldestAt: number | null; fundingOldestAt: number | null };
  gaps: string[];
}
export interface ResearchLiquidity {
  spreadBps: number | null; midPrice: number | null;
  bidDepth1pctUSDT: number | null; askDepth1pctUSDT: number | null;
  bidBandCovered: boolean; askBandCovered: boolean;
  assumedOrderUSDT: 1000;
  buyImpactBps: number | null; sellImpactBps: number | null;
  buyFilled: boolean; sellFilled: boolean;
  observedAt: number | null; source: string; notes: string[];
}
export interface ResearchEvidence {
  version: 'research-evidence-v1'; ruleVersion: string; snapshotId: string; symbol: string;
  fetchedAt: number; expiresAt: number; status: 'available' | 'partial' | 'unavailable';
  facts: ResearchFact[];
  changes: { price1hPercent: number | null; price24hPercent: number | null; openInterest1hPercent: number | null; settledFundingRate: number | null };
  liquidity: ResearchLiquidity; conditions: ResearchCondition[]; gaps: string[];
}
export interface PublicResearchTransport { get(path: string, config: { params?: Record<string, string | number>; timeout: number }): Promise<{ data: unknown }>; }

/** Funding values use raw ratios: 0.001 is 0.10%, never annualized. */
export interface PublicResearchSample { id: string; symbol: string; metric: 'price' | 'funding'; value: number; observedAt: number; fetchedAt: number; source: 'binance-last-price' | 'binance-funding-rate'; }

/** change24hPercent is percentage points (2 means +2%), not a ratio. */
export interface ResearchWatchQuote { symbol: string; baseAsset: string; lastPrice: number; change24hPercent: number; observedAt: number; fetchedAt: number; }
