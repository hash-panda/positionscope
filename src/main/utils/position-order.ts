interface PositionIdentity {
  exchange: string;
  symbol: string;
  positionAmt: string;
}

/** Keep identical symbols on different exchanges / sides distinct. */
export function positionKey(position: PositionIdentity): string {
  return `${position.exchange}:${position.symbol}:${Number(position.positionAmt) < 0 ? 'short' : 'long'}`;
}

export function orderPositions<T extends PositionIdentity>(positions: T[], order: string[]): T[] {
  const remaining = [...positions];
  const ordered: T[] = [];
  for (const key of order) {
    // Accept legacy symbol-only orders without dropping matching positions.
    for (let index = 0; index < remaining.length; ) {
      const position = remaining[index];
      if (positionKey(position) === key || position.symbol === key) {
        ordered.push(position);
        remaining.splice(index, 1);
      } else index++;
    }
  }
  return [...ordered, ...remaining];
}
