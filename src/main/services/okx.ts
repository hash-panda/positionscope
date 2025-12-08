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

export class OKXService implements IExchangeService {
  private apiKey: string = '';
  private apiSecret: string = '';
  private apiPassphrase: string = ''; // OKX requires passphrase
  private client: AxiosInstance;
  private proxyUrl: string = '';
  private readonly exchangeType = ExchangeType.OKX;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://www.okx.com',
      timeout: 30000,
    });

    this.addInterceptors();
  }

  private addInterceptors() {
    this.client.interceptors.response.use(
      response => {
        logger.log('[OKXService] Response received successfully');
        return response;
      },
      error => {
        logger.error('[OKXService] Request failed');
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
      // OKX passphrase should be passed as part of credentials
      logger.log('[OKXService] Credentials set - API Key:', credentialsOrApiKey.substring(0, 8) + '...');

      if (proxyUrl && proxyUrl.trim()) {
        this.setProxy(proxyUrl.trim());
      }
    } else {
      const credentials = credentialsOrApiKey;
      this.apiKey = credentials.apiKey;
      this.apiSecret = credentials.apiSecret;
      this.apiPassphrase = credentials.passphrase || ''; // OKX specific
      logger.log('[OKXService] Credentials set - API Key:', credentials.apiKey.substring(0, 8) + '...');

      if (credentials.proxyUrl && credentials.proxyUrl.trim()) {
        this.setProxy(credentials.proxyUrl.trim());
      }
    }
  }

  setProxy(proxyUrl: string) {
    this.proxyUrl = proxyUrl;
    let proxyConfig: any = false;

    if (proxyUrl) {
      logger.log('[OKXService] Setting proxy:', proxyUrl);
      try {
        const url = new URL(proxyUrl);
        proxyConfig = {
          host: url.hostname,
          port: parseInt(url.port),
          protocol: url.protocol.replace(':', ''),
        };
        logger.log('[OKXService] Proxy config:', proxyConfig);
      } catch (error) {
        logger.error('[OKXService] Invalid proxy URL:', error);
        return;
      }
    } else {
      logger.log('[OKXService] No proxy configured');
    }

    this.client = axios.create({
      baseURL: 'https://www.okx.com',
      timeout: 30000,
      proxy: proxyConfig,
    });

    this.addInterceptors();
  }

  hasCredentials(): boolean {
    return !!this.apiKey && !!this.apiSecret && !!this.apiPassphrase;
  }

  private sign(timestamp: string, method: string, path: string, body: string = ''): string {
    const message = timestamp + method + path + body;
    return crypto.createHmac('sha256', this.apiSecret).update(message).digest('base64');
  }

  private getHeaders(method: string, path: string, body: string = '') {
    const timestamp = new Date().toISOString();
    const sign = this.sign(timestamp, method, path, body);

    return {
      'OK-ACCESS-KEY': this.apiKey,
      'OK-ACCESS-SIGN': sign,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': this.apiPassphrase,
      'Content-Type': 'application/json',
    };
  }

  async getSpotBalances(): Promise<SpotBalance[]> {
    logger.log('[OKXService] Getting spot balances...');

    try {
      // 并行获取交易账户和资金账户的余额
      const [tradingResponse, fundingResponse] = await Promise.all([
        this.client.get('/api/v5/account/balance', {
          headers: this.getHeaders('GET', '/api/v5/account/balance'),
        }),
        this.client.get('/api/v5/asset/balances', {
          headers: this.getHeaders('GET', '/api/v5/asset/balances'),
        }).catch((err) => {
          logger.error('[OKXService] Error getting funding balances:', err.message);
          return null;
        }),
      ]);

      logger.log('[OKXService] Trading account response status:', tradingResponse.status);

      if (tradingResponse.data.code !== '0') {
        throw new Error(`OKX API Error: ${tradingResponse.data.msg}`);
      }

      const balances: SpotBalance[] = [];

      // 处理交易账户余额
      const tradingDetails = tradingResponse.data.data[0]?.details || [];
      for (const detail of tradingDetails) {
        const total = parseFloat(detail.eq);
        if (total > 0) {
          balances.push({
            exchange: this.exchangeType,
            asset: detail.ccy,
            free: detail.availBal,
            locked: (parseFloat(detail.eq) - parseFloat(detail.availBal)).toString(),
            total,
            usdValue: parseFloat(detail.eqUsd || '0'),
          });
        }
      }

      // 处理资金账户余额
      if (fundingResponse && fundingResponse.data.code === '0') {
        const fundingBalances = fundingResponse.data.data || [];
        logger.log('[OKXService] Funding account balances count:', fundingBalances.length);

        for (const item of fundingBalances) {
          const total = parseFloat(item.bal || '0');
          if (total > 0) {
            // 检查是否已存在该币种，如果存在则累加
            const existingIndex = balances.findIndex(b => b.asset === item.ccy);
            if (existingIndex >= 0) {
              const existing = balances[existingIndex];
              existing.total += total;
              existing.free = (parseFloat(existing.free) + parseFloat(item.availBal || '0')).toString();
              existing.locked = (parseFloat(existing.locked) + parseFloat(item.frozenBal || '0')).toString();
              // USD价值需要重新计算，但目前资金账户API不提供usdValue，暂时忽略
            } else {
              balances.push({
                exchange: this.exchangeType,
                asset: item.ccy,
                free: item.availBal || '0',
                locked: item.frozenBal || '0',
                total,
                usdValue: 0, // 资金账户API不提供USD价值，需要后续计算
              });
            }
          }
        }
      }

      logger.log('[OKXService] Total balances (trading + funding):', balances.length);
      return balances.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));
    } catch (error: any) {
      logger.error('[OKXService] Error getting spot balances:');
      logger.error('[OKXService] Error message:', error.message);
      throw error;
    }
  }

  async getFuturesPositions(): Promise<Position[]> {
    logger.log('[OKXService] Getting futures positions...');
    const path = '/api/v5/account/positions';

    try {
      const response = await this.client.get(path, {
        params: { instType: 'SWAP' }, // USDT-M perpetual contracts
        headers: this.getHeaders('GET', path + '?instType=SWAP'),
      });

      logger.log('[OKXService] Futures positions response status:', response.status);

      if (response.data.code !== '0') {
        throw new Error(`OKX API Error: ${response.data.msg}`);
      }

      const positions: Position[] = response.data.data
        .filter((p: any) => parseFloat(p.pos) !== 0)
        .map((p: any) => ({
          exchange: this.exchangeType,
          symbol: p.instId.replace('-SWAP', ''),
          positionAmt: p.pos,
          entryPrice: p.avgPx,
          markPrice: p.markPx,
          unRealizedProfit: p.upl,
          marginType: p.mgnMode === 'cross' ? 'cross' : 'isolated',
          isolatedMargin: p.imr,
          leverage: p.lever,
        }));

      logger.log('[OKXService] Active positions count:', positions.length);
      return positions;
    } catch (error: any) {
      logger.error('[OKXService] Error getting futures positions:');
      logger.error('[OKXService] Error message:', error.message);
      throw error;
    }
  }

  async getAccountBalance(): Promise<any> {
    logger.log('[OKXService] Getting account balance...');
    const path = '/api/v5/account/balance';

    try {
      const response = await this.client.get(path, {
        headers: this.getHeaders('GET', path),
      });

      logger.log('[OKXService] Account balance retrieved successfully');
      return response.data.data;
    } catch (error: any) {
      logger.error('[OKXService] Error getting account balance:', error.message);
      throw error;
    }
  }

  async getFuturesAccountInfo(): Promise<AccountInfo> {
    logger.log('[OKXService] Getting futures account info...');

    try {
      // 并行获取交易账户、资金账户
      const [tradingResponse, fundingResponse] = await Promise.all([
        this.client.get('/api/v5/account/balance', {
          headers: this.getHeaders('GET', '/api/v5/account/balance'),
        }),
        this.client.get('/api/v5/asset/balances', {
          headers: this.getHeaders('GET', '/api/v5/asset/balances'),
        }).catch((err) => {
          logger.error('[OKXService] Error getting funding account:', err.message);
          return null;
        }),
      ]);

      logger.log('[OKXService] Futures account info retrieved successfully');

      if (tradingResponse.data.code !== '0') {
        throw new Error(`OKX API Error: ${tradingResponse.data.msg}`);
      }

      const tradingData = tradingResponse.data.data[0];

      // 计算交易账户总资产（USDT价值）
      const tradingAccountUSDT = parseFloat(tradingData.totalEq || '0');
      logger.log('[OKXService] Trading account USDT:', tradingAccountUSDT);

      // 计算资金账户总资产（USDT价值）
      let fundingAccountUSDT = 0;
      if (fundingResponse && fundingResponse.data.code === '0') {
        const fundingBalances = fundingResponse.data.data || [];
        const nonUsdtBalances: { ccy: string; bal: number }[] = [];

        // 先处理USDT
        for (const item of fundingBalances) {
          const bal = parseFloat(item.bal || '0');
          if (bal > 0) {
            if (item.ccy === 'USDT') {
              fundingAccountUSDT += bal;
            } else {
              nonUsdtBalances.push({ ccy: item.ccy, bal });
            }
          }
        }

        // 获取其他币种的USDT价格
        if (nonUsdtBalances.length > 0) {
          try {
            const tickerResponse = await this.client.get('/api/v5/market/tickers', {
              params: { instType: 'SPOT' },
              headers: this.getHeaders('GET', '/api/v5/market/tickers?instType=SPOT'),
            });

            if (tickerResponse.data.code === '0') {
              const tickers = tickerResponse.data.data || [];
              const priceMap: Record<string, number> = {};

              // 构建价格映射
              for (const ticker of tickers) {
                if (ticker.instId.endsWith('-USDT')) {
                  const ccy = ticker.instId.replace('-USDT', '');
                  priceMap[ccy] = parseFloat(ticker.last || '0');
                }
              }

              // 计算非USDT币种的价值
              for (const { ccy, bal } of nonUsdtBalances) {
                const price = priceMap[ccy];
                if (price) {
                  fundingAccountUSDT += bal * price;
                  logger.log(`[OKXService] Funding account ${ccy}: ${bal} * ${price} = ${bal * price} USDT`);
                } else {
                  logger.log(`[OKXService] No price for funding account ${ccy}: ${bal}`);
                }
              }
            }
          } catch (err: any) {
            logger.error('[OKXService] Error fetching prices for funding account:', err.message);
          }
        }

        logger.log('[OKXService] Funding account total USDT:', fundingAccountUSDT);
      }

      // 总资产 = 交易账户 + 资金账户
      const totalAssets = tradingAccountUSDT + fundingAccountUSDT;

      const accountInfo: AccountInfo = {
        exchange: this.exchangeType,
        totalWalletBalance: tradingAccountUSDT,
        totalUnrealizedProfit: parseFloat(tradingData.upl || '0'),
        totalMarginBalance: tradingAccountUSDT,
        availableBalance: parseFloat(tradingData.availBal || '0'),
        maxWithdrawAmount: parseFloat(tradingData.availBal || '0'),
        spotTotalUSDT: 0, // OKX不区分现货/合约
        totalAssets: totalAssets,
        fundingAccountUSDT: fundingAccountUSDT,
        tradingAccountUSDT: tradingAccountUSDT,
      };

      logger.log('[OKXService] Total:', totalAssets, 'Funding:', fundingAccountUSDT, 'Trading:', tradingAccountUSDT);

      return accountInfo;
    } catch (error: any) {
      logger.error('[OKXService] Error getting futures account info:', error.message);
      throw error;
    }
  }
}
