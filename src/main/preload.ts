import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getWindowMode: () => ipcRenderer.invoke('get-window-mode'),
  openWorkspace: (page?: string) => ipcRenderer.invoke('open-workspace', page),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onAppUpdateState: (callback: (state: import('./services/update-install').UpdateState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: import('./services/update-install').UpdateState) => callback(state);
    ipcRenderer.on('app-update-state', listener);
    return () => ipcRenderer.removeListener('app-update-state', listener);
  },
  getPaperState: () => ipcRenderer.invoke('get-paper-state'),
  startPaperCycle: (input: unknown) => ipcRenderer.invoke('start-paper-cycle', input),
  setPaperMode: (id: string, mode: string) => ipcRenderer.invoke('set-paper-mode', id, mode),
  onPaperChanged: (callback: () => void) => {
    const listener = () => callback(); ipcRenderer.on('paper-changed', listener);
    return () => ipcRenderer.removeListener('paper-changed', listener);
  },
  getResearchSnapshot: () => ipcRenderer.invoke('get-research-snapshot'),
  getResearchEvidence: (symbol: string) => ipcRenderer.invoke('get-research-evidence', symbol),
  getWatchlistMarket: () => ipcRenderer.invoke('get-watchlist-market'),
  getResearchLedger: () => ipcRenderer.invoke('get-research-ledger'),
  analyzeResearch: (input: unknown) => ipcRenderer.invoke('analyze-research', input),
  setResearchWatch: (symbol: string, watched: boolean) => ipcRenderer.invoke('set-research-watch', symbol, watched),
  createResearchAlert: (input: unknown) => ipcRenderer.invoke('create-research-alert', input),
  removeResearchAlert: (id: string) => ipcRenderer.invoke('remove-research-alert', id),
  rearmResearchAlert: (id: string) => ipcRenderer.invoke('rearm-research-alert', id),
  registerResearchShadow: (input: unknown) => ipcRenderer.invoke('register-research-shadow', input),
  onWorkspacePage: (callback: (page: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, page: string) => callback(page);
    ipcRenderer.on('workspace-page', listener);
    return () => ipcRenderer.removeListener('workspace-page', listener);
  },
  onPreferencesChanged: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('preferences-changed', listener);
    return () => ipcRenderer.removeListener('preferences-changed', listener);
  },
  onDataCleared: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('data-cleared', listener);
    return () => ipcRenderer.removeListener('data-cleared', listener);
  },
  onResearchLedgerChanged: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('research-ledger-changed', listener);
    return () => ipcRenderer.removeListener('research-ledger-changed', listener);
  },
  onResearchAlert: (callback: (alerts: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, alerts: unknown[]) => callback(alerts);
    ipcRenderer.on('research-alert-triggered', listener);
    return () => ipcRenderer.removeListener('research-alert-triggered', listener);
  },
  getProxySettings: () => ipcRenderer.invoke('get-proxy-settings'),
  getStorageStatus: () => ipcRenderer.invoke('get-storage-status'),
  restartForStorage: () => ipcRenderer.invoke('restart-for-storage'),
  hasCredentials: () =>
    ipcRenderer.invoke('has-credentials'),

  // 新版多交易所 API
  saveExchangeCredentials: (exchange: string, credentials: any) =>
    ipcRenderer.invoke('save-exchange-credentials', exchange, credentials),

  getExchangeCredentials: (exchange: string) =>
    ipcRenderer.invoke('get-exchange-credentials', exchange),

  getAllExchangesCredentials: () =>
    ipcRenderer.invoke('get-all-exchanges-credentials'),

  removeExchangeCredentials: (exchange: string) =>
    ipcRenderer.invoke('remove-exchange-credentials', exchange),

  // 数据获取
  getSpotPositions: () =>
    ipcRenderer.invoke('get-spot-positions'),

  getFuturesPositions: () =>
    ipcRenderer.invoke('get-futures-positions'),

  getFuturesAccountInfo: () =>
    ipcRenderer.invoke('get-futures-account-info'),

  // 显示设置
  saveDisplaySettings: (settings: { maxDisplayCount: number, refreshInterval: number }) =>
    ipcRenderer.invoke('save-display-settings', settings),

  getDisplaySettings: () =>
    ipcRenderer.invoke('get-display-settings'),

  // 主题
  saveTheme: (theme: 'light' | 'dark' | 'auto') =>
    ipcRenderer.invoke('save-theme', theme),

  getTheme: () =>
    ipcRenderer.invoke('get-theme'),

  // 事件监听
  onRefreshData: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('refresh-data', listener);
    return () => ipcRenderer.removeListener('refresh-data', listener);
  },

  // 应用控制
  quitApp: () =>
    ipcRenderer.invoke('quit-app'),

  // 持仓顺序
  savePositionOrder: (order: string[]) =>
    ipcRenderer.invoke('save-position-order', order),

  getPositionOrder: () =>
    ipcRenderer.invoke('get-position-order'),

  // 其他设置
  saveHideAmounts: (hide: boolean) =>
    ipcRenderer.invoke('save-hide-amounts', hide),

  getHideAmounts: () =>
    ipcRenderer.invoke('get-hide-amounts'),

  saveDebugMode: (debug: boolean) =>
    ipcRenderer.invoke('save-debug-mode', debug),

  getDebugMode: () =>
    ipcRenderer.invoke('get-debug-mode'),

  saveWindowOpacity: (opacity: number) =>
    ipcRenderer.invoke('save-window-opacity', opacity),

  getWindowOpacity: () =>
    ipcRenderer.invoke('get-window-opacity'),

  saveAutoLaunch: (autoLaunch: boolean) =>
    ipcRenderer.invoke('save-auto-launch', autoLaunch),

  getAutoLaunch: () =>
    ipcRenderer.invoke('get-auto-launch'),

  getAppVersion: () =>
    ipcRenderer.invoke('get-app-version'),

  resetToDefaults: () =>
    ipcRenderer.invoke('reset-to-defaults'),

  deleteAllData: () =>
    ipcRenderer.invoke('delete-all-data'),

  // AI 相关 API
  getAISettings: () =>
    ipcRenderer.invoke('get-ai-settings'),

  saveAISettings: (settings: any) =>
    ipcRenderer.invoke('save-ai-settings', settings),

  getPublicMarket: (symbols: string[]) => ipcRenderer.invoke('get-public-market', symbols),
  aiAnalyzeHealth: (positions: any, accountInfo: any, provider?: string, forceRefresh = false) =>
    ipcRenderer.invoke('ai-analyze-health', positions, accountInfo, provider, forceRefresh),

  aiChat: (message: string, context?: any, provider?: string) =>
    ipcRenderer.invoke('ai-chat', message, context, provider),

  aiClearConversation: () =>
    ipcRenderer.invoke('ai-clear-conversation'),

  aiIsAvailable: () =>
    ipcRenderer.invoke('ai-is-available'),

  aiGetProviders: () =>
    ipcRenderer.invoke('ai-get-providers'),

  // 错误处理相关 API
  getExchangeErrors: () =>
    ipcRenderer.invoke('get-exchange-errors'),

  clearExchangeErrors: () =>
    ipcRenderer.invoke('clear-exchange-errors'),

  onExchangeErrors: (callback: (errors: any[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, errors: any[]) => callback(errors);
    ipcRenderer.on('exchange-errors', listener);
    return () => ipcRenderer.removeListener('exchange-errors', listener);
  },

  // 工具函数
  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url),

  // 窗口控制
  minimizeWindow: () =>
    ipcRenderer.invoke('minimize-window'),

  // 代理设置
  saveProxySettings: (proxyUrl: string) =>
    ipcRenderer.invoke('save-proxy-settings', proxyUrl),
});

