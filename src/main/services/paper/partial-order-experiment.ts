import type { PaperBook, PaperPolicy } from '../../types/paper';
import { BOOK_TTL, validateBook } from './engine';
import { consumeVisibleLiquidity } from './visible-liquidity';
import { SCALE, decimal as d, format as f } from './decimal';

export interface PartialOrder {
  id: string;
  quantity: string;
  at: number;
  expiresAt: number;
}
export interface ExperimentMark {
  symbol: string;
  price: string;
  observedAt: number;
  fetchedAt: number;
  source: '/fapi/v1/premiumIndex';
}
export interface PartialBookEvent { kind?: 'book'; id: string; at: number; book: PaperBook; mark?: ExperimentMark }
export interface PartialCancelEvent { kind: 'cancel'; id: string; at: number; orderId: string }

function validMark(mark: ExperimentMark | undefined, symbol: string, at: number): mark is ExperimentMark {
  if (!mark || mark.symbol !== symbol || mark.source !== '/fapi/v1/premiumIndex' ||
      !Number.isSafeInteger(mark.observedAt) || !Number.isSafeInteger(mark.fetchedAt) ||
      mark.observedAt < 0 || mark.fetchedAt < 0 || mark.fetchedAt > at ||
      mark.observedAt > at + 2000 || mark.observedAt > mark.fetchedAt + 2000 ||
      at - mark.observedAt > BOOK_TTL || at - mark.fetchedAt > BOOK_TTL) return false;
  try { return d(mark.price) > 0n; } catch { return false; }
}

/**
 * Isolated replay experiment for one symbol and one side.
 * Its JSON inputs are the journal; it does not write the production paper ledger.
 */
export function replayPartialOrders(
  symbol: string,
  buy: boolean,
  orders: readonly PartialOrder[],
  events: readonly (PartialBookEvent | PartialCancelEvent)[],
  policy: Pick<PaperPolicy, 'feeBps' | 'slippageBps'>,
  requireMinimumNotional = false,
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
      status: 'pending' as 'pending' | 'partial' | 'filled' | 'expired' | 'cancelled' | 'rejected',
      admission: (requireMinimumNotional ? 'unverified' : 'unchecked') as 'unverified' | 'unchecked' | 'admitted' | 'rejected',
      minimumNotionalEvidence: null as (ExperimentMark & { quantity: string; minimum: string }) | null,
      cancelledAt: null as number | null,
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
    if (!Number.isSafeInteger(event.at) || event.at < lastAt) {
      throw new Error('Invalid experiment event sequence');
    }
    seen.set(event.id, encoded);
    lastAt = event.at;
    for (const order of results) {
      if ((order.status === 'pending' || order.status === 'partial') && event.at >= order.expiresAt) {
        order.status = 'expired';
      }
    }
    if (event.kind === 'cancel') {
      const order = results.find(order => order.id === event.orderId);
      if (!order || event.at < order.at) throw new Error('Invalid experiment cancellation');
      if (order.status === 'pending' || order.status === 'partial') {
        order.status = 'cancelled';
        order.cancelledAt = event.at;
      }
      continue;
    }
    const book = event.book;
    if (book.symbol !== symbol) throw new Error('Invalid experiment symbol');
    validateBook(book, event.at);
    const step = d(book.stepSize);
    if ([...book.bids, ...book.asks].some(([, quantity]) => d(quantity) % step !== 0n)) {
      throw new Error('Experiment depth quantity is off contract step');
    }
    const updateId = BigInt(book.updateId);
    if (watermark && (updateId <= watermark.updateId || book.observedAt < watermark.observedAt)) continue;
    watermark = { updateId, observedAt: book.observedAt };
    let eligible = results.filter(order =>
      (order.status === 'pending' || order.status === 'partial') &&
      book.observedAt > order.at && book.fetchedAt > order.at &&
      book.observedAt < order.expiresAt,
    );
    if (requireMinimumNotional) {
      eligible = eligible.filter(order => {
        if (order.admission === 'admitted') return true;
        if (!validMark(event.mark, symbol, event.at)) return false;
        order.minimumNotionalEvidence = { ...event.mark, quantity: order.quantity, minimum: book.minNotional };
        if (d(order.quantity) * d(event.mark.price) < d(book.minNotional) * SCALE) {
          order.status = 'rejected';
          order.admission = 'rejected';
          return false;
        }
        order.admission = 'admitted';
        return true;
      });
    }
    const fills = consumeVisibleLiquidity(book, buy, eligible.map(order => ({
      id: order.id, quantity: d(order.remaining), isRemainder: order.fills.length > 0,
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
