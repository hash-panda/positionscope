import { priceText } from './menu-format';
import type { Position } from '../types/exchange';

/** No comparison across gaps, symbols, or duplicate/out-of-order snapshots. */
export class MenuPriceHistory {
  private quotes = new Map<string, { price: number; at: number; direction: number }>();
  clear() { this.quotes.clear(); }
  observe(positions: Position[], now: number, maxAge: number) {
    const result = new Map<string, number>();
    for (const p of positions) {
      const key = `${p.exchange}:${p.symbol}`, price = Number(p.markPrice), at = p.fetchedAt;
      if (!(price > 0) || !Number.isFinite(price) || !at || at > now + 1000 || now - at > maxAge) { this.quotes.delete(key); result.set(key, 0); continue; }
      const previous = this.quotes.get(key);
      const direction = previous && at >= previous.at && at - previous.at <= maxAge
        ? at === previous.at ? previous.direction : Math.sign(price - previous.price) : 0;
      if (!previous || at >= previous.at) this.quotes.set(key, { price, at, direction });
      result.set(key, direction);
    }
    const keys = new Set(positions.map(p => `${p.exchange}:${p.symbol}`));
    for (const key of this.quotes.keys()) if (!keys.has(key)) this.quotes.delete(key);
    return result;
  }
}
export function menuPriceLabel(p: Position, direction: number, hidden: boolean) {
  const symbol = p.symbol.replace(/USDT$/, '');
  return hidden ? `${symbol} ••••` : `${symbol} ${priceText(Number(p.markPrice))}${direction > 0 ? ' ↑' : direction < 0 ? ' ↓' : ''}`;
}
