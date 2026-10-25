import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { AIProvider, AICredentials, AISettings } from './types/ai';

interface ExchangeCredentials { apiKey: string; apiSecret: string; passphrase?: string }
type Exchange = 'binance' | 'bybit' | 'okx' | 'hyperliquid';
type ExchangesCredentials = Partial<Record<Exchange, ExchangeCredentials>>;
interface AppSettings {
  exchanges?: ExchangesCredentials;
  ai?: AISettings;
  proxyUrl?: string;
  maxDisplayCount?: number;
  refreshInterval?: number;
  theme?: 'light' | 'dark' | 'auto';
  positionOrder?: string[];
  hideAmounts?: boolean;
  debugMode?: boolean;
  windowOpacity?: number;
  autoLaunch?: boolean;
}
export interface StorageStatus { state: 'empty' | 'encrypted' | 'blocked'; message: string }
export interface SettingsCipher {
  available(): Promise<boolean>;
  encrypt(value: string): Promise<Buffer>;
  decrypt(value: Buffer): Promise<{ result: string; shouldReEncrypt?: boolean; isTemporarilyUnavailable?: boolean }>;
}
const clone = <T>(value: T): T => structuredClone(value);

export class SettingsManager {
  private settings: AppSettings = {};
  private state: StorageStatus['state'] = 'empty';
  private pending: Promise<void> = Promise.resolve();
  private constructor(private vaultPath: string, private cipher: SettingsCipher) {}

  static async open(directory: string, cipher: SettingsCipher): Promise<SettingsManager> {
    const manager = new SettingsManager(path.join(directory, 'settings.vault.json'), cipher);
    await manager.load();
    return manager;
  }

  getStorageStatus(): StorageStatus {
    return { state: this.state, message: this.state === 'blocked'
      ? '加密配置无法读取，原文件已保留。请解锁系统钥匙串并重启；若仍失败，请恢复自己的加密配置备份。'
      : this.state === 'encrypted' ? '配置已使用系统钥匙串加密，密钥由 macOS 管理。'
      : '首次保存即使用系统钥匙串加密；密钥不可用时不保存。' };
  }

  private validate(value: unknown): AppSettings {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid settings');
    const data = value as Record<string, unknown>;
    const allowed = new Set(['exchanges', 'ai', 'proxyUrl', 'maxDisplayCount', 'refreshInterval', 'theme', 'positionOrder', 'hideAmounts', 'debugMode', 'windowOpacity', 'autoLaunch']);
    if (Object.keys(data).some(key => !allowed.has(key))) throw new Error('unknown field');
    if (data.proxyUrl !== undefined && typeof data.proxyUrl !== 'string') throw new Error('invalid proxy');
    const object = (v: unknown): Record<string, unknown> => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('invalid object');
      return v as Record<string, unknown>;
    };
    if (data.exchanges !== undefined) for (const [name, v] of Object.entries(object(data.exchanges))) {
      if (!['binance', 'bybit', 'okx', 'hyperliquid'].includes(name)) throw new Error('unknown exchange');
      const credentials = object(v);
      if (typeof credentials.apiKey !== 'string' || typeof credentials.apiSecret !== 'string' ||
          (credentials.passphrase !== undefined && typeof credentials.passphrase !== 'string')) throw new Error('invalid credentials');
    }
    if (data.ai !== undefined) {
      const ai = object(data.ai);
      if (typeof ai.enabled !== 'boolean' || typeof ai.useCustomKeys !== 'boolean' || !Object.values(AIProvider).includes(ai.defaultProvider as AIProvider)) throw new Error('invalid ai');
      for (const [name, v] of Object.entries(object(ai.credentials))) {
        const credentials = object(v);
        if (!Object.values(AIProvider).includes(name as AIProvider) || credentials.provider !== name || typeof credentials.apiKey !== 'string') throw new Error('invalid ai credentials');
        for (const key of ['baseURL', 'model']) if (credentials[key] !== undefined && typeof credentials[key] !== 'string') throw new Error('invalid ai field');
      }
    }
    for (const key of ['maxDisplayCount', 'refreshInterval', 'windowOpacity']) if (data[key] !== undefined && (typeof data[key] !== 'number' || !Number.isFinite(data[key]))) throw new Error('invalid number');
    for (const key of ['hideAmounts', 'debugMode', 'autoLaunch']) if (data[key] !== undefined && typeof data[key] !== 'boolean') throw new Error('invalid boolean');
    if (data.theme !== undefined && !['light', 'dark', 'auto'].includes(data.theme as string)) throw new Error('invalid theme');
    if (data.positionOrder !== undefined && (!Array.isArray(data.positionOrder) || data.positionOrder.some(x => typeof x !== 'string'))) throw new Error('invalid order');
    return value as AppSettings;
  }

  private async requireEncryption() {
    if (!await this.cipher.available()) throw new Error('encryption unavailable');
  }
  private async load() {
    if (!fs.existsSync(this.vaultPath)) return;
    try {
      await this.requireEncryption();
      const envelope = JSON.parse(fs.readFileSync(this.vaultPath, 'utf8'));
      if (envelope.format !== 'positionscope-settings' || envelope.version !== 1 || typeof envelope.ciphertext !== 'string' ||
          !envelope.ciphertext || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(envelope.ciphertext)) throw new Error('invalid envelope');
      const decrypted = await this.cipher.decrypt(Buffer.from(envelope.ciphertext, 'base64'));
      if (decrypted.isTemporarilyUnavailable) throw new Error('key temporarily unavailable');
      const settings = this.validate(JSON.parse(decrypted.result));
      if (decrypted.shouldReEncrypt) await this.write(settings);
      this.settings = settings;
      this.state = 'encrypted';
    } catch {
      console.error('[SettingsManager] Encrypted configuration unavailable; file retained');
      this.state = 'blocked';
      this.settings = {};
    }
  }

  private async write(settings: AppSettings) {
    await this.requireEncryption();
    const text = JSON.stringify(this.validate(settings));
    const encrypted = await this.cipher.encrypt(text);
    const verified = await this.cipher.decrypt(encrypted);
    if (!encrypted.length || verified.isTemporarilyUnavailable || verified.result !== text || verified.shouldReEncrypt) throw new Error('encryption verification failed');
    const temporary = `${this.vaultPath}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.vaultPath), { recursive: true, mode: 0o700 });
      const fd = fs.openSync(temporary, 'wx', 0o600);
      try {
        fs.writeFileSync(fd, JSON.stringify({ format: 'positionscope-settings', version: 1, ciphertext: encrypted.toString('base64') }), 'utf8');
        fs.fsyncSync(fd);
      } finally { fs.closeSync(fd); }
      fs.renameSync(temporary, this.vaultPath);
    } finally {
      try { fs.unlinkSync(temporary); } catch { /* No temporary ciphertext left after failure. */ }
    }
  }
  private enqueue(action: () => Promise<void>): Promise<void> {
    const result = this.pending.then(action);
    this.pending = result.catch(() => {});
    return result;
  }
  private update(change: (draft: AppSettings) => void): Promise<void> {
    return this.enqueue(async () => {
      if (this.state === 'blocked') throw new Error(this.getStorageStatus().message);
      const draft = clone(this.settings);
      try {
        change(draft);
        await this.write(draft);
      } catch { throw new Error('设置未保存，请检查系统钥匙串与存储权限；不会使用明文保存'); }
      this.settings = draft;
      this.state = 'encrypted';
    });
  }

  getProxyUrl(): string { return this.settings.proxyUrl || ''; }
  setProxyUrl(value: string) { return this.update(draft => { draft.proxyUrl = value; }); }
  getAllExchangesCredentials(): ExchangesCredentials { return clone(this.settings.exchanges || {}); }
  getExchangeCredentials(exchange: Exchange): ExchangeCredentials | null { return clone(this.settings.exchanges?.[exchange] || null); }
  hasExchangeCredentials(exchange: Exchange): boolean {
    const value = this.settings.exchanges?.[exchange];
    return !!(value?.apiKey && (exchange === 'hyperliquid' || value.apiSecret));
  }
  setExchangeCredentials(exchange: Exchange, value: ExchangeCredentials) {
    const credentials = clone(value);
    return this.update(draft => { draft.exchanges = { ...draft.exchanges, [exchange]: credentials }; });
  }
  removeExchangeCredentials(exchange: Exchange) { return this.update(draft => { delete draft.exchanges?.[exchange]; }); }
  getDisplaySettings() { return { maxDisplayCount: this.settings.maxDisplayCount ?? 2, refreshInterval: this.settings.refreshInterval ?? 5 }; }
  setDisplaySettings(maxDisplayCount: number, refreshInterval: number) { return this.update(draft => { Object.assign(draft, { maxDisplayCount, refreshInterval }); }); }
  getTheme() { return this.settings.theme || 'auto'; }
  setTheme(value: 'light' | 'dark' | 'auto') { return this.update(draft => { draft.theme = value; }); }
  getPositionOrder() { return clone(this.settings.positionOrder || []); }
  setPositionOrder(order: string[]) { const value = [...order]; return this.update(draft => { draft.positionOrder = value; }); }
  getHideAmounts() { return this.settings.hideAmounts || false; }
  setHideAmounts(value: boolean) { return this.update(draft => { draft.hideAmounts = value; }); }
  getDebugMode() { return this.settings.debugMode || false; }
  setDebugMode(value: boolean) { return this.update(draft => { draft.debugMode = value; }); }
  getWindowOpacity() { return this.settings.windowOpacity ?? 1; }
  setWindowOpacity(value: number) { return this.update(draft => { draft.windowOpacity = Math.max(0.3, Math.min(1, value)); }); }
  getAutoLaunch() { return this.settings.autoLaunch || false; }
  setAutoLaunch(value: boolean) { return this.update(draft => { draft.autoLaunch = value; }); }
  resetToDefaults() {
    return this.update(draft => { const { exchanges, ai } = draft; for (const key of Object.keys(draft)) delete (draft as Record<string, unknown>)[key]; Object.assign(draft, { exchanges, ai }); });
  }
  clearSettings() {
    return this.enqueue(async () => {
      try { if (fs.existsSync(this.vaultPath)) fs.unlinkSync(this.vaultPath); }
      catch { throw new Error('删除未完成，原加密配置已保留，请检查存储权限'); }
      this.settings = {}; this.state = 'empty';
    });
  }
  getAISettings(): AISettings {
    const credentials = Object.fromEntries(Object.values(AIProvider).map(provider => [provider, { provider, apiKey: '' }])) as AISettings['credentials'];
    return clone({ enabled: this.settings.ai?.enabled ?? false, defaultProvider: this.settings.ai?.defaultProvider ?? AIProvider.ANTHROPIC,
      useCustomKeys: this.settings.ai?.useCustomKeys ?? true, credentials: { ...credentials, ...this.settings.ai?.credentials } });
  }
  setAISettings(settings: AISettings) { const value = clone(settings); return this.update(draft => { draft.ai = value; }); }
  setAIEnabled(value: boolean) { return this.update(draft => { draft.ai = { ...this.getAISettings(), enabled: value }; }); }
  setAIDefaultProvider(value: AIProvider) { return this.update(draft => { draft.ai = { ...this.getAISettings(), defaultProvider: value }; }); }
  setAIProviderCredentials(provider: AIProvider, credentials: AICredentials) {
    const value = clone(credentials);
    return this.update(draft => { const ai = this.getAISettings(); ai.credentials[provider] = value; draft.ai = ai; });
  }
  getAIProviderCredentials(provider: AIProvider): AICredentials | null { return clone(this.settings.ai?.credentials[provider] || null); }
  isAIEnabled(): boolean { return this.settings.ai?.enabled || false; }
}
