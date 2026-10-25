export function amount(value: number | string | null | undefined, decimals = 2): string {
  const number = value == null || (typeof value === 'string' && !value.trim()) ? NaN : Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : '不可用';
}
export function signed(value: number | string | null | undefined): string {
  const number = value == null || (typeof value === 'string' && !value.trim()) ? NaN : Number(value);
  return Number.isFinite(number) ? `${number >= 0 ? '+' : ''}${amount(number)}` : '不可用';
}
export function price(value: string | null | undefined): string {
  const number = value == null || (typeof value === 'string' && !value.trim()) ? NaN : Number(value);
  if (!Number.isFinite(number)) return '不可用';
  return amount(number, number >= 1000 ? 2 : number >= 1 ? 4 : number >= 0.01 ? 6 : 8);
}
export function symbol(value: string): string {
  return value.replace(/(USDT|BUSD)$/, '');
}
export function direction(value: number | string | null | undefined): string {
  return Number(value) > 0 ? 'positive' : Number(value) < 0 ? 'negative' : '';
}
export function priceChange(position: {
  entryPrice: string;
  markPrice: string;
  positionAmt: string;
}): string {
  const entry = Number(position.entryPrice);
  const mark = Number(position.markPrice);
  if (!Number.isFinite(entry) || !Number.isFinite(mark) || entry <= 0) return '暂无';
  const change = ((mark - entry) / entry) * 100 * (Number(position.positionAmt) < 0 ? -1 : 1);
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
}
