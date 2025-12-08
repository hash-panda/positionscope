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

export class BinanceService implements IExchangeService {
  private apiKey: string = '';
  private apiSecret: string = '';
  private spotClient: AxiosInstance;
  private futuresClient: AxiosInstance;
  private proxyUrl: string = '';
  private readonly exchangeType = ExchangeType.BINANCE;

  constructor() {
    // 初始创建不带代理的客户端
    this.spotClient = axios.create({
      baseURL: 'https://api.binance.com',
      timeout: 30000,
    });

    this.futuresClient = axios.create({
      baseURL: 'https://fapi.binance.com',
      timeout: 30000,
    });

    // 初始添加拦截器
    this.addInterceptors();
  }

  private addInterceptors() {
    this.futuresClient.interceptors.response.use(
      response => {
        logger.log('[BinanceService] Response received successfully');
        return response;
      },
      error => {
        logger.error('[BinanceService] Request failed');
        return Promise.reject(error);
      }
    );

    this.spotClient.interceptors.response.use(
      response => {
        logger.log('[BinanceService] Response received successfully');
        return response;
      },
      error => {
        logger.error('[BinanceService] Request failed');
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
      // 旧的调用方式（向后兼容）
      this.apiKey = credentialsOrApiKey;
      this.apiSecret = apiSecret || '';
      logger.log('[BinanceService] Credentials set - API Key:', credentialsOrApiKey.substring(0, 8) + '...');

      if (proxyUrl && proxyUrl.trim()) {
        this.setProxy(proxyUrl.trim());
      }
    } else {
      // 新的调用方式
      const credentials = credentialsOrApiKey;
      this.apiKey = credentials.apiKey;
      this.apiSecret = credentials.apiSecret;
      logger.log('[BinanceService] Credentials set - API Key:', credentials.apiKey.substring(0, 8) + '...');

      if (credentials.proxyUrl && credentials.proxyUrl.trim()) {
        this.setProxy(credentials.proxyUrl.trim());
      }
    }
  }

  setProxy(proxyUrl: string) {
    this.proxyUrl = proxyUrl;
    let proxyConfig: any = false;

    if (proxyUrl) {
      logger.log('[BinanceService] Setting proxy:', proxyUrl);
      try {
        // 解析代理 URL
        const url = new URL(proxyUrl);
        proxyConfig = {
          host: url.hostname,
          port: parseInt(url.port),
          protocol: url.protocol.replace(':', ''),
        };
        logger.log('[BinanceService] Proxy config:', proxyConfig);
      } catch (error) {
        logger.error('[BinanceService] Invalid proxy URL:', error);
        return;
      }
    } else {
      logger.log('[BinanceService] No proxy configured');
    }

    // 重新创建客户端
    this.spotClient = axios.create({
      baseURL: 'https://api.binance.com',
      timeout: 30000,
      proxy: proxyConfig,
    });

    this.futuresClient = axios.create({
      baseURL: 'https://fapi.binance.com',
      timeout: 30000,
      proxy: proxyConfig,
    });

    // 重新添加拦截器
    this.addInterceptors();
  }

  hasCredentials(): boolean {
    return !!this.apiKey && !!this.apiSecret;
  }

  private sign(params: Record<string, any>): string {
    const queryString = Object.keys(params)
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  async getSpotBalances(): Promise<SpotBalance[]> {
    logger.log('[BinanceService] Getting spot balances...');
    const timestamp = Date.now();
    const params = { timestamp };
    const signature = this.sign(params);

    logger.log('[BinanceService] Request URL:', this.spotClient.defaults.baseURL + '/api/v3/account');
    logger.log('[BinanceService] Request params:', { ...params, signature: signature.substring(0, 10) + '...' });
    logger.log('[BinanceService] API Key:', this.apiKey.substring(0, 8) + '...');

    try {
      const response = await this.spotClient.get('/api/v3/account', {
        params: { ...params, signature },
        headers: { 'X-MBX-APIKEY': this.apiKey },
      });

      logger.log('[BinanceService] Spot balances response status:', response.status);
      logger.log('[BinanceService] Spot balances count:', response.data.balances?.length);

      // 只返回余额大于 0 的资产
      const balances: SpotBalance[] = response.data.balances
        .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .map((b: any) => ({
          exchange: this.exchangeType,
          asset: b.asset,
          free: b.free,
          locked: b.locked,
          total: parseFloat(b.free) + parseFloat(b.locked),
        }));

      logger.log('[BinanceService] Filtered balances count:', balances.length);

      // 获取价格用于计算 USD 价值
      if (balances.length > 0) {
        await this.enrichWithPrices(balances);
      }

      return balances.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));
    } catch (error: any) {
      logger.error('[BinanceService] Error getting spot balances:');
      logger.error('[BinanceService] Error message:', error.message);
      logger.error('[BinanceService] Error response:', error.response?.data);
      logger.error('[BinanceService] Error status:', error.response?.status);
      logger.error('[BinanceService] Error code:', error.code);
      throw error;
    }
  }

  private async enrichWithPrices(balances: SpotBalance[]) {
    try {
      const response = await this.spotClient.get('/api/v3/ticker/price');
      const prices: Record<string, number> = {};

      response.data.forEach((item: any) => {
        prices[item.symbol] = parseFloat(item.price);
      });

      balances.forEach((balance) => {
        if (balance.asset === 'USDT') {
          balance.usdValue = balance.total;
        } else {
          const symbol = `${balance.asset}USDT`;
          if (prices[symbol]) {
            balance.usdValue = balance.total * prices[symbol];
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching prices:', error);
    }
  }

  async getFuturesPositions(): Promise<Position[]> {
    logger.log('[BinanceService] Getting futures positions...');
    const timestamp = Date.now();
    const params = { timestamp };
    const signature = this.sign(params);

    logger.log('[BinanceService] Request URL:', this.futuresClient.defaults.baseURL + '/fapi/v2/positionRisk');
    logger.log('[BinanceService] Request params:', { ...params, signature: signature.substring(0, 10) + '...' });
    logger.log('[BinanceService] API Key:', this.apiKey.substring(0, 8) + '...');

    try {
      const response = await this.futuresClient.get('/fapi/v2/positionRisk', {
        params: { ...params, signature },
        headers: { 'X-MBX-APIKEY': this.apiKey },
      });

      logger.log('[BinanceService] Futures positions response status:', response.status);
      logger.log('[BinanceService] Futures positions count:', response.data?.length);

      // 只返回有持仓的合约，并添加交易所标识
      const positions: Position[] = response.data
        .filter((p: any) => parseFloat(p.positionAmt) !== 0)
        .map((p: any) => ({
          exchange: this.exchangeType,
          symbol: p.symbol,
          positionAmt: p.positionAmt,
          entryPrice: p.entryPrice,
          markPrice: p.markPrice,
          unRealizedProfit: p.unRealizedProfit,
          marginType: p.marginType,
          isolatedMargin: p.isolatedMargin,
          leverage: p.leverage,
        }));

      logger.log('[BinanceService] Active positions count:', positions.length);

      return positions;
    } catch (error: any) {
      logger.error('[BinanceService] Error getting futures positions:');
      logger.error('[BinanceService] Error message:', error.message);
      logger.error('[BinanceService] Error response:', error.response?.data);
      logger.error('[BinanceService] Error status:', error.response?.status);
      logger.error('[BinanceService] Error code:', error.code);
      throw error;
    }
  }

  async getAccountBalance(): Promise<any> {
    logger.log('[BinanceService] Getting account balance...');
    const timestamp = Date.now();
    const params = { timestamp };
    const signature = this.sign(params);

    try {
      const response = await this.futuresClient.get('/fapi/v2/balance', {
        params: { ...params, signature },
        headers: { 'X-MBX-APIKEY': this.apiKey },
      });

      logger.log('[BinanceService] Account balance retrieved successfully');
      return response.data;
    } catch (error: any) {
      logger.error('[BinanceService] Error getting account balance:', error.message);
      throw error;
    }
  }

  // 获取合约账户信息（包括总余额、可用余额、未实现盈亏等）
  async getFuturesAccountInfo(): Promise<AccountInfo> {
    logger.log('[BinanceService] Getting futures account info...');
    const timestamp = Date.now();
    const params = { timestamp };
    const signature = this.sign(params);

    try {
      // 并行获取合约账户信息和现货账户信息
      const [futuresResponse, spotBalances] = await Promise.all([
        this.futuresClient.get('/fapi/v2/account', {
          params: { ...params, signature },
          headers: { 'X-MBX-APIKEY': this.apiKey },
        }),
        this.getSpotBalances().catch((err) => {
          logger.error('[BinanceService] Error getting spot balances for account info:', err.message);
          return [];
        }),
      ]);

      logger.log('[BinanceService] Futures account info retrieved successfully');

      // 计算现货账户总资产（USDT价值）
      const spotTotalUSDT = spotBalances.reduce((sum, balance) => sum + (balance.usdValue || 0), 0);
      logger.log('[BinanceService] Spot total USDT:', spotTotalUSDT);

      // 提取关键信息
      const totalMarginBalance = parseFloat(futuresResponse.data.totalMarginBalance || '0');
      const accountInfo: AccountInfo = {
        exchange: this.exchangeType,
        totalWalletBalance: parseFloat(futuresResponse.data.totalWalletBalance || '0'),
        totalUnrealizedProfit: parseFloat(futuresResponse.data.totalUnrealizedProfit || '0'),
        totalMarginBalance: totalMarginBalance,
        availableBalance: parseFloat(futuresResponse.data.availableBalance || '0'),
        maxWithdrawAmount: parseFloat(futuresResponse.data.maxWithdrawAmount || '0'),
        spotTotalUSDT: spotTotalUSDT,
        totalAssets: spotTotalUSDT + totalMarginBalance,
      };

      logger.log('[BinanceService] Total assets (spot + futures):', accountInfo.totalAssets);

      return accountInfo;
    } catch (error: any) {
      logger.error('[BinanceService] Error getting futures account info:', error.message);
      throw error;
    }
  }
}
