import { normalizeBinancePosition, binancePositionQuantity } from './position-normalize';
import { numeric, optionalNumber, sumKnown } from '../utils/position-math';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { requestDiagnostic } from '../utils/request-diagnostics';
import { BinanceDataError } from '../utils/binance-diagnostics';
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

      if (typeof proxyUrl === 'string') {
        this.setProxy(proxyUrl.trim());
      }
    } else {
      // 新的调用方式
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
        // 解析代理 URL
        const url = new URL(proxyUrl);
        proxyConfig = {
          host: url.hostname,
          port: parseInt(url.port),
          protocol: url.protocol.replace(':', ''),
        };
        logger.log('[BinanceService] Proxy configured');
      } catch (error) {
        logger.error('[Exchange] Invalid proxy URL');
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

    try {
      const response = await this.spotClient.get('/api/v3/account', {
        params: { ...params, signature },
        headers: { 'X-MBX-APIKEY': this.apiKey },
      });

      logger.log('[BinanceService] Spot balances received');

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

      // 获取价格用于计算 USD 价值
      if (balances.length > 0) {
        await this.enrichWithPrices(balances);
      }

      return balances.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));
    } catch (error: any) {
      logger.error('[BinanceService] Spot request failed', requestDiagnostic(error));
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
      logger.error('[BinanceService] Public valuation prices unavailable');
    }
  }

  private async futuresGet(path: string): Promise<any> {
    const params = { timestamp: Date.now() };
    const response = await this.futuresClient.get(path, {
      params: {...params, signature: this.sign(params)}, headers: {'X-MBX-APIKEY': this.apiKey},
    });
    return response.data;
  }

  async getFuturesPositions(): Promise<Position[]> {
    const [positions, configs] = await Promise.all([
      this.futuresGet('/fapi/v3/positionRisk'), this.futuresGet('/fapi/v1/symbolConfig'),
    ]);
    if (!Array.isArray(positions)) throw new BinanceDataError('BINANCE_INVALID_POSITION', 'response');
    if (!Array.isArray(configs) || configs.some(c => !c || typeof c !== 'object' || Array.isArray(c) || typeof c.symbol !== 'string' || !c.symbol.length)) throw new BinanceDataError('BINANCE_INVALID_CONFIG');
    const configMap = new Map(configs.map((c: any) => [c.symbol, c]));
    if (configMap.size !== configs.length) throw new BinanceDataError('BINANCE_INVALID_CONFIG');
    try {
      return positions.filter((p: any) => binancePositionQuantity(p) !== 0)
        .map((p: any) => normalizeBinancePosition(p, configMap.get(p.symbol)));
    } catch (error) {
      if (error instanceof BinanceDataError) throw error;
      throw new BinanceDataError('BINANCE_INVALID_POSITION', 'response');
    }
  }

  async getAccountBalance(): Promise<any> { return this.futuresGet('/fapi/v3/balance'); }

  async getFuturesAccountInfo(): Promise<AccountInfo> {
    const [data, config, spot] = await Promise.all([
      this.futuresGet('/fapi/v3/account'), this.futuresGet('/fapi/v1/accountConfig'),
      this.getSpotBalances().catch(() => null),
    ]);
    if (!data || typeof data !== 'object' || Array.isArray(data) || !config || typeof config !== 'object' || Array.isArray(config) || typeof config.multiAssetsMargin !== 'boolean') throw new BinanceDataError('BINANCE_INVALID_ACCOUNT');
    try {
    const spotTotalUSDT = spot === null ? null : sumKnown(spot.map(b => b.usdValue));
    const equity = optionalNumber(data.totalMarginBalance);
    return {exchange: this.exchangeType, totalWalletBalance: optionalNumber(data.totalWalletBalance),
      totalUnrealizedProfit: optionalNumber(data.totalUnrealizedProfit), totalMarginBalance: equity,
      availableBalance: optionalNumber(data.availableBalance), maxWithdrawAmount: optionalNumber(data.maxWithdrawAmount),
      spotTotalUSDT, totalAssets: sumKnown([spotTotalUSDT, equity]), fetchedAt: Date.now(),
      valuationNotes: [...(spotTotalUSDT === null ? ['现货请求失败或部分币种缺少估值，总资产不可用。'] : []),
        ...(config.multiAssetsMargin ? ['多资产保证金以USD计价；USD与USDT按1:1估算。'] : [])],
      marginFacts: {scope: 'USD-M futures', currency: config.multiAssetsMargin ? 'USD' : 'USDT', mode: config.multiAssetsMargin ? 'multi-asset' : 'single-asset',
        equity, initialMargin: optionalNumber(data.totalInitialMargin), maintenanceMargin: optionalNumber(data.totalMaintMargin)},
    };
    } catch { throw new BinanceDataError('BINANCE_INVALID_ACCOUNT'); }
  }
}
