import type { Position } from '../types/exchange';
import { positionKey } from './position-order';
export interface PositionEvent {
  id: string;
  at: number;
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  kind: 'opened' | 'closed' | 'increased' | 'reduced';
  previousQuantity: number;
  quantity: number;
}
function index(positions: Position[]): Map<string, Position> {
  const result = new Map<string, Position>();
  for (const position of positions) {
    const quantity = Number(position.positionAmt);
    if (!Number.isFinite(quantity)) throw new Error('Invalid snapshot quantity');
    if (quantity === 0) continue;
    const key = positionKey(position);
    if (result.has(key)) throw new Error('Duplicate snapshot position');
    result.set(key, position);
  }
  return result;
}
export function diffPositions(previous: Position[], current: Position[], at: number): PositionEvent[] {
  const before = index(previous), after = index(current);
  const events: PositionEvent[] = [];
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const old = before.get(key), next = after.get(key), position = next || old!;
    const previousQuantity = Math.abs(Number(old?.positionAmt || 0));
    const quantity = Math.abs(Number(next?.positionAmt || 0));
    if (previousQuantity === quantity) continue;
    events.push({ id: `${at}:${key}`, at, exchange: position.exchange, symbol: position.symbol,
      side: Number(position.positionAmt) > 0 ? 'long' : 'short',
      kind: !old ? 'opened' : !next ? 'closed' : quantity > previousQuantity ? 'increased' : 'reduced',
      previousQuantity, quantity });
  }
  return events;
}
