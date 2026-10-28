import { normalizeOKXPosition } from './position-normalize';
import { numeric, optionalNumber, sumKnown } from '../utils/position-math';
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

      if (typeof proxyUrl === 'string') {
        this.setProxy(proxyUrl.trim());
      }
    } else {
      const credentials = credentialsOrApiKey;
      this.apiKey = credentials.apiKey;
      this.apiSecret = credentials.apiSecret;
      this.apiPassphrase = credentials.passphrase || ''; // OKX specific

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
        logger.log('[OKXService] Proxy configured');
      } catch (error) {
        logger.error('[Exchange] Invalid proxy URL');
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

  private instruments: {expires: number; values: Map<string, any>} | null = null;

  private async read(path: string, authenticated = true): Promise<any[]> {
    const response = await this.client.get(path, authenticated ? {headers: this.getHeaders('GET', path)} : {});
    if (response.data.code !== '0' || !Array.isArray(response.data.data)) throw new Error('OKX只读结果失败或缺失');
    return response.data.data;
  }

  async getSpotBalances(): Promise<SpotBalance[]> {
    throw new Error('OKX交易账户含共享抵押与衍生品权益，不作为独立现货余额返回');
  }

  private async specifications(force = false): Promise<Map<string, any>> {
    if (!force && this.instruments && this.instruments.expires > Date.now()) return this.instruments.values;
    const data = await this.read('/api/v5/public/instruments?instType=SWAP', false);
    const values = new Map(data.map(p => [p.instId, p]));
    this.instruments = {values, expires: Date.now() + 15 * 60_000};
    return values;
  }

  async getFuturesPositions(): Promise<Position[]> {
    const [data, initial] = await Promise.all([this.read('/api/v5/account/positions?instType=SWAP'), this.specifications()]);
    const active = data.filter(p => numeric(p.pos) !== 0);
    const specs = active.some(p => !initial.has(p.instId)) ? await this.specifications(true) : initial;
    return active.map(p => normalizeOKXPosition(p, specs.get(p.instId)));
  }

  async getAccountBalance(): Promise<any> { return this.read('/api/v5/account/balance'); }

  async getFuturesAccountInfo(): Promise<AccountInfo> {
    const [trading, funding] = await Promise.all([
      this.getAccountBalance(), this.read('/api/v5/asset/balances').catch(() => null),
    ]);
    const data = trading[0];
    if (!data) throw new Error('OKX交易账户数据缺失');
    const equity = optionalNumber(data.totalEq);
    let fundingValue: number | null = null;
    if (funding) {
      const balances = funding.filter(p => numeric(p.bal) !== 0);
      let prices = new Map<string, number>();
      if (balances.some(p => p.ccy !== 'USDT')) {
        const tickers = await this.read('/api/v5/market/tickers?instType=SPOT', false).catch(() => []);
        prices = new Map(tickers.map(p => [p.instId, optionalNumber(p.last)]).filter((p): p is [string, number] => typeof p[1] === 'number' && p[1] > 0));
      }
      fundingValue = sumKnown(balances.map(p => p.ccy === 'USDT' ? numeric(p.bal) : prices.has(`${p.ccy}-USDT`) ? numeric(p.bal) * prices.get(`${p.ccy}-USDT`)! : null));
    }
    return {exchange: this.exchangeType, totalWalletBalance: null,
      totalUnrealizedProfit: optionalNumber(data.upl), totalMarginBalance: equity,
      availableBalance: null, maxWithdrawAmount: null, spotTotalUSDT: null,
      totalAssets: sumKnown([equity, fundingValue]), tradingAccountUSDT: equity, fundingAccountUSDT: fundingValue,
      fetchedAt: Date.now(), valuationNotes: ['交易账户权益以USD计价，含共享抵押及衍生品；不作为纯合约或现货余额。', 'USD与USDT按1:1估算。',
        ...(fundingValue === null ? ['资金账户请求失败或缺少估值，总资产不可用。'] : [])],
      marginFacts: {scope: 'trading_account_adjusted', currency: 'USD', mode: 'account-defined', equity: optionalNumber(data.adjEq),
        initialMargin: optionalNumber(data.imr), maintenanceMargin: optionalNumber(data.mmr),
        nativeRatio: {name: 'mgnRatio', value: optionalNumber(data.mgnRatio), direction: 'lower-risk'}},
    };
  }
}
