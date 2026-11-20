import type { PaperBook, PaperPolicy } from '../../types/paper';
import { validateBook } from './engine';
import { consumeVisibleLiquidity } from './visible-liquidity';
import { decimal as d, format as f } from './decimal';

export interface PartialOrder {
  id: string;
  quantity: string;
  at: number;
  expiresAt: number;
}
export interface PartialBookEvent { id: string; at: number; book: PaperBook }

/**
 * Isolated replay experiment for one symbol and one side.
 * Its JSON inputs are the journal; it does not write the production paper ledger.
 */
export function replayPartialOrders(
  symbol: string,
  buy: boolean,
  orders: readonly PartialOrder[],
  events: readonly PartialBookEvent[],
  policy: Pick<PaperPolicy, 'feeBps' | 'slippageBps'>,
) {
  const ids = new Set<string>();
  const results = orders.map(order => {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(order.id) || ids.has(order.id) ||
        d(order.quantity) <= 0n || !Number.isSafeInteger(order.at) || order.at < 0 ||
        !Number.isSafeInteger(order.expiresAt) || order.expiresAt <= order.at) {
      throw new Error('Invalid partial-order experiment input');
    }
    ids.add(order.id);
    return {
      ...order,
      status: 'pending' as 'pending' | 'partial' | 'filled' | 'expired',
      remaining: order.quantity,
      notional: '0',
      fees: '0',
      fills: [] as {
        id: string; quoteId: string; quoteAt: number;
        quantity: string; price: string; notional: string; fee: string;
      }[],
    };
  });
  const seen = new Map<string, string>();
  let lastAt = 0;
  let watermark: { updateId: bigint; observedAt: number } | undefined;
  for (const event of events) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(event.id)) throw new Error('Invalid experiment event ID');
    const encoded = JSON.stringify(event);
    const previous = seen.get(event.id);
    if (previous !== undefined) {
      if (previous !== encoded) throw new Error('Conflicting experiment event ID');
      continue;
    }
    if (!Number.isSafeInteger(event.at) || event.at < lastAt || event.book.symbol !== symbol) {
      throw new Error('Invalid experiment event sequence');
    }
    validateBook(event.book, event.at);
    const step = d(event.book.stepSize);
    if ([...event.book.bids, ...event.book.asks].some(([, quantity]) => d(quantity) % step !== 0n)) {
      throw new Error('Experiment depth quantity is off contract step');
    }
    seen.set(event.id, encoded);
    lastAt = event.at;
    for (const order of results) {
      if (order.status !== 'filled' && event.at >= order.expiresAt) order.status = 'expired';
    }
    const book = event.book;
    const updateId = BigInt(book.updateId);
    if (watermark && (updateId <= watermark.updateId || book.observedAt < watermark.observedAt)) continue;
    watermark = { updateId, observedAt: book.observedAt };
    const eligible = results.filter(order =>
      (order.status === 'pending' || order.status === 'partial') &&
      book.observedAt > order.at && book.fetchedAt > order.at &&
      book.observedAt < order.expiresAt &&
      d(order.remaining) >= d(book.minQty),
    );
    const fills = consumeVisibleLiquidity(book, buy, eligible.map(order => ({
      id: order.id, quantity: d(order.remaining),
    })), policy);
    fills.forEach((fill, index) => {
      if (fill.status === 'unfilled') return;
      const order = eligible[index];
      order.remaining = fill.remainingQuantity;
      order.status = fill.status;
      order.notional = f(d(order.notional) + d(fill.notional));
      order.fees = f(d(order.fees) + d(fill.fee));
      order.fills.push({
        id: event.id + '/' + order.id, quoteId: book.updateId, quoteAt: book.observedAt,
        quantity: fill.filledQuantity, price: fill.averagePrice!,
        notional: fill.notional, fee: fill.fee,
      });
    });
  }
  return results;
}
