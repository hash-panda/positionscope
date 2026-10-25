import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import {
  IExchangeService,
  ExchangeType,
  ExchangeCredentials,
  Position,
  AccountInfo,
  SpotBalance,
} from '../types/exchange';

export class BybitService implements IExchangeService {
  private apiKey: string = '';
  private apiSecret: string = '';
  private client: AxiosInstance;
  private proxyUrl: string = '';
  private readonly exchangeType = ExchangeType.BYBIT;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.bybit.com',
      timeout: 30000,
    });

    this.addInterceptors();
  }

  private addInterceptors() {
    this.client.interceptors.response.use(
      response => {
        logger.log('[BybitService] Response received successfully');
        return response;
      },
      error => {
        logger.error('[BybitService] Request failed');
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
      this.apiKey = credentialsOrApiKey;
      this.apiSecret = apiSecret || '';

      if (typeof proxyUrl === 'string') {
        this.setProxy(proxyUrl.trim());
      }
    } else {
      const credentials = credentialsOrApiKey;
      this.apiKey = credentials.apiKey;
      this.apiSecret = credentials.apiSecret;

      if (typeof credentials.proxyUrl === 'string') {
        this.setProxy(credentials.proxyUrl.trim());
      }
    }
  }

  setProxy(proxyUrl: string) {
    this.proxyUrl = proxyUrl;
    let proxyConfig: any = false;

    if (proxyUrl) {
      logger.log('[Exchange] Configuring proxy');
      try {
        const url = new URL(proxyUrl);
        proxyConfig = {
          host: url.hostname,
          port: parseInt(url.port),
          protocol: url.protocol.replace(':', ''),
        };
        logger.log('[BybitService] Proxy config:', proxyConfig);
      } catch (error) {
        logger.error('[Exchange] Invalid proxy URL');
        return;
      }
    } else {
      logger.log('[BybitService] No proxy configured');
    }

    this.client = axios.create({
      baseURL: 'https://api.bybit.com',
      timeout: 30000,
      proxy: proxyConfig,
    });

    this.addInterceptors();
  }

  hasCredentials(): boolean {
    return !!this.apiKey && !!this.apiSecret;
  }

  private sign(params: string, timestamp: string): string {
    const hmac = crypto.createHmac('sha256', this.apiSecret);
    hmac.update(timestamp + this.apiKey + '5000' + params);
    return hmac.digest('hex');
  }

  async getSpotBalances(): Promise<SpotBalance[]> {
    logger.log('[BybitService] Getting spot balances...');
    const timestamp = Date.now().toString();
    const params = JSON.stringify({ accountType: 'SPOT' });
    const signature = this.sign(params, timestamp);

    try {
      const response = await this.client.get('/v5/account/wallet-balance', {
        params: { accountType: 'SPOT' },
        headers: {
          'X-BAPI-API-KEY': this.apiKey,
          'X-BAPI-SIGN': signature,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': '5000',
        },
      });

      logger.log('[BybitService] Spot balances response status:', response.status);

      if (response.data.retCode !== 0) {
        throw new Error(`Bybit API Error: ${response.data.retMsg}`);
      }

      const balances: SpotBalance[] = [];
      const coins = response.data.result.list[0]?.coin || [];

      for (const coin of coins) {
        const total = parseFloat(coin.walletBalance);
        if (total > 0) {
          balances.push({
            exchange: this.exchangeType,
            asset: coin.coin,
            free: coin.availableToWithdraw,
            locked: (parseFloat(coin.walletBalance) - parseFloat(coin.availableToWithdraw)).toString(),
            total,
            usdValue: parseFloat(coin.usdValue || '0'),
          });
        }
      }

      logger.log('[BybitService] Filtered balances count:', balances.length);
      return balances.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));
    } catch (error: any) {
      logger.error('[BybitService] Error getting spot balances:');
      logger.error('[BybitService] Error message:', error.message);
      throw error;
    }
  }

  async getFuturesPositions(): Promise<Position[]> {
    logger.log('[BybitService] Getting futures positions...');
    const timestamp = Date.now().toString();
    const params = JSON.stringify({ category: 'linear', settleCoin: 'USDT' });
    const signature = this.sign(params, timestamp);

    try {
      const response = await this.client.get('/v5/position/list', {
        params: { category: 'linear', settleCoin: 'USDT' },
        headers: {
          'X-BAPI-API-KEY': this.apiKey,
          'X-BAPI-SIGN': signature,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': '5000',
        },
      });

      logger.log('[BybitService] Futures positions response status:', response.status);

      if (response.data.retCode !== 0) {
        throw new Error(`Bybit API Error: ${response.data.retMsg}`);
      }

      const positions: Position[] = response.data.result.list
        .filter((p: any) => parseFloat(p.size) !== 0)
        .map((p: any) => ({
          exchange: this.exchangeType,
          symbol: p.symbol,
          positionAmt: p.side === 'Buy' ? p.size : `-${p.size}`,
          entryPrice: p.avgPrice,
          markPrice: p.markPrice,
          unRealizedProfit: p.unrealisedPnl,
          marginType: p.tradeMode === 0 ? 'cross' : 'isolated',
          isolatedMargin: p.positionIM,
          leverage: p.leverage,
        }));

      logger.log('[BybitService] Active positions count:', positions.length);
      return positions;
    } catch (error: any) {
      logger.error('[BybitService] Error getting futures positions:');
      logger.error('[BybitService] Error message:', error.message);
      throw error;
    }
  }

  async getAccountBalance(): Promise<any> {
    logger.log('[BybitService] Getting account balance...');
    const timestamp = Date.now().toString();
    const params = JSON.stringify({ accountType: 'CONTRACT' });
    const signature = this.sign(params, timestamp);

    try {
      const response = await this.client.get('/v5/account/wallet-balance', {
        params: { accountType: 'CONTRACT' },
        headers: {
          'X-BAPI-API-KEY': this.apiKey,
          'X-BAPI-SIGN': signature,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': '5000',
        },
      });

      logger.log('[BybitService] Account balance retrieved successfully');
      return response.data.result;
    } catch (error: any) {
      logger.error('[BybitService] Error getting account balance:', error.message);
      throw error;
    }
  }

  async getFuturesAccountInfo(): Promise<AccountInfo> {
    logger.log('[BybitService] Getting futures account info...');
    const timestamp = Date.now().toString();
    const params = JSON.stringify({ accountType: 'CONTRACT' });
    const signature = this.sign(params, timestamp);

    try {
      // 并行获取合约账户信息和现货余额
      const [futuresResponse, spotBalances] = await Promise.all([
        this.client.get('/v5/account/wallet-balance', {
          params: { accountType: 'CONTRACT' },
          headers: {
            'X-BAPI-API-KEY': this.apiKey,
            'X-BAPI-SIGN': signature,
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': '5000',
          },
        }),
        this.getSpotBalances().catch((err) => {
          logger.error('[BybitService] Error getting spot balances for account info:', err.message);
          return [];
        }),
      ]);

      logger.log('[BybitService] Futures account info retrieved successfully');

      if (futuresResponse.data.retCode !== 0) {
        throw new Error(`Bybit API Error: ${futuresResponse.data.retMsg}`);
      }

      const accountData = futuresResponse.data.result.list[0];

      // 计算现货账户总资产（USDT价值）
      const spotTotalUSDT = spotBalances.reduce((sum, balance) => sum + (balance.usdValue || 0), 0);
      logger.log('[BybitService] Spot total USDT:', spotTotalUSDT);

      const totalMarginBalance = parseFloat(accountData.totalMarginBalance || '0');
      const accountInfo: AccountInfo = {
        exchange: this.exchangeType,
        totalWalletBalance: parseFloat(accountData.totalWalletBalance || '0'),
        totalUnrealizedProfit: parseFloat(accountData.totalPerpUPL || '0'),
        totalMarginBalance: totalMarginBalance,
        availableBalance: parseFloat(accountData.totalAvailableBalance || '0'),
        maxWithdrawAmount: parseFloat(accountData.totalAvailableBalance || '0'),
        spotTotalUSDT: spotTotalUSDT,
        totalAssets: spotTotalUSDT + totalMarginBalance,
      };

      logger.log('[BybitService] Total assets (spot + futures):', accountInfo.totalAssets);

      return accountInfo;
    } catch (error: any) {
      logger.error('[BybitService] Error getting futures account info:', error.message);
      throw error;
    }
  }
}

