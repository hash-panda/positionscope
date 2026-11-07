import { requestDiagnostic } from './utils/request-diagnostics';
import { validateAISettingsModels } from './utils/ai-model';
import { buildRiskFacts } from './services/ai/risk-facts';
import { publicMarketService } from './services/public-market';
import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell, autoUpdater, session, net } from 'electron';

import * as path from 'path';
import { promises as fileSystem } from 'fs';
import { PaperLedger } from './services/paper/ledger';
import { PaperController } from './services/paper/controller';
import { ExchangeManager } from './services/exchangeManager';
import { SettingsManager } from './settings';
import { macSettingsCipher } from './settings-crypto';
import { Position, ExchangeType } from './types/exchange';
import { aiService } from './services/ai';
import { AIProvider, AISettings } from './types/ai';
import { orderPositions } from './utils/position-order';
import { MenuPriceHistory, menuPriceLabel, menuProfitLabel } from './utils/menu-price';
import { binanceResearchSymbol } from './utils/binance-symbol';
import { BinanceResearchService } from './services/research/market-scanner';
import { BoundedResearchAIService } from './services/research/ai-research';
import { ResearchLedger } from './services/research/research-ledger';
import { ResearchController } from './services/research/research-controller';
import { menuSignalPng } from './utils/menu-image';
import { UpdateInstaller } from './services/update-install';
import { updateNetwork } from './services/update-network';

// Global error handlers to prevent crashes from EPIPE and other errors
process.on('uncaughtException', (error) => {
  // Ignore EPIPE errors which occur when writing to closed streams
  if (error.message.includes('EPIPE')) {
    return;
  }
  console.error('[Main] Uncaught exception:', requestDiagnostic(error));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled rejection:', requestDiagnostic(reason));
});

// Independent identity and data directory; no pre-release compatibility paths.
app.setName('PositionScope');
app.setPath('userData', path.join(app.getPath('appData'), 'PositionScope'));

const menuPriceHistory = new MenuPriceHistory();
let installer: UpdateInstaller | undefined;
let tray: Tray | null = null;
let window: BrowserWindow | null = null;
let workspaceWindow: BrowserWindow | null = null;
const researchMarket = new BinanceResearchService();
let researchLedger: ResearchLedger;
let researchController: ResearchController;
let researchTimer: NodeJS.Timeout | null = null;
let paperLedger: PaperLedger | undefined;
let paperController: PaperController | undefined;
let paperTimer: NodeJS.Timeout | undefined;
let observing = false;
let researchEpoch = 0;
let privacyMaskPending = false;
const exchangeManager = new ExchangeManager();
let settingsManager: SettingsManager;
let refreshInterval: NodeJS.Timeout | null = null;
let maxDisplayCount: number = 2; // 菜单栏最多显示的持仓数（默认2个）
let refreshIntervalSeconds: number = 5; // 刷新间隔（秒），默认5秒

type WorkspacePage = 'paper' | 'research' | 'positions' | 'review' | 'settings';
const workspacePages = new Set(['paper', 'research', 'positions', 'review', 'settings']);
function broadcast(channel: string, ...values: unknown[]) {
  for (const target of [window, workspaceWindow]) if (target && !target.isDestroyed()) target.webContents.send(channel, ...values);
}
function secureWindow(target: BrowserWindow) {
  target.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  target.webContents.on('will-navigate', event => event.preventDefault());
}
function openWorkspace(page: WorkspacePage = 'research') {
  if (workspaceWindow && !workspaceWindow.isDestroyed()) {
    workspaceWindow.show(); workspaceWindow.focus();
    workspaceWindow.webContents.send('workspace-page', page);
    return;
  }
  workspaceWindow = new BrowserWindow({ width: 1180, height: 760, minWidth: 960, minHeight: 640,
    show: false, title: 'PositionScope', backgroundColor: '#f6f7f9',
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') } });
  secureWindow(workspaceWindow);
  workspaceWindow.once('ready-to-show', () => { workspaceWindow?.show(); workspaceWindow?.focus(); });
  workspaceWindow.on('closed', () => { workspaceWindow = null; });
  if (app.isPackaged) void workspaceWindow.loadFile(path.join(__dirname, '../renderer/index.html'), { query: { mode: 'workspace', page } });
  else void workspaceWindow.loadURL(`http://localhost:3000/?mode=workspace&page=${page}`);
  window?.hide();
}
function setMenuSignal(pnl: number | null, stale = false) {
  if (!tray) return;
  const options = { colorScheme: settingsManager.getDisplaySettings().colorScheme, hideAmounts: privacyMaskPending || settingsManager.getHideAmounts(), stale };
  const small = menuSignalPng(pnl, { ...options, scaleFactor: 1 });
  const retina = menuSignalPng(pnl, { ...options, scaleFactor: 2 });
  const icon = nativeImage.createFromBuffer(small.buffer, { scaleFactor: 1 });
  icon.addRepresentation({ buffer: retina.buffer, scaleFactor: 2 });
  icon.setTemplateImage(false);
  tray.setImage(icon);
}

async function observeResearch() {
  if (observing || !researchLedger) return;
  const state = researchLedger.snapshot();
  const symbols = [...new Set([...state.alerts.filter(a => a.status === 'armed').map(a => a.symbol),
    ...state.shadows.filter(s => s.status === 'awaiting-entry' || s.status === 'observing').map(s => s.symbol)])];
  if (!symbols.length) return;
  observing = true;
  const epoch = researchEpoch;
  try {
    researchMarket.setProxy(settingsManager.getProxyUrl());
    const samples = await researchMarket.getPublicSamples(symbols);
    if (epoch !== researchEpoch) return;
    const outcome = await researchLedger.observePublicSamples(samples);
    if (outcome.triggeredAlerts.length) broadcast('research-alert-triggered', outcome.triggeredAlerts.map(a => ({
      id: a.id, symbol: a.symbol, metric: a.metric, threshold: a.threshold, triggeredAt: a.triggeredAt,
    })));
    if (outcome.triggeredAlerts.length || outcome.completedShadows.length) broadcast('research-ledger-changed');
  } catch { /* Offline is a gap, never a trigger. No provider calls or private account reads. */ }
  finally { observing = false; }
}

async function initializePaper() {
  try {
    paperLedger = await PaperLedger.open({ filePath: path.join(app.getPath('userData'), 'paper-ledger.json') });
    paperController = new PaperController({ ledger: paperLedger, market: researchMarket,
      provider: () => { const config = settingsManager.getAISettings(); if (!config.enabled || !config.useCustomKeys) throw new Error('模型未配置'); return aiService.getResearchProvider(); },
      analyze: request => researchController.analyze(request), changed: () => broadcast('paper-changed') });
    if (paperLedger.snapshot().cycles.length) await paperController.invalidate();
  } catch { paperController = undefined; console.error('[Paper] Local ledger unavailable; original file retained'); }
}

function createWindow() {
  // 判断是否为开发模式
  // 使用 app.isPackaged 是最可靠的判断方法
  const isDev = !app.isPackaged;

  window = new BrowserWindow({
    width: 480,
    height: 600,
    show: isDev, // 开发模式下默认显示窗口
    title: 'PositionScope',
    frame: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  secureWindow(window);

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

// 更新菜单栏显示
async function updateTrayTitle(snapshot?: Position[]) {
  if (!tray || !exchangeManager.hasAnyCredentials()) {
    if (tray) {
      tray.setTitle('--');
      menuPriceHistory.clear();
      setMenuSignal(null);
      console.log('[Tray] Set title to: -- (no credentials)');
    }
    return;
  }

  try {
    const positions = snapshot ?? await exchangeManager.getAllFuturesPositions();

    // A credential removal can complete while the request is in flight.
    if (!exchangeManager.hasAnyCredentials()) {
      tray.setTitle('--');
      menuPriceHistory.clear();
      setMenuSignal(null);
      return;
    }

    // A partial/failed read is unknown, never proof of a flat account.
    if (exchangeManager.hasAnyErrors()) {
      tray.setTitle('数据异常');
      menuPriceHistory.clear();
      setMenuSignal(null, true);
      return;
    }

    if (!positions || positions.length === 0) {
      tray.setTitle('无持仓');
      menuPriceHistory.clear();
      setMenuSignal(0);
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

    const directions = menuPriceHistory.observe(positions, Date.now(), Math.max(15000, refreshIntervalSeconds * 3000));
    const hidden = privacyMaskPending || settingsManager.getHideAmounts();
    tray.setTitle(`${displayPositions.map(p => menuPriceLabel(p, hidden)).join(' | ')} · ${menuProfitLabel(positions, hidden)}`);
    const first = displayPositions[0];
    setMenuSignal(first ? directions.get(`${first.exchange}:${first.symbol}`) || 0 : null);
    tray.setToolTip(hidden ? 'PositionScope · 已隐藏金额' : 'PositionScope · Binance 标记价（USDT）\n唯一彩色图标：第一个币种相对上次报价的方向，非24h涨跌。\n末尾带正负号金额：全部持仓未实现盈亏（USDT），不是已结算利润。');
  } catch (error) {
    console.error('[Main] Error updating tray:', requestDiagnostic(error));
    menuPriceHistory.clear();
    tray.setTitle('错误');
    setMenuSignal(null, true);
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
      broadcast('exchange-errors', exchangeManager.getAllErrors());
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
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'brand', 'trayTemplate.png')
    : path.join(app.getAppPath(), 'assets', 'brand', 'trayTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) throw new Error('PositionScope menu-bar icon is missing');
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip('PositionScope · 仓位镜');
  tray.setTitle('--'); // 初始显示

  console.log('[Tray] Created with PositionScope template icon');

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

  tray.on('right-click', () => tray?.popUpContextMenu(Menu.buildFromTemplate([
    { label: '打开研究工作台', click: () => openWorkspace('research') },
    { label: '设置', click: () => openWorkspace('settings') },
    { type: 'separator' }, { label: '退出 PositionScope', click: () => app.quit() },
  ])));
}

app.whenReady().then(async () => {
  // 设置应用名称，方便在系统设置中识别
  app.setName('PositionScope');

  // macOS 上隐藏 Dock 图标，让应用只在菜单栏显示
  // 这样系统会将应用识别为菜单栏应用
  if (process.platform === 'darwin') {
    app.dock?.hide();
  }

  // 初始化设置管理器
  settingsManager = await SettingsManager.open(app.getPath('userData'), macSettingsCipher);
  try { researchLedger = await ResearchLedger.open({ filePath: path.join(app.getPath('userData'), 'research-ledger.json') }); }
  catch { console.error('[Research] Local record store unavailable; existing file retained'); }
  const researchAI = new BoundedResearchAIService({
    getSnapshot: () => researchMarket.snapshot(), getEvidence: symbol => researchMarket.getEvidence(symbol),
    getProvider: () => aiService.getResearchProvider(),
  });
  researchController = new ResearchController({ snapshot: () => researchMarket.snapshot(),
    analyze: request => researchAI.analyze(request), record: input => researchLedger.recordJudgment(input) });
  researchMarket.setProxy(settingsManager.getProxyUrl());

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

  await initializePaper();
  createTray();
  createWindow();
  paperTimer = setInterval(() => { void paperController?.poll(); void paperController?.think(); }, 15000);
  researchTimer = setInterval(() => { void observeResearch(); }, 60_000);

  // 如果有凭证，启动自动刷新
  if (exchangeManager.hasAnyCredentials()) {
    startAutoRefresh();
  }
});

// Keep the menu-bar process alive after its window closes.
app.on('window-all-closed', () => {});
app.on('before-quit', () => { paperController?.stop(); if (paperTimer) clearInterval(paperTimer); installer?.dispose(); if (researchTimer) clearInterval(researchTimer); stopAutoRefresh(); researchController?.invalidate(); });

// IPC handlers
ipcMain.handle('get-window-mode', event => event.sender === workspaceWindow?.webContents ? 'workspace' : 'popup');
ipcMain.handle('open-workspace', (_event, page: unknown) => {
  if (page !== undefined && (typeof page !== 'string' || !workspacePages.has(page))) return { success: false, error: '页面不存在' };
  openWorkspace((page || 'research') as WorkspacePage);
  return { success: true };
});
function updateHandler(channel: string, action: (updates: UpdateInstaller) => unknown) {
  ipcMain.handle(channel, (event) => {
    const owner = [window, workspaceWindow].find(w => w && !w.isDestroyed() && w.webContents === event.sender);
    if (!owner || event.senderFrame !== owner.webContents.mainFrame) throw new Error('Invalid update request');
    if (!installer) {
      const network = updateNetwork(options => net.request({ ...options, session: session.fromPartition('positionscope-updates') }));
      installer = new UpdateInstaller(app.getVersion(), process.arch,
        process.platform === 'darwin' && app.isPackaged && !app.getAppPath().includes('/AppTranslocation/') && !app.getAppPath().startsWith('/Volumes/'),
        app.getPath('temp'), autoUpdater, network, state => broadcast('app-update-state', state), process.getSystemVersion?.() || '0.0');
    }
    return action(installer);
  });
}
updateHandler('check-for-updates', updates => updates.check());
updateHandler('get-update-state', updates => updates.snapshot());
updateHandler('download-update', updates => updates.download());
updateHandler('install-update', updates => updates.restart());

function researchHandler(channel: string, action: (...args: any[]) => unknown) {
  ipcMain.handle(channel, async (event, ...args) => {
    const owner = [window, workspaceWindow].find(w => w && !w.isDestroyed() && w.webContents === event.sender);
    if (!owner || event.senderFrame !== owner.webContents.mainFrame) return { success: false, error: '研究请求来源无效' };
    try { return { success: true, data: await action(...args) }; }
    catch { return { success: false, error: '研究数据或本地记录暂不可用，请刷新后重试；AI 需已配置可用的模型与 Key。' }; }
  });
}
function paperHandler(channel: string, action: (...args: unknown[]) => unknown) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== workspaceWindow?.webContents || event.senderFrame !== workspaceWindow.webContents.mainFrame) return { success:false, error:'模拟操作来源无效' };
    if (!paperController) return {success:false,error:'模拟历史无法读取，原文件已保留；请检查本地存储。'};
    try { return {success:true,data:await action(...args)}; }
    catch { return {success:false,error:'模拟操作未完成。请检查本金、模型配置与调用预算；旧历史保留。'}; }
  });
}
paperHandler('get-paper-state', () => paperController!.snapshot());
paperHandler('start-paper-cycle', input => paperController!.start(input));
paperHandler('set-paper-mode', (id, mode) => paperController!.mode(id,mode));
const requireLedger = () => { if (!researchLedger) throw new Error('研究记录不可用'); return researchLedger; };
researchHandler('get-research-snapshot', () => { researchMarket.setProxy(settingsManager.getProxyUrl()); return researchMarket.snapshot(); });
researchHandler('get-watchlist-market', () => {
  researchMarket.setProxy(settingsManager.getProxyUrl());
  return researchMarket.getWatchlistMarket(settingsManager.getDisplaySettings().watchlistSymbols);
});
researchHandler('get-research-evidence', (symbol: string) => researchMarket.getEvidence(symbol));
researchHandler('get-research-ledger', () => requireLedger().snapshot());
researchHandler('analyze-research', async input => {
  requireLedger();
  const configured = settingsManager.getAISettings();
  if (!configured.enabled || !configured.useCustomKeys || !aiService.isAvailable()) throw new Error('AI 尚未配置');
  researchMarket.setProxy(settingsManager.getProxyUrl());
  try { return await researchController.analyze(input); }
  finally { broadcast('research-ledger-changed'); }
});
researchHandler('set-research-watch', async (symbol: string, watched: boolean) => {
  const epoch = researchEpoch;
  if (typeof watched !== 'boolean' || !await researchMarket.isSupportedSymbol(symbol)) throw new Error('标的不可用');
  if (epoch !== researchEpoch) throw new Error('研究配置或数据已变更，请重新操作');
  const result = await requireLedger().setWatched(symbol, watched);
  broadcast('research-ledger-changed'); return result;
});
researchHandler('create-research-alert', async input => {
  const epoch = researchEpoch;
  if (!input || !['price', 'funding'].includes(input.metric) || !await researchMarket.isSupportedSymbol(input.symbol)) throw new Error('提醒范围无效');
  if (epoch !== researchEpoch) throw new Error('研究配置或数据已变更，请重新操作');
  // Keep public polling bounded across all armed conditions and forward experiments.
  const state = requireLedger().snapshot();
  if (new Set([...state.alerts.filter(a => a.status === 'armed').map(a => a.symbol),
      ...state.shadows.filter(s => s.status === 'observing' || s.status === 'awaiting-entry').map(s => s.symbol), input.symbol]).size > 32) throw new Error('提醒标的数量已达上限');
  const result = await researchLedger.createAlert(input);
  broadcast('research-ledger-changed'); void observeResearch(); return result;
});
researchHandler('remove-research-alert', async id => { const result = await requireLedger().removeAlert(id); broadcast('research-ledger-changed'); return result; });
researchHandler('rearm-research-alert', async id => { const result = await requireLedger().rearmAlert(id); broadcast('research-ledger-changed'); return result; });
researchHandler('register-research-shadow', async input => {
  const result = await requireLedger().registerShadow(input);
  broadcast('research-ledger-changed'); void observeResearch(); return result;
});
ipcMain.handle('get-proxy-settings', () => settingsManager.getProxyUrl());
ipcMain.handle('get-storage-status', () => settingsManager.getStorageStatus());
ipcMain.handle('restart-for-storage', () => {
  app.relaunch();
  setImmediate(() => app.exit(0));
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
  refreshInterval: number,
  colorScheme: 'green-up' | 'red-up',
  watchlistSymbols: string[]
}) => {
  try {
    if (!settings || !Array.isArray(settings.watchlistSymbols) || settings.watchlistSymbols.length > 8) throw new Error('观察列表最多 8 个标的');
    const previous = settingsManager.getDisplaySettings();
    const added = settings.watchlistSymbols.filter(symbol => !previous.watchlistSymbols.includes(symbol));
    researchMarket.setProxy(settingsManager.getProxyUrl());
    for (const symbol of added) if (!await researchMarket.isSupportedSymbol(symbol)) throw new Error('观察列表仅支持币安在交易的 USDT 永续合约');
    await settingsManager.setDisplaySettings(settings.maxDisplayCount, settings.refreshInterval, {
      colorScheme: settings.colorScheme, watchlistSymbols: settings.watchlistSymbols,
    });
    maxDisplayCount = settings.maxDisplayCount;
    refreshIntervalSeconds = settings.refreshInterval;

  // 更新显示
  updateTrayTitle();

  // 重启自动刷新以应用新的刷新间隔
  if (exchangeManager.hasAnyCredentials()) {
    startAutoRefresh();
  }
  broadcast('preferences-changed');
  return { success: true };
  } catch { return { success: false, error: '显示设置未保存，请检查数值、观察合约、网络或系统钥匙串。' }; }
});

// 获取显示设置
ipcMain.handle('get-display-settings', async () => {
  return settingsManager.getDisplaySettings();
});

// 保存主题设置
ipcMain.handle('save-theme', async (_, theme: 'light' | 'dark' | 'auto') => {
  await settingsManager.setTheme(theme);
  broadcast('preferences-changed');
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
  await settingsManager.setPositionOrder(order);
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
  if (typeof hide !== 'boolean') return { success: false, error: '显示设置无效' };
  // Mask the native menu immediately; a network read must never delay privacy.
  if (hide) { privacyMaskPending = true; tray?.setTitle('••••'); setMenuSignal(null); }
  await settingsManager.setHideAmounts(hide);
  privacyMaskPending = false;
  updateTrayTitle();
  broadcast('preferences-changed');
  return { success: true };
});

// 获取隐藏金额设置
ipcMain.handle('get-hide-amounts', async () => {
  return settingsManager.getHideAmounts();
});

// 保存调试模式设置
ipcMain.handle('save-debug-mode', async (_, debug: boolean) => {
  await settingsManager.setDebugMode(debug);

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
  await settingsManager.setWindowOpacity(opacity);
  broadcast('preferences-changed');

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
  await settingsManager.setAutoLaunch(autoLaunch);
  broadcast('preferences-changed');
  app.setLoginItemSettings({ openAtLogin: autoLaunch });
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
  await settingsManager.resetToDefaults();
  researchEpoch++;
  await paperController?.invalidate();
  researchController.invalidate();
  aiService.setConfig(settingsManager.getAISettings());
  aiService.clearCache();
  researchMarket.setProxy(settingsManager.getProxyUrl());
  app.setLoginItemSettings({ openAtLogin: false });
  broadcast('preferences-changed');
  return { success: true };
});

// 删除所有数据（包括API凭证）
ipcMain.handle('delete-all-data', async () => {
  try {
    // Stop all writers before explicit delete-all; starting a new cycle never takes this path.
    stopAutoRefresh();
    researchEpoch++;
    researchController.invalidate();
    paperController?.stop();
    paperController = undefined;
    await paperLedger?.close();
    await fileSystem.unlink(path.join(app.getPath('userData'), 'paper-ledger.json')).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (researchLedger) await researchLedger.clearAll();
    else {
      await ResearchLedger.eraseFile(path.join(app.getPath('userData'), 'research-ledger.json'));
      researchLedger = await ResearchLedger.open({ filePath: path.join(app.getPath('userData'), 'research-ledger.json') });
    }

    // Persist deletion before clearing running services; failed deletion keeps them intact.
    await settingsManager.clearSettings();
    exchangeManager.removeAllCredentials();
    aiService.setConfig(settingsManager.getAISettings());
    aiService.clearCache();
    privacyMaskPending = true;
    tray?.setTitle('--');
    setMenuSignal(null);
    app.setLoginItemSettings({ openAtLogin: false });
    if (window) {
      window.setOpacity(1);
      window.webContents.closeDevTools();
    }

    console.log('[IPC] All data deleted successfully');
    privacyMaskPending = false;
    broadcast('research-ledger-changed');
    await initializePaper();
    broadcast('paper-changed');
    broadcast('data-cleared');
    broadcast('preferences-changed');
    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error deleting all data:', requestDiagnostic(error));
    return { success: false, error: error.message };
  }
});

// ============ 新版多交易所 IPC handlers ============

// 保存单个交易所的凭证
ipcMain.handle('save-exchange-credentials', async (_, exchange: string, credentials: any) => {
  try {
    const exchangeType = exchange.toLowerCase() as ExchangeType;

    // 保存到设置管理器
    await settingsManager.setExchangeCredentials(
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
    console.error('[IPC] Error saving exchange credentials:', requestDiagnostic(error));
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
    console.error('[IPC] Error getting exchange credentials:', requestDiagnostic(error));
    return null;
  }
});

// 获取所有交易所的凭证
ipcMain.handle('get-all-exchanges-credentials', async () => {
  try {
    return settingsManager.getAllExchangesCredentials();
  } catch (error: any) {
    console.error('[IPC] Error getting all exchanges credentials:', requestDiagnostic(error));
    return {};
  }
});

// 删除单个交易所的凭证
ipcMain.handle('remove-exchange-credentials', async (_, exchange: string) => {
  try {
    const exchangeType = exchange.toLowerCase() as ExchangeType;

    // 从设置管理器删除
    await settingsManager.removeExchangeCredentials(
      exchange as 'binance' | 'bybit' | 'okx' | 'hyperliquid'
    );

    // 从交易所管理器删除
    exchangeManager.removeCredentials(exchangeType);

    // 更新托盘显示
    updateTrayTitle();

    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error removing exchange credentials:', requestDiagnostic(error));
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
    console.error('[IPC] Error getting AI settings:', requestDiagnostic(error));
    return null;
  }
});

/**
 * 保存AI设置
 */
ipcMain.handle('save-ai-settings', async (_, aiSettings: AISettings) => {
  try {
    validateAISettingsModels(aiSettings);
    await settingsManager.setAISettings(aiSettings);
    researchEpoch++;
    await paperController?.invalidate();

    // 初始化AI服务
    aiService.setConfig(aiSettings);
    researchController.invalidate();
    broadcast('preferences-changed');
    console.log('[IPC] AI configuration applied');

    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error saving AI settings:', requestDiagnostic(error));
    return { success: false, error: error.message };
  }
});

/**
 * 分析持仓健康度
 */
ipcMain.handle('get-public-market', async (_, symbols: string[]) => {
  try {
    publicMarketService.setProxy(settingsManager.getProxyUrl());
    return {success:true,data:await publicMarketService.snapshot(symbols)};
  } catch { return {success:false,error:'公共市场数据暂不可用，请检查网络或稍后重试。'}; }
});
ipcMain.handle('ai-analyze-health', async (_, positions, accountInfo, provider?: AIProvider, forceRefresh = false) => {
  const epoch = researchEpoch;
  try {
    const configured = settingsManager.getAISettings();
    if (!configured.enabled || !configured.useCustomKeys || !aiService.isAvailable()) {
      throw new Error('请先启用自定义AI并保存Key与模型ID。');
    }

    if (forceRefresh) aiService.clearCache();
    console.log('[IPC] AI health analysis requested');
    buildRiskFacts(positions, accountInfo);
    publicMarketService.setProxy(settingsManager.getProxyUrl());
    const symbols = [...new Set((positions as Position[]).map(binanceResearchSymbol).filter((symbol): symbol is string => symbol !== null))];
    const market = await publicMarketService.snapshot(symbols);
    // This preflight predates the AI service's own generation guard. A deleted
    // snapshot must never be sent later through newly configured credentials.
    if (epoch !== researchEpoch) throw new Error('AI 配置或数据已变更，请重新分析');
    const result = await aiService.analyzePortfolioHealth(positions, accountInfo, provider, market);
    if (epoch !== researchEpoch) throw new Error('AI 配置或数据已变更，请重新分析');

    return { success: true, data: result };
  } catch (error: any) {
    console.error('[IPC] AI health analysis failed:', requestDiagnostic(error));
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

    console.log('[IPC] AI chat requested');
    const response = await aiService.chat(message, context, provider);

    return { success: true, data: response };
  } catch (error: any) {
    console.error('[IPC] AI chat failed:', requestDiagnostic(error));
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
    console.error('[IPC] Error clearing AI conversation:', requestDiagnostic(error));
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
    console.error('[IPC] Error checking AI availability:', requestDiagnostic(error));
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
    console.error('[IPC] Error getting AI providers:', requestDiagnostic(error));
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
    console.error('[IPC] Error getting exchange errors:', requestDiagnostic(error));
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
    console.error('[IPC] Error clearing exchange errors:', requestDiagnostic(error));
    return { success: false, error: error.message };
  }
});

// ============ 工具函数 IPC Handlers ============

/**
 * 打开外部链接
 */
ipcMain.handle('open-external', async (_, url: string) => {
  try {
    const destination = new URL(url);
    if (destination.protocol !== 'https:' || destination.username || destination.password) throw new Error('Only public HTTPS links are supported');
    await shell.openExternal(destination.toString());
    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error opening external URL:', requestDiagnostic(error));
    return { success: false, error: error.message };
  }
});

/**
 * 最小化窗口
 */
ipcMain.handle('minimize-window', async event => {
  try {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error minimizing window:', requestDiagnostic(error));
    return { success: false, error: error.message };
  }
});

/**
 * 保存代理设置并应用到所有已配置的交易所
 */
ipcMain.handle('save-proxy-settings', async (_, proxyUrl: string) => {
  try {
    console.log('[IPC] Saving proxy settings');

    await settingsManager.setProxyUrl(proxyUrl);
    researchEpoch++;
    await paperController?.invalidate();
    researchController.invalidate();
    researchMarket.setProxy(proxyUrl);
    broadcast('preferences-changed');

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
    console.error('[IPC] Error saving proxy settings:', requestDiagnostic(error));
    return { success: false, error: error.message };
  }
});

