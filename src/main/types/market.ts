export interface MarketRow {
  symbol: string; baseAsset: string; lastPrice: number; change24h: number; quoteVolume24h: number;
  onboardAt: number | null; exchangeTimestamp: number; fetchedAt: number;
}
export interface AssetContext {
  symbol: string; baseAsset: string; fetchedAt: number;
  mark: {price: number; lastFundingRate: number; nextFundingAt: number; exchangeTimestamp: number} | null;
  funding: {intervalHours: number | null; intervalBasis: 'announced' | 'observed' | 'unknown'; lastSettledRate: number | null; lastSettledAt: number | null} | null;
  openInterest: {baseQuantity: number; exchangeTimestamp: number} | null;
  history: {interval: '1h'; samples: number; start: number; end: number; priceChange: number; maxDrawdown: number; annualizedPriceVolatility: number | null} | null;
  gaps: string[];
}
export interface MarketSnapshot {
  version: 'market-context-v1'; source: 'Binance USD-M public REST'; fetchedAt: number;
  status: 'available' | 'partial' | 'unavailable';
  breadth: {eligibleContracts: number; pricedContracts: number; rising: number; falling: number; flat: number; medianChange24h: number; quoteVolume24h: number} | null;
  active: MarketRow[]; recentListings: MarketRow[]; assets: AssetContext[]; unavailableSymbols: string[];
  notes: string[]; sources: string[];
}
export interface FundingScenario {exchange: string; symbol: string; referenceRate: number; nextFundingAt: number; retainedShare: number; estimatedCashflow: number}
