import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface SpotBalance {
  asset: string;
  free: string;
  locked: string;
  total: number;
  usdValue?: number;
}

export interface FuturesPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  marginType: string;
  isolatedMargin: string;
  leverage: string;
}

export class BinanceService {
  private apiKey: string = '';
  private apiSecret: string = '';
  private spotClient: AxiosInstance;
  private futuresClient: AxiosInstance;

  constructor() {
    // 检查是否设置了代理
    const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy;

    let proxyConfig: any = false;
    if (proxyUrl) {
      console.log('[BinanceService] Using proxy:', proxyUrl);
      // 解析代理 URL
      const url = new URL(proxyUrl);
      proxyConfig = {
        host: url.hostname,
        port: parseInt(url.port),
        protocol: url.protocol.replace(':', ''),
      };
    } else {
      console.log('[BinanceService] No proxy configured. If you experience connection issues, set HTTP_PROXY environment variable.');
    }

    const clientConfig = {
      timeout: 30000, // 增加到 30 秒
      proxy: proxyConfig, // 正确设置代理配置
    };

    this.spotClient = axios.create({
      ...clientConfig,
      baseURL: 'https://api.binance.com',
    });

    this.futuresClient = axios.create({
      ...clientConfig,
      baseURL: 'https://fapi.binance.com',
    });

    // 添加响应拦截器用于日志
    this.futuresClient.interceptors.response.use(
      response => {
        console.log('[BinanceService] Response received successfully');
        return response;
      },
      error => {
        console.error('[BinanceService] Request failed');
        return Promise.reject(error);
      }
    );

    this.spotClient.interceptors.response.use(
      response => {
        console.log('[BinanceService] Response received successfully');
        return response;
      },
      error => {
        console.error('[BinanceService] Request failed');
        return Promise.reject(error);
      }
    );
  }

  setCredentials(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    console.log('[BinanceService] Credentials set - API Key:', apiKey.substring(0, 8) + '...');
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
    console.log('[BinanceService] Getting spot balances...');
    const timestamp = Date.now();
    const params = { timestamp };
    const signature = this.sign(params);

    console.log('[BinanceService] Request URL:', this.spotClient.defaults.baseURL + '/api/v3/account');
    console.log('[BinanceService] Request params:', { ...params, signature: signature.substring(0, 10) + '...' });
    console.log('[BinanceService] API Key:', this.apiKey.substring(0, 8) + '...');

    try {
      const response = await this.spotClient.get('/api/v3/account', {
        params: { ...params, signature },
        headers: { 'X-MBX-APIKEY': this.apiKey },
      });

      console.log('[BinanceService] Spot balances response status:', response.status);
      console.log('[BinanceService] Spot balances count:', response.data.balances?.length);

      // 只返回余额大于 0 的资产
      const balances: SpotBalance[] = response.data.balances
        .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .map((b: any) => ({
          asset: b.asset,
          free: b.free,
          locked: b.locked,
          total: parseFloat(b.free) + parseFloat(b.locked),
        }));

      console.log('[BinanceService] Filtered balances count:', balances.length);

      // 获取价格用于计算 USD 价值
      if (balances.length > 0) {
        await this.enrichWithPrices(balances);
      }

      return balances.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));
    } catch (error: any) {
      console.error('[BinanceService] Error getting spot balances:');
      console.error('[BinanceService] Error message:', error.message);
      console.error('[BinanceService] Error response:', error.response?.data);
      console.error('[BinanceService] Error status:', error.response?.status);
      console.error('[BinanceService] Error code:', error.code);
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
      console.error('Error fetching prices:', error);
    }
  }

  async getFuturesPositions(): Promise<FuturesPosition[]> {
    console.log('[BinanceService] Getting futures positions...');
    const timestamp = Date.now();
    const params = { timestamp };
    const signature = this.sign(params);

    console.log('[BinanceService] Request URL:', this.futuresClient.defaults.baseURL + '/fapi/v2/positionRisk');
    console.log('[BinanceService] Request params:', { ...params, signature: signature.substring(0, 10) + '...' });
    console.log('[BinanceService] API Key:', this.apiKey.substring(0, 8) + '...');

    try {
      const response = await this.futuresClient.get('/fapi/v2/positionRisk', {
        params: { ...params, signature },
        headers: { 'X-MBX-APIKEY': this.apiKey },
      });

      console.log('[BinanceService] Futures positions response status:', response.status);
      console.log('[BinanceService] Futures positions count:', response.data?.length);

      // 只返回有持仓的合约
      const positions = response.data.filter((p: any) => parseFloat(p.positionAmt) !== 0);
      console.log('[BinanceService] Active positions count:', positions.length);

      return positions;
    } catch (error: any) {
      console.error('[BinanceService] Error getting futures positions:');
      console.error('[BinanceService] Error message:', error.message);
      console.error('[BinanceService] Error response:', error.response?.data);
      console.error('[BinanceService] Error status:', error.response?.status);
      console.error('[BinanceService] Error code:', error.code);
      throw error;
    }
  }

  async getAccountBalance(): Promise<any> {
    const timestamp = Date.now();
    const params = { timestamp };
    const signature = this.sign(params);

    const response = await this.futuresClient.get('/fapi/v2/balance', {
      params: { ...params, signature },
      headers: { 'X-MBX-APIKEY': this.apiKey },
    });

    return response.data;
  }
}
