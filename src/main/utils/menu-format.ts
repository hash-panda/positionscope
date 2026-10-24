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
