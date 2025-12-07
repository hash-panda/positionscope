import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveApiKeys: (apiKey: string, apiSecret: string, proxyUrl?: string) =>
    ipcRenderer.invoke('save-api-keys', apiKey, apiSecret, proxyUrl),

  getSpotPositions: () =>
    ipcRenderer.invoke('get-spot-positions'),

  getFuturesPositions: () =>
    ipcRenderer.invoke('get-futures-positions'),

  hasCredentials: () =>
    ipcRenderer.invoke('has-credentials'),

  saveDisplaySettings: (settings: { maxDisplayCount: number, refreshInterval: number }) =>
    ipcRenderer.invoke('save-display-settings', settings),

  getDisplaySettings: () =>
    ipcRenderer.invoke('get-display-settings'),

  saveTheme: (theme: 'light' | 'dark' | 'auto') =>
    ipcRenderer.invoke('save-theme', theme),

  getTheme: () =>
    ipcRenderer.invoke('get-theme'),

  onRefreshData: (callback: () => void) =>
    ipcRenderer.on('refresh-data', callback),

  quitApp: () =>
    ipcRenderer.invoke('quit-app'),

  savePositionOrder: (order: string[]) =>
    ipcRenderer.invoke('save-position-order', order),

  getPositionOrder: () =>
    ipcRenderer.invoke('get-position-order'),

  getFuturesAccountInfo: () =>
    ipcRenderer.invoke('get-futures-account-info'),

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
