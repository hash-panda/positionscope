interface PositionIdentity {
  exchange: string;
  symbol: string;
  positionAmt: string;
  positionId?: string;
  instrumentId?: string;
  marginType?: string;
}

/** Keep identical symbols on different exchanges / sides distinct. */
export function positionKey(position: PositionIdentity): string {
  return position.positionId ? `${position.exchange}:${position.instrumentId || position.symbol}:${position.positionId}` : `${position.exchange}:${position.symbol}:${Number(position.positionAmt) < 0 ? 'short' : 'long'}${position.marginType ? `:${position.marginType}` : ''}`;
}

export function orderPositions<T extends PositionIdentity>(positions: T[], order: string[]): T[] {
  const remaining = [...positions];
  const ordered: T[] = [];
  for (const key of order) {
    for (let index = 0; index < remaining.length; ) {
      const position = remaining[index];
      if (positionKey(position) === key) {
        ordered.push(position);
        remaining.splice(index, 1);
      } else index++;
    }
  }
  return [...ordered, ...remaining];
}
