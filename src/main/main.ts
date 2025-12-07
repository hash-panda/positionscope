import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } from 'electron';
import * as path from 'path';
import { ExchangeManager } from './services/exchangeManager';
import { SettingsManager } from './settings';
import { Position, ExchangeType } from './types/exchange';

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

// 格式化价格 - 动态小数位
function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(0);      // 大于1000: 整数
  if (price >= 100) return price.toFixed(1);       // 100-1000: 1位小数
  if (price >= 1) return price.toFixed(2);         // 1-100: 2位小数
  if (price >= 0.01) return price.toFixed(4);      // 0.01-1: 4位小数
  return price.toFixed(6);                          // 小于0.01: 6位小数
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
  const symbol = position.symbol.replace('USDT', '').replace('BUSD', '');
  const price = parseFloat(position.markPrice);
  const pnl = parseFloat(position.unRealizedProfit);
  const entry = parseFloat(position.entryPrice);
  const posAmt = parseFloat(position.positionAmt);

  // 计算收益率
  const pnlPercent = posAmt > 0
    ? ((price - entry) / entry) * 100
    : ((entry - price) / entry) * 100;

  const sign = pnl >= 0 ? '+' : '';
  const isProfit = pnl >= 0;

  return {
    symbol,
    price: formatPrice(price),
    pnl,
    pnlText: `${sign}${pnl.toFixed(0)}`,
    percentText: `${sign}${pnlPercent.toFixed(1)}%`,
    isProfit
  };
}

// 文字模式：格式化持仓为纯文本（无颜色）
function formatPositionsAsText(positions: PositionDisplayData[]): string {
  const textParts: string[] = [];
  positions.forEach(pos => {
    textParts.push(`${pos.symbol} ${pos.price} ${pos.pnlText} ${pos.percentText}`);
  });
  return textParts.join(' | ');
}

// 更新菜单栏显示
async function updateTrayTitle() {
  if (!tray || !exchangeManager.hasAnyCredentials()) {
    if (tray) {
      tray.setTitle('--');
      console.log('[Tray] Set title to: -- (no credentials)');
    }
    return;
  }

  try {
    const positions = await exchangeManager.getAllFuturesPositions();

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
      const symbolMap = new Map<string, Position>();
      positions.forEach(p => symbolMap.set(p.symbol, p));

      // 按自定义顺序添加
      customOrder.forEach(symbol => {
        const pos = symbolMap.get(symbol);
        if (pos) {
          sortedPositions.push(pos);
          symbolMap.delete(symbol);
        }
      });

      // 添加新的持仓（不在自定义顺序中的）
      symbolMap.forEach(pos => sortedPositions.push(pos));
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

  // 加载保存的设置
  const credentials = settingsManager.getCredentials();
  if (credentials) {
    // 为币安交易所设置凭证（向后兼容）
    exchangeManager.setCredentials({
      exchange: ExchangeType.BINANCE,
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      proxyUrl: credentials.proxyUrl,
    });
  }

  const displaySettings = settingsManager.getDisplaySettings();
  maxDisplayCount = displaySettings.maxDisplayCount;
  refreshIntervalSeconds = displaySettings.refreshInterval;

  createTray();
  createWindow();

  // 如果有凭证，启动自动刷新
  if (credentials) {
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
    // 每次获取数据后更新菜单栏
    updateTrayTitle();
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
  if (settingsManager.hasCredentials()) {
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
  settingsManager.clearSettings();
  return { success: true };
});
