import type { PaperBook, PaperPolicy } from '../../types/paper';
import { SCALE, cost, decimal as d, divide as div, format as f } from './decimal';

export interface VisibleLiquidityOrder {
  id: string;
  quantity: bigint;
}

export interface VisibleLiquidityFill {
  id: string;
  status: 'filled' | 'partial' | 'unfilled';
  requestedQuantity: string;
  filledQuantity: string;
  remainingQuantity: string;
  averagePrice: string | null;
  notional: string;
  fee: string;
}

/**
 * Deterministic synthetic experiment for one frozen public depth snapshot.
 *
 * Orders are evaluated in the supplied order and consume a private copy of visible
 * depth. A later order cannot reuse quantity already consumed by an earlier order.
 * This is not a queue-position or executable-price claim: the result is only a
 * bounded, visible-liquidity scenario for validating paper-ledger semantics.
 */
export function consumeVisibleLiquidity(
  book: PaperBook,
  buy: boolean,
  orders: readonly VisibleLiquidityOrder[],
  policy: Pick<PaperPolicy, 'feeBps' | 'slippageBps'>,
): VisibleLiquidityFill[] {
  if (!Number.isSafeInteger(policy.feeBps) || policy.feeBps < 0 || policy.feeBps > 100 ||
      !Number.isSafeInteger(policy.slippageBps) || policy.slippageBps < 0 || policy.slippageBps > 100) {
    throw new Error('Invalid visible-liquidity cost policy');
  }

  const step = d(book.stepSize), minimum = d(book.minQty), maximum = d(book.maxQty);
  const ids = new Set<string>();

  const levels = (buy ? book.asks : book.bids).map(([price, quantity]) => ({
    price: d(price),
    remaining: d(quantity),
  }));
  let levelIndex = 0;

  return orders.map(order => {
    if (!order.id || ids.has(order.id) || order.quantity < minimum || order.quantity > maximum || order.quantity % step !== 0n) {
      throw new Error('Invalid visible-liquidity order');
    }
    ids.add(order.id);
    let remaining = order.quantity;
    let filled = 0n;
    let rawNotional = 0n;

    while (remaining > 0n && levelIndex < levels.length) {
      const level = levels[levelIndex];
      const quantity = level.remaining < remaining ? level.remaining : remaining;
      const raw = level.price * quantity;
      rawNotional += buy ? (raw + SCALE - 1n) / SCALE : raw / SCALE;
      filled += quantity;
      remaining -= quantity;
      level.remaining -= quantity;
      if (level.remaining === 0n) levelIndex += 1;
    }

    if (filled === 0n) return {
      id: order.id,
      status: 'unfilled' as const,
      requestedQuantity: f(order.quantity),
      filledQuantity: '0',
      remainingQuantity: f(order.quantity),
      averagePrice: null,
      notional: '0',
      fee: '0',
    };

    const slippage = cost(rawNotional, policy.slippageBps);
    const notional = buy ? rawNotional + slippage : rawNotional - slippage;
    if (notional <= 0n) throw new Error('Invalid visible-liquidity notional');
    return {
      id: order.id,
      status: remaining === 0n ? 'filled' as const : 'partial' as const,
      requestedQuantity: f(order.quantity),
      filledQuantity: f(filled),
      remainingQuantity: f(remaining),
      averagePrice: f(div(notional, filled)),
      notional: f(notional),
      fee: f(cost(notional, policy.feeBps)),
    };
  });
}
