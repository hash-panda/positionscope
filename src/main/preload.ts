import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 旧版 API（向后兼容）
  saveApiKeys: (apiKey: string, apiSecret: string, proxyUrl?: string) =>
    ipcRenderer.invoke('save-api-keys', apiKey, apiSecret, proxyUrl),

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
  onRefreshData: (callback: () => void) =>
    ipcRenderer.on('refresh-data', callback),

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
});
