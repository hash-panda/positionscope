import { optionalNumber } from '../utils/position-math';
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { decimal, finiteTotal, invalidAccount, spotBalances, valueSpotBalances } from './hyperliquid-account';
import {
  IExchangeService,
  ExchangeType,
  ExchangeCredentials,
  Position,
  AccountInfo,
  SpotBalance,
} from '../types/exchange';

// Use the same account snapshot, not marginSummary.totalNtlPos (notional value).
// Reject incomplete payloads so ExchangeManager exposes an account error
// instead of publishing fabricated zero PnL.
function accountUnrealizedPnl(account: any): number {
  const invalid = () => new Error('Hyperliquid 未实现盈亏数据不完整，请重试');
  if (!Array.isArray(account?.assetPositions)) throw invalid();
  let total = 0;
  for (const entry of account.assetPositions) {
    const value = entry?.position?.unrealizedPnl;
    if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
      throw invalid();
    }
    const pnl = Number(value);
    total += pnl;
    if (!Number.isFinite(pnl) || !Number.isFinite(total)) throw invalid();
  }
  return total;
}

export class HyperliquidService implements IExchangeService {
  private apiKey: string = ''; // Hyperliquid uses wallet address
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
      logger.log('[HyperliquidService] Wallet address configured');

      if (typeof proxyUrl === 'string') {
        this.setProxy(proxyUrl.trim());
      }
    } else {
      const credentials = credentialsOrApiKey;
      this.apiKey = credentials.apiKey; // Wallet address
      logger.log('[HyperliquidService] Wallet address configured');

      if (typeof credentials.proxyUrl === 'string') {
        this.setProxy(credentials.proxyUrl.trim());
      }
    }
  }

  setProxy(proxyUrl: string) {
    this.proxyUrl = proxyUrl;
    let proxyConfig: any = false;

    if (proxyUrl) {
      logger.log('[HyperliquidService] Configuring proxy');
      try {
        const url = new URL(proxyUrl);
        proxyConfig = {
          host: url.hostname,
          port: parseInt(url.port),
          protocol: url.protocol.replace(':', ''),
        };
        logger.log('[HyperliquidService] Proxy config:', proxyConfig);
      } catch (error) {
        logger.error('[HyperliquidService] Invalid proxy URL');
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

  private async readInfo(type: string): Promise<any> {
    try {
      return (await this.client.post('/info', { type, ...(
        type === 'spotMetaAndAssetCtxs' ? {} : { user: this.apiKey }
      ) })).data;
    } catch {
      // Axios errors may carry the wallet address, request config or response body.
      throw Object.assign(new Error('Hyperliquid 读取失败，请检查网络后重试'), { code: 'HYPERLIQUID_READ_FAILED' });
    }
  }

  private async requireStandardAccount(): Promise<void> {
    const mode = await this.readInfo('userAbstraction');
    if (mode !== 'disabled') {
      throw Object.assign(new Error('Hyperliquid 暂仅支持标准账户；统一、组合保证金或未知模式已停止汇总'), {
        code: 'HYPERLIQUID_UNSUPPORTED_ACCOUNT',
      });
    }
  }

  private async readSpotBalances(): Promise<SpotBalance[]> {
    const balances = spotBalances(await this.readInfo('spotClearinghouseState'));
    if (!balances.length) return [];
    return valueSpotBalances(balances, await this.readInfo('spotMetaAndAssetCtxs'));
  }

  async getSpotBalances(): Promise<SpotBalance[]> {
    await this.requireStandardAccount();
    return this.readSpotBalances();
  }

  async getFuturesPositions(): Promise<Position[]> {
    logger.log('[HyperliquidService] Getting futures positions...');

    try {
      await this.requireStandardAccount();
      const response = { data: await this.readInfo('clearinghouseState') };
      if (!Array.isArray(response.data?.assetPositions)) throw invalidAccount();
      const positions: Position[] = [];
      const symbols = new Set<string>();
      for (const entry of response.data.assetPositions) {
        const p = entry?.position;
        const quantity = decimal(p?.szi);
        if (quantity === 0) continue;
        if (typeof p.coin !== 'string' || !/^[a-zA-Z0-9._:/-]{1,60}$/.test(p.coin) || symbols.has(p.coin)) throw invalidAccount();
        symbols.add(p.coin);
        const entryPrice = decimal(p.entryPx);
        const value = decimal(p.positionValue);
        decimal(p.unrealizedPnl);
        if (entryPrice <= 0 || value <= 0 || !Number.isSafeInteger(p.leverage?.value) || p.leverage.value < 1 ||
            !['cross', 'isolated'].includes(p.leverage.type)) throw invalidAccount();
        const mark = finiteTotal(value / Math.abs(quantity));
        if (mark <= 0) throw invalidAccount();
        const margin = decimal(p.marginUsed);
        if (margin < 0) throw invalidAccount();
        positions.push({
          exchange: this.exchangeType, symbol: p.coin, positionAmt: p.szi,
          entryPrice: p.entryPx, markPrice: String(mark), unRealizedProfit: p.unrealizedPnl,
          marginType: p.leverage.type, isolatedMargin: null, usedMargin: String(margin),
          leverage: String(p.leverage.value), instrumentId: p.coin, positionId: p.coin,
          baseAsset: p.coin, settlementAsset: 'USDC', marginCurrency: 'USDC', rawQuantity: p.szi, rawQuantityUnit: 'base',
          liquidationPrice: optionalNumber(p.liquidationPx) !== null && Number(p.liquidationPx) > 0 ? String(p.liquidationPx) : null,
          initialMargin: null, maintenanceMargin: null, fetchedAt: Date.now(),
          sourceUpdatedAt: optionalNumber(response.data.time), priceSource: 'position_value_derived',
        });
      }

      logger.log('[HyperliquidService] Active positions count:', positions.length);
      return positions;
    } catch (error) {
      logger.error('[HyperliquidService] Error getting futures positions:');
      logger.error('[HyperliquidService] Position request failed');
      throw error;
    }
  }

  async getAccountBalance(): Promise<any> {
    logger.log('[HyperliquidService] Getting account balance...');

    try {
      await this.requireStandardAccount();
      const response = { data: await this.readInfo('clearinghouseState') };

      logger.log('[HyperliquidService] Account balance retrieved successfully');
      return response.data;
    } catch (error: any) {
      logger.error('[HyperliquidService] Account request failed');
      throw error;
    }
  }

  async getFuturesAccountInfo(): Promise<AccountInfo> {
    logger.log('[HyperliquidService] Getting futures account info...');

    try {
      await this.requireStandardAccount();
      // A failed balance/price request must fail this account, not become zero.
      const [accountData, balances] = await Promise.all([
        this.readInfo('clearinghouseState'), this.readSpotBalances(),
      ]);
      const marginSummary = accountData?.marginSummary;
      const totalMarginBalance = decimal(marginSummary?.accountValue);
      const marginUsed = decimal(marginSummary?.totalMarginUsed);
      const withdrawable = decimal(accountData?.withdrawable);
      if (marginUsed < 0 || withdrawable < 0) throw invalidAccount();
      const pnl = accountUnrealizedPnl(accountData);
      const spotTotalUSDT = balances.reduce((sum, balance) => finiteTotal(sum + balance.usdValue!), 0);
      const accountInfo: AccountInfo = {
        exchange: this.exchangeType,
        totalWalletBalance: finiteTotal(totalMarginBalance - pnl),
        totalUnrealizedProfit: pnl,
        totalMarginBalance,
        // Estimate of unused margin, not an order-size or withdrawal limit.
        availableBalance: Math.max(0, finiteTotal(totalMarginBalance - marginUsed)),
        maxWithdrawAmount: withdrawable,
        spotTotalUSDT,
        totalAssets: finiteTotal(spotTotalUSDT + totalMarginBalance), fetchedAt: Date.now(),
        valuationNotes: ['标准账户默认永续DEX加现货；USDC/USDT按1:1估算。', 'marginUsed是已用保证金，不作为维持保证金。'],
        marginFacts: {scope: 'default_perps_cross_only', currency: 'USDC', mode: 'standard',
          equity: optionalNumber(accountData.crossMarginSummary?.accountValue), initialMargin: null,
          maintenanceMargin: optionalNumber(accountData.crossMaintenanceMarginUsed)},
      };

      return accountInfo;
    } catch (error: any) {
      logger.error('[HyperliquidService] Account mapping failed');
      throw error;
    }
  }
}

