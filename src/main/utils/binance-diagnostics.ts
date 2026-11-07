const failures = {
  BINANCE_UNSUPPORTED_INSTRUMENT: ['币安合约不在支持范围', '当前仅支持可识别的USDT结算线性合约；未将不支持的持仓当作空仓。'],
  BINANCE_INVALID_POSITION: ['币安持仓数据校验失败', '持仓数量、方向、价格或保证金字段不完整或格式无效；请稍后重试。'],
  BINANCE_INVALID_CONFIG: ['币安合约配置校验失败', '合约配置列表或保证金模式字段不完整或格式无效；请稍后重试。'],
  BINANCE_INVALID_ACCOUNT: ['币安账户数据校验失败', '账户或账户模式响应不完整或格式无效；请稍后重试并核对账户支持范围。'],
} as const;

export type BinanceDataErrorCode = keyof typeof failures;

/** Only this locally constructed type carries a trusted mapping code. Never
 * accept an upstream .code/.message or retain the raw response/cause. */
export const positionFields = ['response', 'positionAmt', 'positionSide', 'markPrice', 'entryPrice', 'unRealizedProfit', 'isolatedWallet', 'liquidationPrice', 'positionInitialMargin', 'maintMargin', 'updateTime'] as const;
export type PositionField = typeof positionFields[number];
export class BinanceDataError extends Error {
  constructor(readonly code: BinanceDataErrorCode, readonly field?: PositionField) {
    super(failures[code][0]);
    this.name = 'BinanceDataError';
  }
}

export function binanceDataFailure(error: unknown) {
  if (!(error instanceof BinanceDataError) || !Object.prototype.hasOwnProperty.call(failures, error.code)) return null;
  const [errorMessage, suggestion] = failures[error.code];
  const field = error.code === 'BINANCE_INVALID_POSITION' && positionFields.includes(error.field as PositionField) ? error.field : undefined;
  return {errorCode: error.code, errorMessage, suggestion: field ? `${suggestion} 校验字段：${field}（不含原始值）。` : suggestion};
}
