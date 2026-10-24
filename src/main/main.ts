import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell } from 'electron';

import * as path from 'path';
import * as fs from 'fs';
import { ExchangeManager } from './services/exchangeManager';
import { SettingsManager } from './settings';
import { Position, ExchangeType } from './types/exchange';
import { aiService } from './services/ai';
import { AIProvider, AISettings } from './types/ai';
import { orderPositions } from './utils/position-order';
import { menuValues } from './utils/menu-format';

// Global error handlers to prevent crashes from EPIPE and other errors
process.on('uncaughtException', (error) => {
  // Ignore EPIPE errors which occur when writing to closed streams
  if (error.message.includes('EPIPE')) {
    return;
  }
  console.error('[Main] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
});

// Preserve settings from the pre-PositionScope application.
const previousDataDirectory = ['Binance Menubar', 'binance-menubar'].map(name => path.join(app.getPath('appData'), name)).find(directory => fs.existsSync(path.join(directory, 'settings.json')));
if (previousDataDirectory) app.setPath('userData', previousDataDirectory);

let tray: Tray | null = null;
let window: BrowserWindow | null = null;
const exchangeManager = new ExchangeManager();
let settingsManager: SettingsManager;
let refreshInterval: NodeJS.Timeout | null = null;
let maxDisplayCount: number = 2; // 菜单栏最多显示的持仓数（默认2个）
let refreshIntervalSeconds: number = 5; // 刷新间隔（秒），默认5秒

function createWindow() {
  // 判断是否为开发模式
  // 使用 app.isPackaged 是最可靠的判断方法
  const isDev = !app.isPackaged;

  window = new BrowserWindow({
    width: 480,
    height: 600,
    show: isDev, // 开发模式下默认显示窗口
    frame: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  console.log('isDev:', isDev);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('app.isPackaged:', app.isPackaged);

  // 窗口准备好显示时应用透明度
  window.once('ready-to-show', () => {
    if (window && settingsManager) {
      const opacity = settingsManager.getWindowOpacity();
      window.setOpacity(opacity);
      console.log('[Window] Initial opacity set to:', opacity);
    }
  });

  if (isDev) {
    window.loadURL('http://localhost:3000');
    // 开发模式下打开 DevTools
    window.webContents.openDevTools({ mode: 'detach' });

    // 开发模式下，窗口加载完成后显示
    window.webContents.on('did-finish-load', () => {
      window?.show();
    });
  } else {
    window.loadFile(path.join(__dirname, '../renderer/index.html'));
    window.show();
  }

  // 开发模式下不自动隐藏窗口，方便调试
  if (!isDev) {
    window.on('blur', () => {
      if (window && !window.webContents.isDevToolsOpened()) {
        window.hide();
      }
    });
  }
}

// 格式化持仓数据（用于绘制）
interface PositionDisplayData {
  symbol: string;
  price: string;
  pnl: number;
  pnlText: string;
  percentText: string;
  isProfit: boolean;
}

function formatPositionData(position: Position): PositionDisplayData {
  const pnl = Number(position.unRealizedProfit);
  return { ...menuValues(position), pnl, isProfit: pnl >= 0 };
}

// 文字模式：格式化持仓为纯文本（无颜色）
function formatPositionsAsText(positions: PositionDisplayData[]): string {
  const textParts: string[] = [];
  positions.forEach(pos => {
    textParts.push(settingsManager.getHideAmounts()
      ? `${pos.symbol} •••• •••• ••••`
      : `${pos.symbol} ${pos.price} ${pos.pnlText} ${pos.percentText}`);
  });
  return textParts.join(' | ');
}

// 更新菜单栏显示
async function updateTrayTitle(snapshot?: Position[]) {
  if (!tray || !exchangeManager.hasAnyCredentials()) {
    if (tray) {
      tray.setTitle('--');
      console.log('[Tray] Set title to: -- (no credentials)');
    }
    return;
  }

  try {
    const positions = snapshot ?? await exchangeManager.getAllFuturesPositions();

    // A credential removal can complete while the request is in flight.
    if (!exchangeManager.hasAnyCredentials()) {
      tray.setTitle('--');
      return;
    }

    if (!positions || positions.length === 0) {
      tray.setTitle('无持仓');
      console.log('[Tray] Set title to: 无持仓 (no positions)');
      return;
    }

    // 持仓已经过滤过了，只包含有持仓的合约
    if (positions.length === 0) {
      tray.setTitle('无持仓');
      console.log('[Tray] Set title to: 无持仓 (no active positions)');
      return;
    }

    // 获取用户自定义的顺序
    const customOrder = settingsManager.getPositionOrder();
    let sortedPositions: Position[] = [];

    if (customOrder.length > 0) {
      // 使用自定义顺序
      sortedPositions = orderPositions(positions, customOrder);
    } else {
      // 没有自定义顺序，按收益绝对值排序
      sortedPositions = positions.sort((a: Position, b: Position) => {
        return Math.abs(parseFloat(b.unRealizedProfit)) - Math.abs(parseFloat(a.unRealizedProfit));
      });
    }

    // 取前N个显示
    const displayPositions = sortedPositions.slice(0, maxDisplayCount);

    // 格式化为显示数据
    const displayData = displayPositions.map((p: Position) => formatPositionData(p));

    // 使用文字模式（纯文本，无颜色）
    const titleText = formatPositionsAsText(displayData);
    tray.setTitle(titleText);
    console.log('[Tray] Updated with text for', displayData.length, 'positions');
  } catch (error) {
    console.error('[Main] Error updating tray:', error);
    tray.setTitle('错误');
  }
}

// 启动定时刷新
function startAutoRefresh() {
  // 立即更新一次
  updateTrayTitle();

  // 根据设置的刷新间隔刷新
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  refreshInterval = setInterval(() => {
    // 检查是否有错误状态，如果有则停止自动刷新
    if (exchangeManager.hasBlockingErrors()) {
      console.log('[Main] Auto refresh paused due to exchange errors');
      stopAutoRefresh();

      // 通知前端有错误
      if (window && window.webContents) {
        window.webContents.send('exchange-errors', exchangeManager.getAllErrors());
      }
      return;
    }

    updateTrayTitle();
  }, refreshIntervalSeconds * 1000); // 转换为毫秒

  console.log(`[Main] Auto refresh started with interval: ${refreshIntervalSeconds}s`);
}

// 停止定时刷新
function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

function createTray() {
  // 文字模式：使用空图标，只显示文字
  // 创建一个小的透明图标，让菜单栏只显示文字
  const icon = nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('Binance 合约持仓');
  tray.setTitle('--'); // 初始显示

  console.log('[Tray] Created with text-only mode (no icon)');

  // 点击托盘图标显示/隐藏窗口
  tray.on('click', () => {
    if (window) {
      if (window.isVisible()) {
        window.hide();
      } else {
        const bounds = tray!.getBounds();
        const x = Math.round(bounds.x + bounds.width / 2 - 240);
        const y = Math.round(bounds.y + bounds.height);
        window.setPosition(x, y);
        window.show();
      }
    }
  });

  // 不设置右键菜单，避免遮挡显示
}

app.whenReady().then(() => {
  // 设置应用名称，方便在系统设置中识别
  app.setName('Binance Menubar');

  // macOS 上隐藏 Dock 图标，让应用只在菜单栏显示
  // 这样系统会将应用识别为菜单栏应用
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  // 初始化设置管理器
  settingsManager = new SettingsManager();

  // 加载保存的所有交易所凭证
  const allCredentials = settingsManager.getAllExchangesCredentials();

  // 为每个已配置的交易所设置凭证
  if (allCredentials.binance) {
    exchangeManager.setCredentials({
      exchange: ExchangeType.BINANCE,
      apiKey: allCredentials.binance.apiKey,
      apiSecret: allCredentials.binance.apiSecret,
      proxyUrl: settingsManager.getProxyUrl(),
    });
  }

  if (allCredentials.bybit) {
    exchangeManager.setCredentials({
      exchange: ExchangeType.BYBIT,
      apiKey: allCredentials.bybit.apiKey,
      apiSecret: allCredentials.bybit.apiSecret,
      proxyUrl: settingsManager.getProxyUrl(),
    });
  }

  if (allCredentials.okx) {
    exchangeManager.setCredentials({
      exchange: ExchangeType.OKX,
      apiKey: allCredentials.okx.apiKey,
      apiSecret: allCredentials.okx.apiSecret,
      passphrase: allCredentials.okx.passphrase,
      proxyUrl: settingsManager.getProxyUrl(),
    });
  }

  if (allCredentials.hyperliquid) {
    exchangeManager.setCredentials({
      exchange: ExchangeType.HYPERLIQUID,
      apiKey: allCredentials.hyperliquid.apiKey,
      apiSecret: allCredentials.hyperliquid.apiSecret,
      proxyUrl: settingsManager.getProxyUrl(),
    });
  }

  const displaySettings = settingsManager.getDisplaySettings();
  maxDisplayCount = displaySettings.maxDisplayCount;
  refreshIntervalSeconds = displaySettings.refreshInterval;

  // 初始化 AI 服务
  const aiSettings = settingsManager.getAISettings();
  if (aiSettings && aiSettings.enabled) {
    aiService.setConfig(aiSettings);
    console.log('[Main] AI service initialized with settings:', {
      enabled: aiSettings.enabled,
      provider: aiSettings.defaultProvider,
      useCustomKeys: aiSettings.useCustomKeys,
    });
  }

  createTray();
  createWindow();

  // 如果有凭证，启动自动刷新
  if (exchangeManager.hasAnyCredentials()) {
    startAutoRefresh();
  }
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});

// IPC handlers
ipcMain.handle('save-api-keys', async (_, apiKey: string, apiSecret: string, proxyUrl?: string) => {
  // 为币安设置凭证（向后兼容）
  exchangeManager.setCredentials({
    exchange: ExchangeType.BINANCE,
    apiKey,
    apiSecret,
    proxyUrl,
  });
  // 保存到持久化存储
  settingsManager.setCredentials(apiKey, apiSecret, proxyUrl);
  // 启动自动刷新
  startAutoRefresh();
  return { success: true };
});

ipcMain.handle('get-spot-positions', async () => {
  try {
    return await exchangeManager.getAllSpotBalances();
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('get-futures-positions', async () => {
  try {
    const positions = await exchangeManager.getAllFuturesPositions();
    // Reuse this snapshot; avoid a second API read that could hide a failed request.
    await updateTrayTitle(positions);
    return positions;
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('has-credentials', async () => {
  const hasCredentials = exchangeManager.hasAnyCredentials();
  // 如果有凭证，启动自动刷新
  if (hasCredentials) {
    startAutoRefresh();
  }
  return hasCredentials;
});

// 保存显示设置
ipcMain.handle('save-display-settings', async (_, settings: {
  maxDisplayCount: number,
  refreshInterval: number
}) => {
  maxDisplayCount = settings.maxDisplayCount;
  refreshIntervalSeconds = settings.refreshInterval;

  // 保存到持久化存储
  settingsManager.setDisplaySettings(settings.maxDisplayCount, settings.refreshInterval);

  // 更新显示
  updateTrayTitle();

  // 重启自动刷新以应用新的刷新间隔
  if (exchangeManager.hasAnyCredentials()) {
    startAutoRefresh();
  }

  return { success: true };
});

// 获取显示设置
ipcMain.handle('get-display-settings', async () => {
  return settingsManager.getDisplaySettings();
});

// 保存主题设置
ipcMain.handle('save-theme', async (_, theme: 'light' | 'dark' | 'auto') => {
  settingsManager.setTheme(theme);
});

// 获取主题设置
ipcMain.handle('get-theme', async () => {
  return settingsManager.getTheme();
});

// 退出应用
ipcMain.handle('quit-app', async () => {
  app.quit();
});

// 保存持仓顺序
ipcMain.handle('save-position-order', async (_, order: string[]) => {
  settingsManager.setPositionOrder(order);
  // 更新菜单栏显示以应用新顺序
  updateTrayTitle();
  return { success: true };
});

// 获取持仓顺序
ipcMain.handle('get-position-order', async () => {
  return settingsManager.getPositionOrder();
});

// 获取合约账户信息
ipcMain.handle('get-futures-account-info', async () => {
  try {
    return await exchangeManager.getAllAccountInfo();
  } catch (error: any) {
    return { error: error.message };
  }
});

// 保存隐藏金额设置
ipcMain.handle('save-hide-amounts', async (_, hide: boolean) => {
  settingsManager.setHideAmounts(hide);
  updateTrayTitle();
  return { success: true };
});

// 获取隐藏金额设置
ipcMain.handle('get-hide-amounts', async () => {
  return settingsManager.getHideAmounts();
});

// 保存调试模式设置
ipcMain.handle('save-debug-mode', async (_, debug: boolean) => {
  settingsManager.setDebugMode(debug);

  // 根据设置打开或关闭 DevTools
  if (window) {
    if (debug) {
      window.webContents.openDevTools({ mode: 'detach' });
    } else {
      window.webContents.closeDevTools();
    }
  }

  return { success: true };
});

// 获取调试模式设置
ipcMain.handle('get-debug-mode', async () => {
  return settingsManager.getDebugMode();
});

// 保存窗口透明度设置
ipcMain.handle('save-window-opacity', async (_, opacity: number) => {
  settingsManager.setWindowOpacity(opacity);

  // 应用透明度到窗口
  if (window) {
    window.setOpacity(opacity);
  }

  return { success: true };
});

// 获取窗口透明度设置
ipcMain.handle('get-window-opacity', async () => {
  return settingsManager.getWindowOpacity();
});

// 保存开机自动启动设置
ipcMain.handle('save-auto-launch', async (_, autoLaunch: boolean) => {
  settingsManager.setAutoLaunch(autoLaunch);
  return { success: true };
});

// 获取开机自动启动设置
ipcMain.handle('get-auto-launch', async () => {
  return settingsManager.getAutoLaunch();
});

// 获取应用版本
ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

// 重置所有设置为默认值
ipcMain.handle('reset-to-defaults', async () => {
  settingsManager.resetToDefaults();
  return { success: true };
});

// 删除所有数据（包括API凭证）
ipcMain.handle('delete-all-data', async () => {
  try {
    // 1. 停止自动刷新
    stopAutoRefresh();

    // 2. 清除所有交易所的凭证（内存中的）
    exchangeManager.removeAllCredentials();

    // 3. 清空设置文件
    settingsManager.clearSettings();
    aiService.setConfig(settingsManager.getAISettings());
    aiService.clearCache();
    tray?.setTitle('--');
    app.setLoginItemSettings({ openAtLogin: false, openAsHidden: false });
    if (window) {
      window.setOpacity(1);
      window.webContents.closeDevTools();
    }

    console.log('[IPC] All data deleted successfully');
    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error deleting all data:', error);
    return { success: false, error: error.message };
  }
});

// ============ 新版多交易所 IPC handlers ============

// 保存单个交易所的凭证
ipcMain.handle('save-exchange-credentials', async (_, exchange: string, credentials: any) => {
  try {
    const exchangeType = exchange.toLowerCase() as ExchangeType;

    // 保存到设置管理器
    settingsManager.setExchangeCredentials(
      exchange as 'binance' | 'bybit' | 'okx' | 'hyperliquid',
      credentials
    );

    // 设置到交易所管理器
    exchangeManager.setCredentials({
      exchange: exchangeType,
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      passphrase: credentials.passphrase,
      proxyUrl: credentials.proxyUrl,
    });

    // 启动自动刷新
    startAutoRefresh();

    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error saving exchange credentials:', error);
    return { success: false, error: error.message };
  }
});

// 获取单个交易所的凭证
ipcMain.handle('get-exchange-credentials', async (_, exchange: string) => {
  try {
    return settingsManager.getExchangeCredentials(
      exchange as 'binance' | 'bybit' | 'okx' | 'hyperliquid'
    );
  } catch (error: any) {
    console.error('[IPC] Error getting exchange credentials:', error);
    return null;
  }
});

// 获取所有交易所的凭证
ipcMain.handle('get-all-exchanges-credentials', async () => {
  try {
    return settingsManager.getAllExchangesCredentials();
  } catch (error: any) {
    console.error('[IPC] Error getting all exchanges credentials:', error);
    return {};
  }
});

// 删除单个交易所的凭证
ipcMain.handle('remove-exchange-credentials', async (_, exchange: string) => {
  try {
    const exchangeType = exchange.toLowerCase() as ExchangeType;

    // 从设置管理器删除
    settingsManager.removeExchangeCredentials(
      exchange as 'binance' | 'bybit' | 'okx' | 'hyperliquid'
    );

    // 从交易所管理器删除
    exchangeManager.removeCredentials(exchangeType);

    // 更新托盘显示
    updateTrayTitle();

    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error removing exchange credentials:', error);
    return { success: false, error: error.message };
  }
});

// ============ AI 相关 IPC Handlers ============

/**
 * 获取AI设置
 */
ipcMain.handle('get-ai-settings', async () => {
  try {
    return settingsManager.getAISettings();
  } catch (error: any) {
    console.error('[IPC] Error getting AI settings:', error);
    return null;
  }
});

/**
 * 保存AI设置
 */
ipcMain.handle('save-ai-settings', async (_, aiSettings: AISettings) => {
  try {
    settingsManager.setAISettings(aiSettings);

    // 初始化AI服务
    if (aiSettings.enabled) {
      aiService.setConfig(aiSettings);
      console.log('[IPC] AI service initialized');
    }

    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error saving AI settings:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 分析持仓健康度
 */
ipcMain.handle('ai-analyze-health', async (_, positions, accountInfo, provider?: AIProvider, forceRefresh = false) => {
  try {
    if (!aiService.isAvailable()) {
      throw new Error('AI service not initialized. Please configure AI settings first.');
    }

    if (forceRefresh) aiService.clearCache();
    console.log('[IPC] AI health analysis requested');
    const result = await aiService.analyzePortfolioHealth(positions, accountInfo, provider);

    return { success: true, data: result };
  } catch (error: any) {
    console.error('[IPC] AI health analysis failed:', error);
    return { success: false, error: error.message };
  }
});

/**
 * AI聊天
 */
ipcMain.handle('ai-chat', async (_, message: string, context?: any, provider?: AIProvider) => {
  try {
    if (!aiService.isAvailable()) {
      throw new Error('AI service not initialized. Please configure AI settings first.');
    }

    console.log('[IPC] AI chat request:', message.substring(0, 50) + '...');
    const response = await aiService.chat(message, context, provider);

    return { success: true, data: response };
  } catch (error: any) {
    console.error('[IPC] AI chat failed:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 清除AI对话历史
 */
ipcMain.handle('ai-clear-conversation', async () => {
  try {
    aiService.clearConversation();
    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error clearing AI conversation:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 检查AI服务是否可用
 */
ipcMain.handle('ai-is-available', async () => {
  try {
    return aiService.isAvailable();
  } catch (error: any) {
    console.error('[IPC] Error checking AI availability:', error);
    return false;
  }
});

/**
 * 获取可用的AI提供商列表
 */
ipcMain.handle('ai-get-providers', async () => {
  try {
    return aiService.getAvailableProviders();
  } catch (error: any) {
    console.error('[IPC] Error getting AI providers:', error);
    return [];
  }
});

// ============ 错误处理相关 IPC Handlers ============

/**
 * 获取所有交易所错误
 */
ipcMain.handle('get-exchange-errors', async () => {
  try {
    return exchangeManager.getAllErrors();
  } catch (error: any) {
    console.error('[IPC] Error getting exchange errors:', error);
    return [];
  }
});

/**
 * 清除所有错误状态（用户手动重试）
 */
ipcMain.handle('clear-exchange-errors', async () => {
  try {
    exchangeManager.clearAllErrors();

    // 清除错误后，重新启动自动刷新
    if (exchangeManager.hasAnyCredentials()) {
      startAutoRefresh();
    }

    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error clearing exchange errors:', error);
    return { success: false, error: error.message };
  }
});

// ============ 工具函数 IPC Handlers ============

/**
 * 打开外部链接
 */
ipcMain.handle('open-external', async (_, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error opening external URL:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 最小化窗口
 */
ipcMain.handle('minimize-window', async () => {
  try {
    if (window && !window.isDestroyed()) {
      window.minimize();
    }
    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error minimizing window:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 保存代理设置并应用到所有已配置的交易所
 */
ipcMain.handle('save-proxy-settings', async (_, proxyUrl: string) => {
  try {
    console.log('[IPC] Saving proxy settings:', proxyUrl || '(no proxy)');

    settingsManager.setProxyUrl(proxyUrl);

    // 获取所有已配置的交易所凭证
    const allCredentials = settingsManager.getAllExchangesCredentials();

    // 重新应用所有凭证（包含新的代理配置）
    if (allCredentials.binance) {
      exchangeManager.setCredentials({
        exchange: ExchangeType.BINANCE,
        apiKey: allCredentials.binance.apiKey,
        apiSecret: allCredentials.binance.apiSecret,
        proxyUrl: proxyUrl,
      });
      console.log('[IPC] Proxy applied to Binance');
    }

    if (allCredentials.bybit) {
      exchangeManager.setCredentials({
        exchange: ExchangeType.BYBIT,
        apiKey: allCredentials.bybit.apiKey,
        apiSecret: allCredentials.bybit.apiSecret,
        proxyUrl: proxyUrl,
      });
      console.log('[IPC] Proxy applied to Bybit');
    }

    if (allCredentials.okx) {
      exchangeManager.setCredentials({
        exchange: ExchangeType.OKX,
        apiKey: allCredentials.okx.apiKey,
        apiSecret: allCredentials.okx.apiSecret,
        passphrase: allCredentials.okx.passphrase,
        proxyUrl: proxyUrl,
      });
      console.log('[IPC] Proxy applied to OKX');
    }

    if (allCredentials.hyperliquid) {
      exchangeManager.setCredentials({
        exchange: ExchangeType.HYPERLIQUID,
        apiKey: allCredentials.hyperliquid.apiKey,
        apiSecret: allCredentials.hyperliquid.apiSecret,
        proxyUrl: proxyUrl,
      });
      console.log('[IPC] Proxy applied to Hyperliquid');
    }

    console.log('[IPC] Proxy settings saved and applied to all exchanges');
    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error saving proxy settings:', error);
    return { success: false, error: error.message };
  }
});

