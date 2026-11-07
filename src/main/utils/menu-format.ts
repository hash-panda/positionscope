interface MenuPosition {
  symbol: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  positionAmt: string;
}

/** Shared by the native menu bar and the display-settings preview. */
export function menuValues(position: MenuPosition) {
  const price = Number(position.markPrice);
  const entry = Number(position.entryPrice);
  const pnl = Number(position.unRealizedProfit);
  const percent =
    entry > 0 ? ((price - entry) / entry) * 100 * (Number(position.positionAmt) < 0 ? -1 : 1) : NaN;
  const precision = price >= 1000 ? 0 : price >= 100 ? 1 : price >= 1 ? 2 : price >= 0.01 ? 4 : 6;
  return {
    symbol: position.symbol.replace(/(USDT|BUSD)$/, ''),
    price: Number.isFinite(price) ? price.toFixed(precision) : '--',
    pnlText: Number.isFinite(pnl) ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}` : '--',
    percentText: Number.isFinite(percent)
      ? `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`
      : '--',
  };
}

/** Price change, independent of position side; this is NOT leveraged return on margin. */
export function entryPriceChange(position: Pick<MenuPosition, 'markPrice' | 'entryPrice'>): number | null {
  const mark = Number(position.markPrice), entry = Number(position.entryPrice);
  const result = (mark / entry - 1) * 100;
  return mark > 0 && entry > 0 && Number.isFinite(result) ? result : null;
}
/** Compact quote precision, retaining meaningful digits for very small positive prices. */
export function priceText(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '—';
  if (price < 0.000001) return price.toExponential(2);
  const digits = price >= 100 ? 2 : price >= 1 ? 3 : price >= .01 ? 4 : 8;
  return price.toLocaleString('en-US', { minimumFractionDigits: price >= 100 ? 2 : 0, maximumFractionDigits: digits });
}
