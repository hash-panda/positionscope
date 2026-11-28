import { SCALE, decimal as d, format as f } from './decimal';
import { isBinanceUsdtPerpetualSymbol } from '../../utils/binance-symbol';

interface Fill { id: string; quantity: string; quoteAt: number }
interface Settlement {
  symbol: string; time: number; rate: string; markPrice: string;
  source: '/fapi/v1/fundingRate';
}
/** One settled funding observation for an opening-only partial-order experiment.
 * No exits, coverage completeness, account margins or production ledger writes.
 */
export function estimatePartialFunding(symbol: string, long: boolean, fills: readonly Fill[], row: Settlement, asOf: number) {
  if (!isBinanceUsdtPerpetualSymbol(symbol) || typeof long !== 'boolean' || row.symbol !== symbol ||
      row.source !== '/fapi/v1/fundingRate' || !Number.isSafeInteger(row.time) || row.time < 0 ||
      !Number.isSafeInteger(asOf) || asOf < row.time) {
    throw Error('Invalid partial funding evidence');
  }
  const rate = d(row.rate), mark = d(row.markPrice);
  if (rate < -SCALE || rate > SCALE || mark <= 0n) throw Error('Invalid partial funding evidence');
  const seen = new Map<string, { quantity: bigint; at: number }>();
  let quantity = 0n, ambiguous = false;
  for (const fill of fills) {
    const amount = d(fill.quantity);
    if (!/^[a-zA-Z0-9_/-]{1,161}$/.test(fill.id) || amount <= 0n ||
        !Number.isSafeInteger(fill.quoteAt) || fill.quoteAt < 0 || fill.quoteAt > asOf) throw Error('Invalid partial funding fill');
    const prior = seen.get(fill.id);
    if (prior) {
      if (prior.quantity !== amount || prior.at !== fill.quoteAt) throw Error('Conflicting partial funding fill');
      continue;
    }
    seen.set(fill.id, { quantity: amount, at: fill.quoteAt });
    if (fill.quoteAt === row.time) ambiguous = true;
    if (fill.quoteAt < row.time) quantity += amount;
  }
  if (ambiguous) return { quantity: null, funding: null, status: 'ambiguous-at-settlement' as const };
  // Round once: debits away from zero, credits toward zero. No subunit credit.
  const raw = quantity * mark * rate * (long ? -1n : 1n), divisor = SCALE * SCALE;
  const funding = raw < 0n ? -((-raw + divisor - 1n) / divisor) : raw / divisor;
  return { quantity: f(quantity), funding: f(funding), status: 'estimated' as const };
}
