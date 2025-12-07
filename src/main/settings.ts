import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface AppSettings {
  apiKey?: string;
  apiSecret?: string;
  proxyUrl?: string;
  maxDisplayCount?: number;
  refreshInterval?: number;
  theme?: 'light' | 'dark' | 'auto';
  positionOrder?: string[]; // 用户自定义的持仓顺序
  hideAmounts?: boolean; // 是否隐藏金额
}

export class SettingsManager {
  private settingsPath: string;
  private settings: AppSettings = {};

  constructor() {
    const userDataPath = app.getPath('userData');
    this.settingsPath = path.join(userDataPath, 'settings.json');
    this.loadSettings();
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
    try {
      // 确保目录存在
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
      console.log('[SettingsManager] Settings saved to:', this.settingsPath);
    } catch (error) {
      console.error('[SettingsManager] Error saving settings:', error);
    }
  }

  // API 凭证
  setCredentials(apiKey: string, apiSecret: string, proxyUrl?: string) {
    this.settings.apiKey = apiKey;
    this.settings.apiSecret = apiSecret;
    this.settings.proxyUrl = proxyUrl || '';
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

  // 清除所有设置
  clearSettings() {
    this.settings = {};
    this.saveSettings();
  }
}
