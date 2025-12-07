// 交易所类型枚举
export enum ExchangeType {
  BINANCE = 'binance',
  BYBIT = 'bybit',
  OKX = 'okx',
  HYPERLIQUID = 'hyperliquid',
}

// 交易所显示名称
export const ExchangeNames: Record<ExchangeType, string> = {
  [ExchangeType.BINANCE]: '币安',
  [ExchangeType.BYBIT]: 'Bybit',
  [ExchangeType.OKX]: 'OKX',
  [ExchangeType.HYPERLIQUID]: 'Hyperliquid',
};

// 交易所颜色标识
export const ExchangeColors: Record<ExchangeType, string> = {
  [ExchangeType.BINANCE]: '#F3BA2F',     // 币安黄
  [ExchangeType.BYBIT]: '#F7A600',       // Bybit 橙
  [ExchangeType.OKX]: '#000000',         // OKX 黑
  [ExchangeType.HYPERLIQUID]: '#00D4AA', // Hyperliquid 青
};

// 持仓信息（统一格式）
export interface Position {
  exchange: ExchangeType;          // 交易所类型
  symbol: string;                  // 交易对符号
  positionAmt: string;             // 持仓数量
  entryPrice: string;              // 开仓价格
  markPrice: string;               // 标记价格
  unRealizedProfit: string;        // 未实现盈亏
  marginType: string;              // 保证金模式
  isolatedMargin: string;          // 逐仓保证金
  leverage: string;                // 杠杆倍数
}

// 账户信息（统一格式）
export interface AccountInfo {
  exchange: ExchangeType;          // 交易所类型
  totalWalletBalance: number;      // 钱包总余额
  totalUnrealizedProfit: number;   // 未实现盈亏总额
  totalMarginBalance: number;      // 保证金总余额
  availableBalance: number;        // 可用余额
  maxWithdrawAmount: number;       // 最大可提现金额
}

// 现货余额（统一格式）
export interface SpotBalance {
  exchange: ExchangeType;          // 交易所类型
  asset: string;                   // 资产名称
  free: string;                    // 可用余额
  locked: string;                  // 锁定余额
  total: number;                   // 总余额
  usdValue?: number;               // USD 价值
}

// 交易所凭证
export interface ExchangeCredentials {
  exchange: ExchangeType;
  apiKey: string;
  apiSecret: string;
  proxyUrl?: string;
  passphrase?: string;             // OKX 需要
  privateKey?: string;             // Hyperliquid 等去中心化交易所需要
  walletAddress?: string;          // 去中心化交易所钱包地址
}

// 交易所服务接口
export interface IExchangeService {
  // 设置凭证
  setCredentials(credentials: ExchangeCredentials): void;

  // 检查是否有凭证
  hasCredentials(): boolean;

  // 获取合约持仓
  getFuturesPositions(): Promise<Position[]>;

  // 获取账户信息
  getFuturesAccountInfo(): Promise<AccountInfo>;

  // 获取现货余额
  getSpotBalances(): Promise<SpotBalance[]>;

  // 获取交易所类型
  getExchangeType(): ExchangeType;
}
