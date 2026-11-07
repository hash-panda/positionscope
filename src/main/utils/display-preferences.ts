import { isBinanceUsdtPerpetualSymbol } from './binance-symbol';

export type ColorScheme = 'green-up' | 'red-up';
export interface DisplayPreferences {
  maxDisplayCount: number;
  refreshInterval: number;
  colorScheme: ColorScheme;
  watchlistSymbols: string[];
}
export const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT'];

/** Syntax only. The main-process save handler additionally verifies live Binance metadata. */
export function validateWatchlistSymbols(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 8 || value.some(symbol => !isBinanceUsdtPerpetualSymbol(symbol)) || new Set(value).size !== value.length) {
    throw new Error('观察币种最多 8 个，请使用不重复的 Binance USDT 永续合约代码');
  }
  return [...value];
}

export function validateDisplayPreferences(value: DisplayPreferences): DisplayPreferences {
  if (![1, 2].includes(value.maxDisplayCount) || ![3, 5, 10, 30, 60].includes(value.refreshInterval)) throw new Error('显示数量或刷新间隔无效');
  if (!['green-up', 'red-up'].includes(value.colorScheme)) throw new Error('涨跌配色无效');
  return { ...value, watchlistSymbols: validateWatchlistSymbols(value.watchlistSymbols) };
}
