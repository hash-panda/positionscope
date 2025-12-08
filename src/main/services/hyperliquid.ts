import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import {
  IExchangeService,
  ExchangeType,
  ExchangeCredentials,
  Position,
  AccountInfo,
  SpotBalance,
} from '../types/exchange';

export class HyperliquidService implements IExchangeService {
  private apiKey: string = ''; // Hyperliquid uses wallet address
  private apiSecret: string = ''; // Hyperliquid may use private key for signing
  private client: AxiosInstance;
  private proxyUrl: string = '';
  private readonly exchangeType = ExchangeType.HYPERLIQUID;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.hyperliquid.xyz',
      timeout: 30000,
    });

    this.addInterceptors();
  }

  private addInterceptors() {
    this.client.interceptors.response.use(
      response => {
        logger.log('[HyperliquidService] Response received successfully');
        return response;
      },
      error => {
        logger.error('[HyperliquidService] Request failed');
        return Promise.reject(error);
      }
    );
  }

  getExchangeType(): ExchangeType {
    return this.exchangeType;
  }

  setCredentials(credentials: ExchangeCredentials): void;
  setCredentials(apiKey: string, apiSecret: string, proxyUrl?: string): void;
  setCredentials(credentialsOrApiKey: ExchangeCredentials | string, apiSecret?: string, proxyUrl?: string): void {
    if (typeof credentialsOrApiKey === 'string') {
      this.apiKey = credentialsOrApiKey; // Wallet address
      this.apiSecret = apiSecret || '';
      logger.log('[HyperliquidService] Credentials set - Address:', credentialsOrApiKey.substring(0, 8) + '...');

      if (proxyUrl && proxyUrl.trim()) {
        this.setProxy(proxyUrl.trim());
      }
    } else {
      const credentials = credentialsOrApiKey;
      this.apiKey = credentials.apiKey; // Wallet address
      this.apiSecret = credentials.apiSecret;
      logger.log('[HyperliquidService] Credentials set - Address:', credentials.apiKey.substring(0, 8) + '...');

      if (credentials.proxyUrl && credentials.proxyUrl.trim()) {
        this.setProxy(credentials.proxyUrl.trim());
      }
    }
  }

  setProxy(proxyUrl: string) {
    this.proxyUrl = proxyUrl;
    let proxyConfig: any = false;

    if (proxyUrl) {
      logger.log('[HyperliquidService] Setting proxy:', proxyUrl);
      try {
        const url = new URL(proxyUrl);
        proxyConfig = {
          host: url.hostname,
          port: parseInt(url.port),
          protocol: url.protocol.replace(':', ''),
        };
        logger.log('[HyperliquidService] Proxy config:', proxyConfig);
      } catch (error) {
        logger.error('[HyperliquidService] Invalid proxy URL:', error);
        return;
      }
    } else {
      logger.log('[HyperliquidService] No proxy configured');
    }

    this.client = axios.create({
      baseURL: 'https://api.hyperliquid.xyz',
      timeout: 30000,
      proxy: proxyConfig,
    });

    this.addInterceptors();
  }

  hasCredentials(): boolean {
    return !!this.apiKey;
  }

  async getSpotBalances(): Promise<SpotBalance[]> {
    logger.log('[HyperliquidService] Getting spot balances...');

    try {
      const response = await this.client.post('/info', {
        type: 'spotClearinghouseState',
        user: this.apiKey,
      });

      logger.log('[HyperliquidService] Spot balances response status:', response.status);

      const balances: SpotBalance[] = [];

      if (response.data && response.data.balances) {
        for (const [asset, balance] of Object.entries(response.data.balances as Record<string, any>)) {
          const total = parseFloat(balance.total || '0');
          if (total > 0) {
            balances.push({
              exchange: this.exchangeType,
              asset,
              free: balance.hold?.toString() || '0',
              locked: '0',
              total,
            });
          }
        }
      }

      logger.log('[HyperliquidService] Filtered balances count:', balances.length);
      return balances;
    } catch (error: any) {
      logger.error('[HyperliquidService] Error getting spot balances:');
      logger.error('[HyperliquidService] Error message:', error.message);
      throw error;
    }
  }

  async getFuturesPositions(): Promise<Position[]> {
    logger.log('[HyperliquidService] Getting futures positions...');

    try {
      const response = await this.client.post('/info', {
        type: 'clearinghouseState',
        user: this.apiKey,
      });

      logger.log('[HyperliquidService] Futures positions response status:', response.status);

      const positions: Position[] = [];

      if (response.data && response.data.assetPositions) {
        for (const position of response.data.assetPositions) {
          const positionAmt = parseFloat(position.position.szi);
          if (positionAmt !== 0) {
            positions.push({
              exchange: this.exchangeType,
              symbol: position.position.coin,
              positionAmt: position.position.szi,
              entryPrice: position.position.entryPx,
              markPrice: position.position.positionValue ?
                (parseFloat(position.position.positionValue) / Math.abs(positionAmt)).toString() : '0',
              unRealizedProfit: position.position.unrealizedPnl,
              marginType: 'cross',
              isolatedMargin: '0',
              leverage: position.position.leverage?.value || '1',
            });
          }
        }
      }

      logger.log('[HyperliquidService] Active positions count:', positions.length);
      return positions;
    } catch (error: any) {
      logger.error('[HyperliquidService] Error getting futures positions:');
      logger.error('[HyperliquidService] Error message:', error.message);
      throw error;
    }
  }

  async getAccountBalance(): Promise<any> {
    logger.log('[HyperliquidService] Getting account balance...');

    try {
      const response = await this.client.post('/info', {
        type: 'clearinghouseState',
        user: this.apiKey,
      });

      logger.log('[HyperliquidService] Account balance retrieved successfully');
      return response.data;
    } catch (error: any) {
      logger.error('[HyperliquidService] Error getting account balance:', error.message);
      throw error;
    }
  }

  async getFuturesAccountInfo(): Promise<AccountInfo> {
    logger.log('[HyperliquidService] Getting futures account info...');

    try {
      // 并行获取合约账户信息和现货余额
      const [futuresResponse, spotBalances] = await Promise.all([
        this.client.post('/info', {
          type: 'clearinghouseState',
          user: this.apiKey,
        }),
        this.getSpotBalances().catch((err) => {
          logger.error('[HyperliquidService] Error getting spot balances for account info:', err.message);
          return [];
        }),
      ]);

      logger.log('[HyperliquidService] Futures account info retrieved successfully');

      const accountData = futuresResponse.data;
      const marginSummary = accountData.marginSummary;

      // 计算现货账户总资产（USDT价值）
      const spotTotalUSDT = spotBalances.reduce((sum, balance) => sum + (balance.usdValue || 0), 0);
      logger.log('[HyperliquidService] Spot total USDT:', spotTotalUSDT);

      const totalMarginBalance = parseFloat(marginSummary?.accountValue || '0');
      const accountInfo: AccountInfo = {
        exchange: this.exchangeType,
        totalWalletBalance: totalMarginBalance,
        totalUnrealizedProfit: parseFloat(marginSummary?.totalNtlPos || '0'),
        totalMarginBalance: totalMarginBalance,
        availableBalance: parseFloat(marginSummary?.totalMarginUsed ?
          (parseFloat(marginSummary.accountValue) - parseFloat(marginSummary.totalMarginUsed)).toString() : '0'),
        maxWithdrawAmount: parseFloat(marginSummary?.withdrawable || '0'),
        spotTotalUSDT: spotTotalUSDT,
        totalAssets: spotTotalUSDT + totalMarginBalance,
      };

      logger.log('[HyperliquidService] Total assets (spot + futures):', accountInfo.totalAssets);

      return accountInfo;
    } catch (error: any) {
      logger.error('[HyperliquidService] Error getting futures account info:', error.message);
      throw error;
    }
  }
}
