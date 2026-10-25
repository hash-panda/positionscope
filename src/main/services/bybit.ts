import { bybitMode, normalizeBybitPosition } from './position-normalize';
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

  // Sign exactly the query string sent on the wire; GET authentication is not JSON.
  private async signedGet(path: string, params: Record<string, string> = {}): Promise<any> {
    const query = new URLSearchParams(params).toString();
    const timestamp = String(Date.now());
    const response = await this.client.get(path + (query ? `?${query}` : ''), {
      headers: { 'X-BAPI-API-KEY': this.apiKey, 'X-BAPI-SIGN': this.sign(query, timestamp),
        'X-BAPI-TIMESTAMP': timestamp, 'X-BAPI-RECV-WINDOW': '5000' },
    });
    if (response.data.retCode !== 0) throw new Error(`Bybit只读请求失败 (${response.data.retCode})`);
    if (!response.data.result) throw new Error('Bybit返回结果缺失');
    return response.data.result;
  }

  async getSpotBalances(): Promise<SpotBalance[]> {
    throw new Error('Bybit UNIFIED币种余额与合约抵押共享，不提供独立现货余额');
  }

  async getFuturesPositions(): Promise<Position[]> {
    const mode = bybitMode(await this.signedGet('/v5/account/info'));
    const result: Position[] = [];
    const seen = new Set<string>();
    let cursor = '';
    for (let page = 0; page < 20; page++) {
      const data = await this.signedGet('/v5/position/list', {
        category: 'linear', settleCoin: 'USDT', limit: '200', ...(cursor ? {cursor} : {}),
      });
      if (!Array.isArray(data.list)) throw new Error('Bybit持仓列表缺失');
      for (const p of data.list) if (numeric(p.size) !== 0) result.push(normalizeBybitPosition(p, mode));
      const next = data.nextPageCursor;
      if (!next) return result;
      if (typeof next !== 'string' || seen.has(next)) throw new Error('Bybit分页游标无效');
      seen.add(next); cursor = next;
    }
    throw new Error('Bybit持仓超出完整分页上限，未使用部分结果');
  }

  async getAccountBalance(): Promise<any> {
    return this.signedGet('/v5/account/wallet-balance', {accountType: 'UNIFIED'});
  }

  async getFuturesAccountInfo(): Promise<AccountInfo> {
    const [info, wallet] = await Promise.all([this.signedGet('/v5/account/info'), this.getAccountBalance()]);
    const mode = bybitMode(info);
    const account = wallet.list?.find((item: any) => item.accountType === 'UNIFIED');
    if (!account) throw new Error('Bybit UNIFIED账户结果缺失');
    // Bybit explicitly declares ALL account-wide fields inapplicable in isolated mode.
    const read = (key: string) => mode === 'isolated' ? null : optionalNumber(account[key]);
    const equity = read('totalMarginBalance');
    const notes = ['UNIFIED现货与抵押共享，不能再叠加独立现货余额。', 'USD与USDT按1:1估算；未包含资金账户。'];
    if (mode === 'isolated') notes.push('逐仓模式不适用账户级保证金总额；币种USD估值不等于可共享保证金。');
    const assetValue = mode === 'isolated'
      ? (Array.isArray(account.coin) ? sumKnown(account.coin.map((c: any) => optionalNumber(c.usdValue))) : null)
      : read('totalEquity');
    return { exchange: this.exchangeType, totalWalletBalance: read('totalWalletBalance'),
      totalUnrealizedProfit: read('totalPerpUPL'), totalMarginBalance: equity,
      availableBalance: read('totalAvailableBalance'), maxWithdrawAmount: null,
      spotTotalUSDT: null, totalAssets: assetValue, fetchedAt: Date.now(), valuationNotes: notes,
      marginFacts: {scope: 'UNIFIED', currency: 'USD', mode, equity,
        initialMargin: read('totalInitialMargin'), maintenanceMargin: read('totalMaintenanceMargin'),
        nativeRatio: {name: 'accountMMRate', value: read('accountMMRate'), direction: 'higher-risk'}},
    };
  }
}
