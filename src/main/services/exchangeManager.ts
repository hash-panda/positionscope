import { BinanceService } from './binance';
import { BybitService } from './bybit';
import { OKXService } from './okx';
import { HyperliquidService } from './hyperliquid';
import {
  IExchangeService,
  ExchangeType,
  ExchangeCredentials,
  Position,
  AccountInfo,
  SpotBalance,
} from '../types/exchange';
import { logger } from '../utils/logger';

/**
 * 交易所错误信息
 */
export interface ExchangeError {
  exchange: ExchangeType;
  errorCode: string;           // ECONNREFUSED, ETIMEDOUT, UNAUTHORIZED 等
  errorMessage: string;         // 完整的错误消息
  timestamp: number;            // 错误发生时间
  consecutiveFailures: number;  // 连续失败次数
  suggestion: string;           // 给用户的建议
}

/**
 * 交易所管理器
 * 负责管理所有已配置的交易所服务
 */
export class ExchangeManager {
  private exchanges: Map<ExchangeType, IExchangeService> = new Map();
  private errorStates: Map<string, ExchangeError> = new Map();
  private readonly MAX_CONSECUTIVE_FAILURES = 3; // 最大连续失败次数

  constructor() {
    // 初始化支持的所有交易所
    this.exchanges.set(ExchangeType.BINANCE, new BinanceService());
    this.exchanges.set(ExchangeType.BYBIT, new BybitService());
    this.exchanges.set(ExchangeType.OKX, new OKXService());
    this.exchanges.set(ExchangeType.HYPERLIQUID, new HyperliquidService());

    logger.log('[ExchangeManager] Initialized with 4 exchanges: Binance, Bybit, OKX, Hyperliquid');
  }

  /**
   * 设置交易所凭证
   */
  setCredentials(credentials: ExchangeCredentials): void {
    const exchange = this.exchanges.get(credentials.exchange);
    if (!exchange) {
      logger.error(`[ExchangeManager] Exchange ${credentials.exchange} not supported`);
      throw new Error(`Exchange ${credentials.exchange} not supported`);
    }

    this.removeErrors(credentials.exchange);
    exchange.setCredentials(credentials);
    logger.log(`[ExchangeManager] Credentials set for ${credentials.exchange}`);
  }

  /**
   * 删除交易所凭证（将凭证设置为空）
   */
  removeCredentials(exchangeType: ExchangeType): void {
    const exchange = this.exchanges.get(exchangeType);
    if (!exchange) {
      logger.error(`[ExchangeManager] Exchange ${exchangeType} not supported`);
      throw new Error(`Exchange ${exchangeType} not supported`);
    }

    // 通过设置空凭证来清除
    exchange.setCredentials({
      exchange: exchangeType,
      apiKey: '',
      apiSecret: '',
    });

    // 同时清除错误状态
    this.removeErrors(exchangeType);

    logger.log(`[ExchangeManager] Credentials removed for ${exchangeType}`);
  }

  /**
   * 删除所有交易所的凭证
   */
  removeAllCredentials(): void {
    // 遍历所有交易所类型
    const exchangeTypes = [
      ExchangeType.BINANCE,
      ExchangeType.BYBIT,
      ExchangeType.OKX,
      ExchangeType.HYPERLIQUID,
    ];

    exchangeTypes.forEach(exchangeType => {
      const exchange = this.exchanges.get(exchangeType);
      if (exchange) {
        exchange.setCredentials({
          exchange: exchangeType,
          apiKey: '',
          apiSecret: '',
        });
      }
    });

    // 清除所有错误状态
    this.errorStates.clear();

    logger.log('[ExchangeManager] All credentials removed');
  }

  /**
   * 检查是否有任何已配置的交易所
   */
  hasAnyCredentials(): boolean {
    return Array.from(this.exchanges.values()).some(exchange => exchange.hasCredentials());
  }

  /**
   * 检查特定交易所是否有凭证
   */
  hasCredentials(exchangeType: ExchangeType): boolean {
    const exchange = this.exchanges.get(exchangeType);
    return exchange ? exchange.hasCredentials() : false;
  }

  /**
   * 根据错误代码生成建议
   */
  private getSuggestionForError(errorCode: string, errorMessage: string): string {
    if (errorCode === 'ECONNREFUSED' || errorCode === 'ECONNABORTED' || errorMessage.includes('timeout')) {
      return '网络连接失败，请检查：\n1. 网络连接是否正常\n2. 是否需要配置代理（设置 → 系统 → 网络代理）\n3. 防火墙是否阻止了连接';
    }
    if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
      return '请求超时，可能原因：\n1. 网络速度较慢\n2. 需要配置代理访问交易所API\n3. 交易所服务暂时不可用';
    }
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      return 'API认证失败，请检查：\n1. API Key是否正确\n2. API Secret是否正确\n3. API权限是否开启（仅需查询权限）';
    }
    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      return 'API权限不足，请检查：\n1. IP是否在白名单中\n2. API是否有查询权限\n3. API是否已过期';
    }
    if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
      return 'API请求频率过高，请稍后再试';
    }
    return '未知错误，请检查网络连接和API配置';
  }

  /**
   * 记录错误状态
   */
  private recordError(exchangeType: ExchangeType, error: any, operation: string): void {
    const key = `${exchangeType}:${operation}`;
    const errorCode = error.code || 'UNKNOWN';
    const errorMessage = error.message || String(error);
    this.errorStates.set(key, {
      exchange: exchangeType, errorCode, errorMessage, timestamp: Date.now(),
      consecutiveFailures: (this.errorStates.get(key)?.consecutiveFailures || 0) + 1,
      suggestion: this.getSuggestionForError(errorCode, errorMessage),
    });
  }

  private removeErrors(exchange: ExchangeType): void {
    for (const key of this.errorStates.keys()) if (key.startsWith(`${exchange}:`)) this.errorStates.delete(key);
  }

  private clearError(exchange: ExchangeType, operation: string): void {
    this.errorStates.delete(`${exchange}:${operation}`);
  }

  isInErrorState(exchange: ExchangeType): boolean {
    return [...this.errorStates.values()].some(error => error.exchange === exchange && error.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES);
  }

  hasAnyErrors(): boolean { return this.errorStates.size > 0; }

  hasBlockingErrors(): boolean {
    return [...this.errorStates.values()].some(error => error.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES);
  }

  getAllErrors(): ExchangeError[] {
    const errors = new Map<ExchangeType, ExchangeError>();
    for (const error of this.errorStates.values()) {
      const previous = errors.get(error.exchange);
      if (!previous || previous.timestamp <= error.timestamp) errors.set(error.exchange, error);
    }
    return [...errors.values()];
  }

  /**
   * 清除所有错误状态
   */
  clearAllErrors(): void {
    this.errorStates.clear();
    logger.log('[ExchangeManager] All errors cleared');
  }

  /**
   * 获取所有已配置的交易所
   */
  getConfiguredExchanges(): ExchangeType[] {
    const configured: ExchangeType[] = [];
    this.exchanges.forEach((exchange, type) => {
      if (exchange.hasCredentials()) {
        configured.push(type);
      }
    });
    return configured;
  }

  /**
   * 获取特定交易所的服务
   */
  getExchange(exchangeType: ExchangeType): IExchangeService | undefined {
    return this.exchanges.get(exchangeType);
  }

  /**
   * 获取所有交易所的合约持仓（合并）
   */
  async getAllFuturesPositions(): Promise<Position[]> {
    const allPositions: Position[] = [];
    const configuredExchanges = this.getConfiguredExchanges();

    logger.log(`[ExchangeManager] Fetching positions from ${configuredExchanges.length} exchanges`);

    // 并行获取所有交易所的持仓
    const promises = configuredExchanges.map(async (exchangeType) => {
      const exchange = this.exchanges.get(exchangeType);
      if (!exchange) return [];

      // 如果交易所已经处于错误状态，跳过调用
      if (this.isInErrorState(exchangeType)) {
        logger.log(`[ExchangeManager] Skipping ${exchangeType} due to error state`);
        return [];
      }

      try {
        const positions = await exchange.getFuturesPositions();
        logger.log(`[ExchangeManager] Got ${positions.length} positions from ${exchangeType}`);

        // 成功调用，清除错误状态
        this.clearError(exchangeType, 'positions');

        return positions;
      } catch (error: any) {
        logger.error(`[ExchangeManager] Error fetching positions from ${exchangeType}:`, error.message);

        // 记录错误
        this.recordError(exchangeType, error, 'positions');

        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(positions => {
      allPositions.push(...positions);
    });

    logger.log(`[ExchangeManager] Total positions: ${allPositions.length}`);
    return allPositions;
  }

  /**
   * 获取所有交易所的账户信息
   */
  async getAllAccountInfo(): Promise<AccountInfo[]> {
    const allAccountInfo: AccountInfo[] = [];
    const configuredExchanges = this.getConfiguredExchanges();

    logger.log(`[ExchangeManager] Fetching account info from ${configuredExchanges.length} exchanges`);

    // 并行获取所有交易所的账户信息
    const promises = configuredExchanges.map(async (exchangeType) => {
      const exchange = this.exchanges.get(exchangeType);
      if (!exchange) return null;

      // 如果交易所已经处于错误状态，跳过调用
      if (this.isInErrorState(exchangeType)) {
        logger.log(`[ExchangeManager] Skipping ${exchangeType} due to error state`);
        return null;
      }

      try {
        const accountInfo = await exchange.getFuturesAccountInfo();
        logger.log(`[ExchangeManager] Got account info from ${exchangeType}`);

        // 成功调用，清除错误状态
        this.clearError(exchangeType, 'account');

        return accountInfo;
      } catch (error: any) {
        logger.error(`[ExchangeManager] Error fetching account info from ${exchangeType}:`, error.message);

        // 记录错误
        this.recordError(exchangeType, error, 'account');

        return null;
      }
    });

    const results = await Promise.all(promises);
    results.forEach(accountInfo => {
      if (accountInfo) {
        allAccountInfo.push(accountInfo);
      }
    });

    logger.log(`[ExchangeManager] Total accounts: ${allAccountInfo.length}`);
    return allAccountInfo;
  }

  /**
   * 获取所有交易所的现货余额
   */
  async getAllSpotBalances(): Promise<SpotBalance[]> {
    const allBalances: SpotBalance[] = [];
    const configuredExchanges = this.getConfiguredExchanges();

    logger.log(`[ExchangeManager] Fetching spot balances from ${configuredExchanges.length} exchanges`);

    // 并行获取所有交易所的现货余额
    const promises = configuredExchanges.map(async (exchangeType) => {
      const exchange = this.exchanges.get(exchangeType);
      if (!exchange) return [];

      try {
        const balances = await exchange.getSpotBalances();
        logger.log(`[ExchangeManager] Got ${balances.length} balances from ${exchangeType}`);
        return balances;
      } catch (error: any) {
        logger.error(`[ExchangeManager] Error fetching balances from ${exchangeType}:`, error.message);
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(balances => {
      allBalances.push(...balances);
    });

    logger.log(`[ExchangeManager] Total balances: ${allBalances.length}`);
    return allBalances;
  }
}
