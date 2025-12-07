import { BinanceService } from './binance';
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
 * 交易所管理器
 * 负责管理所有已配置的交易所服务
 */
export class ExchangeManager {
  private exchanges: Map<ExchangeType, IExchangeService> = new Map();

  constructor() {
    // 初始化支持的交易所
    this.exchanges.set(ExchangeType.BINANCE, new BinanceService());
    // TODO: 添加其他交易所
    // this.exchanges.set(ExchangeType.BYBIT, new BybitService());
    // this.exchanges.set(ExchangeType.OKX, new OKXService());
    // this.exchanges.set(ExchangeType.HYPERLIQUID, new HyperliquidService());
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

    exchange.setCredentials(credentials);
    logger.log(`[ExchangeManager] Credentials set for ${credentials.exchange}`);
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

      try {
        const positions = await exchange.getFuturesPositions();
        logger.log(`[ExchangeManager] Got ${positions.length} positions from ${exchangeType}`);
        return positions;
      } catch (error: any) {
        logger.error(`[ExchangeManager] Error fetching positions from ${exchangeType}:`, error.message);
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

      try {
        const accountInfo = await exchange.getFuturesAccountInfo();
        logger.log(`[ExchangeManager] Got account info from ${exchangeType}`);
        return accountInfo;
      } catch (error: any) {
        logger.error(`[ExchangeManager] Error fetching account info from ${exchangeType}:`, error.message);
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
