import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { app } from 'electron';
import { AIProvider, AICredentials, AISettings } from './types/ai';

// 单个交易所的凭证
interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // OKX 需要
}

// 所有交易所的凭证
interface ExchangesCredentials {
  binance?: ExchangeCredentials;
  bybit?: ExchangeCredentials;
  okx?: ExchangeCredentials;
  hyperliquid?: ExchangeCredentials;
}

interface AppSettings {
  // 向后兼容：保留旧的单个 API Key（用于 Binance）
  apiKey?: string;
  apiSecret?: string;
  proxyUrl?: string;

  // 新的多交易所凭证存储
  exchanges?: ExchangesCredentials;

  // AI 设置
  ai?: AISettings;

  maxDisplayCount?: number;
  refreshInterval?: number;
  theme?: 'light' | 'dark' | 'auto';
  positionOrder?: string[]; // 用户自定义的持仓顺序
  hideAmounts?: boolean; // 是否隐藏金额
  debugMode?: boolean; // 是否开启调试模式
  windowOpacity?: number; // 窗口透明度 (0.1 - 1.0)
  autoLaunch?: boolean; // 是否开机自动启动
}

export class SettingsManager {
  private settingsPath: string;
  private settings: AppSettings = {};
  private persisted: AppSettings = {};

  constructor() {
    const userDataPath = app.getPath('userData');
    this.settingsPath = path.join(userDataPath, 'settings.json');
    this.loadSettings();
    this.persisted = JSON.parse(JSON.stringify(this.settings));
  }

  private loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        this.settings = JSON.parse(data);
        console.log('[SettingsManager] Settings loaded from:', this.settingsPath);
      } else {
        console.log('[SettingsManager] No settings file found, using defaults');
      }
    } catch (error) {
      console.error('[SettingsManager] Error loading settings:', error);
      this.settings = {};
    }
  }

  private saveSettings() {
    const temporary = `${this.settingsPath}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true, mode: 0o700 });
      const descriptor = fs.openSync(temporary, 'wx', 0o600);
      try {
        fs.writeFileSync(descriptor, JSON.stringify(this.settings, null, 2), 'utf-8');
        fs.fsyncSync(descriptor);
      } finally { fs.closeSync(descriptor); }
      fs.renameSync(temporary, this.settingsPath);
      this.persisted = JSON.parse(JSON.stringify(this.settings));
    } catch {
      try { fs.unlinkSync(temporary); } catch { /* No partial settings survive. */ }
      this.settings = JSON.parse(JSON.stringify(this.persisted));
      throw new Error('设置未保存，请检查本机存储权限后重试');
    }
  }

  // ============ 旧版 API 凭证方法（向后兼容，用于 Binance）============
  setCredentials(apiKey: string, apiSecret: string, proxyUrl?: string) {
    this.settings.apiKey = apiKey;
    this.settings.apiSecret = apiSecret;
    this.settings.proxyUrl = proxyUrl || '';

    // 同时也设置到新的 exchanges 结构中
    if (!this.settings.exchanges) {
      this.settings.exchanges = {};
    }
    this.settings.exchanges.binance = { apiKey, apiSecret };

    this.saveSettings();
  }

  getCredentials(): { apiKey: string; apiSecret: string; proxyUrl: string } | null {
    if (this.settings.apiKey && this.settings.apiSecret) {
      return {
        apiKey: this.settings.apiKey,
        apiSecret: this.settings.apiSecret,
        proxyUrl: this.settings.proxyUrl || ''
      };
    }
    return null;
  }

  hasCredentials(): boolean {
    return !!(this.settings.apiKey && this.settings.apiSecret);
  }

  getProxyUrl(): string { return this.settings.proxyUrl || ''; }

  setProxyUrl(proxyUrl: string) { this.settings.proxyUrl = proxyUrl; this.saveSettings(); }

  // ============ 新版多交易所 API 凭证方法 ============

  /**
   * 设置单个交易所的凭证
   */
  setExchangeCredentials(
    exchange: 'binance' | 'bybit' | 'okx' | 'hyperliquid',
    credentials: ExchangeCredentials
  ) {
    if (!this.settings.exchanges) {
      this.settings.exchanges = {};
    }

    this.settings.exchanges[exchange] = credentials;

    // 如果是 Binance，也更新旧的字段（向后兼容）
    if (exchange === 'binance') {
      this.settings.apiKey = credentials.apiKey;
      this.settings.apiSecret = credentials.apiSecret;
    }

    this.saveSettings();
    console.log(`[SettingsManager] Credentials set for ${exchange}`);
  }

  /**
   * 获取单个交易所的凭证
   */
  getExchangeCredentials(
    exchange: 'binance' | 'bybit' | 'okx' | 'hyperliquid'
  ): ExchangeCredentials | null {
    return this.settings.exchanges?.[exchange] || null;
  }

  /**
   * 获取所有交易所的凭证
   */
  getAllExchangesCredentials(): ExchangesCredentials {
    return this.settings.exchanges || {};
  }

  /**
   * 检查某个交易所是否有凭证
   */
  hasExchangeCredentials(exchange: 'binance' | 'bybit' | 'okx' | 'hyperliquid'): boolean {
    const creds = this.settings.exchanges?.[exchange];
    return !!(creds?.apiKey && (exchange === 'hyperliquid' || creds.apiSecret));
  }

  /**
   * 删除某个交易所的凭证
   */
  removeExchangeCredentials(exchange: 'binance' | 'bybit' | 'okx' | 'hyperliquid') {
    if (this.settings.exchanges) {
      delete this.settings.exchanges[exchange];

      // 如果是 Binance，也清除旧的字段
      if (exchange === 'binance') {
        delete this.settings.apiKey;
        delete this.settings.apiSecret;
      }

      this.saveSettings();
      console.log(`[SettingsManager] Credentials removed for ${exchange}`);
    }
  }

  // 显示设置
  setDisplaySettings(maxDisplayCount: number, refreshInterval: number) {
    this.settings.maxDisplayCount = maxDisplayCount;
    this.settings.refreshInterval = refreshInterval;
    this.saveSettings();
  }

  getDisplaySettings(): { maxDisplayCount: number; refreshInterval: number } {
    return {
      maxDisplayCount: this.settings.maxDisplayCount || 2,
      refreshInterval: this.settings.refreshInterval || 5
    };
  }

  // 主题设置
  setTheme(theme: 'light' | 'dark' | 'auto') {
    this.settings.theme = theme;
    this.saveSettings();
  }

  getTheme(): 'light' | 'dark' | 'auto' {
    return this.settings.theme || 'auto';
  }

  // 持仓顺序
  setPositionOrder(order: string[]) {
    this.settings.positionOrder = order;
    this.saveSettings();
  }

  getPositionOrder(): string[] {
    return this.settings.positionOrder || [];
  }

  // 隐藏金额设置
  setHideAmounts(hide: boolean) {
    this.settings.hideAmounts = hide;
    this.saveSettings();
  }

  getHideAmounts(): boolean {
    return this.settings.hideAmounts || false;
  }

  // 调试模式设置
  setDebugMode(debug: boolean) {
    this.settings.debugMode = debug;
    this.saveSettings();
  }

  getDebugMode(): boolean {
    return this.settings.debugMode || false;
  }

  // 窗口透明度设置
  setWindowOpacity(opacity: number) {
    // 限制范围在 0.3 - 1.0 之间
    const clampedOpacity = Math.max(0.3, Math.min(1.0, opacity));
    this.settings.windowOpacity = clampedOpacity;
    this.saveSettings();
  }

  getWindowOpacity(): number {
    return this.settings.windowOpacity || 1.0;
  }

  // 开机自动启动设置
  setAutoLaunch(autoLaunch: boolean) {
    this.settings.autoLaunch = autoLaunch;
    this.saveSettings();

    // 应用到系统
    app.setLoginItemSettings({
      openAtLogin: autoLaunch,
      openAsHidden: false,
    });
  }

  getAutoLaunch(): boolean {
    return this.settings.autoLaunch || false;
  }

  // 清除所有设置
  clearSettings() {
    this.settings = {};
    this.saveSettings();
  }

  // 重置为默认设置
  resetToDefaults() {
    const apiKey = this.settings.apiKey;
    const apiSecret = this.settings.apiSecret;
    const exchanges = this.settings.exchanges;
    const ai = this.settings.ai;

    this.settings = {
      apiKey,
      apiSecret,
      exchanges,
      ai,
      maxDisplayCount: 2,
      refreshInterval: 5,
      theme: 'dark',
      hideAmounts: false,
      debugMode: false,
      windowOpacity: 1.0,
      autoLaunch: false,
      positionOrder: [],
    };
    this.saveSettings();

    // 重置开机启动
    app.setLoginItemSettings({
      openAtLogin: false,
      openAsHidden: false,
    });
  }

  // ============ AI 设置方法 ============

  /**
   * 获取AI设置
   */
  getAISettings(): AISettings {
    // 默认配置（不预设任何 API Key，由用户自行配置）
    const defaultConfig: AISettings = {
      enabled: false, // 默认关闭 AI 功能，等待用户配置
      defaultProvider: AIProvider.ANTHROPIC, // Claude 作为默认推荐
      useCustomKeys: true, // 默认使用自定义 Key（用户需要自己配置）
      credentials: {
        [AIProvider.OPENAI]: { provider: AIProvider.OPENAI, apiKey: '' },
        [AIProvider.ANTHROPIC]: { provider: AIProvider.ANTHROPIC, apiKey: '' },
        [AIProvider.DEEPSEEK]: { provider: AIProvider.DEEPSEEK, apiKey: '' },
        [AIProvider.QWEN]: { provider: AIProvider.QWEN, apiKey: '' },
        [AIProvider.GROK]: { provider: AIProvider.GROK, apiKey: '' },
        [AIProvider.GEMINI]: { provider: AIProvider.GEMINI, apiKey: '' },
      },
    };

    // 如果没有AI设置，返回默认配置
    if (!this.settings.ai) {
      return defaultConfig;
    }

    // 如果有AI设置，合并默认配置（确保所有provider都有定义）
    const merged: AISettings = {
      enabled: this.settings.ai.enabled ?? defaultConfig.enabled,
      defaultProvider: this.settings.ai.defaultProvider ?? defaultConfig.defaultProvider,
      useCustomKeys: this.settings.ai.useCustomKeys ?? defaultConfig.useCustomKeys,
      credentials: {
        ...defaultConfig.credentials, // 先应用默认配置
        ...this.settings.ai.credentials, // 再覆盖用户配置
      },
    };

    return merged;
  }

  /**
   * 保存AI设置
   */
  setAISettings(aiSettings: AISettings) {
    this.settings.ai = aiSettings;
    this.saveSettings();
    console.log('[SettingsManager] AI settings saved');
  }

  /**
   * 设置AI启用状态
   */
  setAIEnabled(enabled: boolean) {
    if (!this.settings.ai) {
      this.settings.ai = this.getAISettings();
    }
    this.settings.ai.enabled = enabled;
    this.saveSettings();
  }

  /**
   * 设置AI默认提供商
   */
  setAIDefaultProvider(provider: AIProvider) {
    if (!this.settings.ai) {
      this.settings.ai = this.getAISettings();
    }
    this.settings.ai.defaultProvider = provider;
    this.saveSettings();
  }

  /**
   * 设置某个AI提供商的凭证
   */
  setAIProviderCredentials(provider: AIProvider, credentials: AICredentials) {
    if (!this.settings.ai) {
      this.settings.ai = this.getAISettings();
    }
    this.settings.ai.credentials[provider] = credentials;
    this.saveSettings();
    console.log(`[SettingsManager] AI credentials set for ${provider}`);
  }

  /**
   * 获取某个AI提供商的凭证
   */
  getAIProviderCredentials(provider: AIProvider): AICredentials | null {
    return this.settings.ai?.credentials[provider] || null;
  }

  /**
   * 检查AI功能是否启用
   */
  isAIEnabled(): boolean {
    return this.settings.ai?.enabled || false;
  }
}

