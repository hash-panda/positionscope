/** Binance enabled UTF-8 symbols in October 2025. Support the documented Han
 * identifiers alongside existing uppercase ASCII/digits, without changing their
 * spelling or admitting control characters, whitespace, paths or other scripts.
 * A syntactically valid identifier is not evidence that an instrument is listed;
 * public market reads additionally require matching exchangeInfo metadata. */
const ASSET = /^[A-Z0-9\p{Script=Han}]{1,40}$/u;
const CONTRACT = /^([A-Z0-9\p{Script=Han}]{1,40})USDT(?:_(\d{6}))?$/u;
const completeMatch = (pattern: RegExp, value: unknown): RegExpExecArray | null => {
  if (typeof value !== 'string' || value.length > 91) return null;
  const match = pattern.exec(value);
  // JavaScript's $ can match before a final newline. Require the whole value.
  return match?.[0] === value ? match : null;
};

export function isBinanceBaseAsset(value: unknown): value is string {
  return completeMatch(ASSET, value) !== null;
}

export function binanceUsdtBaseAsset(value: unknown, allowDelivery = true): string | null {
  const match = completeMatch(CONTRACT, value);
  return match && (allowDelivery || !match[2]) ? match[1] : null;
}

export function isBinanceUsdtPerpetualSymbol(value: unknown): value is string {
  return binanceUsdtBaseAsset(value, false) !== null;
}

/** Preserve the existing ASCII cross-venue research mapping. Han support is
 * Binance-specific; a contract on another venue is never implicitly supported. */
export function binanceResearchSymbol(position: {exchange?: string; symbol?: unknown; baseAsset?: unknown}): string | null {
  if (position.exchange === 'binance') {
    const asset = binanceUsdtBaseAsset(position.symbol);
    if (!asset || (position.baseAsset != null && position.baseAsset !== asset)) return null;
    return isBinanceUsdtPerpetualSymbol(position.symbol) ? position.symbol : `${asset}USDT`;
  }
  if (completeMatch(/^[A-Z0-9]{1,40}USDT$/, position.symbol)) return position.symbol as string;
  return completeMatch(/^[A-Z0-9]{1,40}$/, position.baseAsset) ? `${position.baseAsset}USDT` : null;
}
