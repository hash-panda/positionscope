import { ExchangeType, SpotBalance } from '../types/exchange';

export function invalidAccount(): Error {
  return Object.assign(new Error('Hyperliquid 账户数据不完整，已停止汇总，请稍后重试'), {
    code: 'HYPERLIQUID_INCOMPLETE_ACCOUNT',
  });
}

export function decimal(value: unknown): number {
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) throw invalidAccount();
  const result = Number(value);
  if (!Number.isFinite(result)) throw invalidAccount();
  return result;
}

export function finiteTotal(value: number): number {
  if (!Number.isFinite(value)) throw invalidAccount();
  return value;
}

// Values and their identity come from the balances array, never its array keys.
export function spotBalances(payload: any): (SpotBalance & { token: number })[] {
  if (!Array.isArray(payload?.balances)) throw invalidAccount();
  const seen = new Set<number>();
  return payload.balances.map((balance: any) => {
    if (!balance || typeof balance.coin !== 'string' || !balance.coin.trim() ||
        !Number.isSafeInteger(balance.token) || balance.token < 0 || seen.has(balance.token)) throw invalidAccount();
    seen.add(balance.token);
    const total = decimal(balance.total);
    const hold = decimal(balance.hold);
    if (hold < 0 || hold > Math.max(total, 0)) throw invalidAccount();
    return { exchange: ExchangeType.HYPERLIQUID, asset: balance.coin, token: balance.token,
      total, free: String(finiteTotal(total - hold)), locked: String(hold) };
  }).filter((balance: SpotBalance) => balance.total !== 0);
}

// Indicative USDC values. No entryNtl/cost-basis valuation and no USDC peg claim.
// Unsupported quotes or missing mark prices must not turn an asset into zero.
export function valueSpotBalances(balances: (SpotBalance & { token: number })[], metadata: any): SpotBalance[] {
  if (balances.length === 0) return [];
  if (!Array.isArray(metadata) || metadata.length !== 2 ||
      !Array.isArray(metadata[0]?.tokens) || !Array.isArray(metadata[0]?.universe) ||
      !Array.isArray(metadata[1]) || metadata[0].universe.length !== metadata[1].length) throw invalidAccount();
  const [meta, contexts] = metadata;
  const tokens = new Map<number, any>();
  for (const token of meta.tokens) {
    if (!token || !Number.isSafeInteger(token.index) || token.index < 0 ||
        typeof token.name !== 'string' || tokens.has(token.index)) throw invalidAccount();
    tokens.set(token.index, token);
  }
  if (tokens.get(0)?.name !== 'USDC') throw invalidAccount();
  return balances.map(balance => {
    if (tokens.get(balance.token)?.name !== balance.asset) throw invalidAccount();
    let price = 1;
    if (balance.token !== 0) {
      const matches = meta.universe.map((pair: any, i: number) => ({ pair, context: contexts[i] }))
        .filter(({ pair }: any) => Array.isArray(pair?.tokens) && pair.tokens.length === 2 &&
          pair.tokens[0] === balance.token && pair.tokens[1] === 0);
      if (matches.length !== 1) throw invalidAccount();
      price = decimal(matches[0].context?.markPx);
      if (price <= 0) throw invalidAccount();
    }
    const { token: _token, ...result } = balance;
    return { ...result, usdValue: finiteTotal(balance.total * price) };
  });
}
