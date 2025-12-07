import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveApiKeys: (apiKey: string, apiSecret: string) =>
    ipcRenderer.invoke('save-api-keys', apiKey, apiSecret),

  getSpotPositions: () =>
    ipcRenderer.invoke('get-spot-positions'),

  getFuturesPositions: () =>
    ipcRenderer.invoke('get-futures-positions'),

  hasCredentials: () =>
    ipcRenderer.invoke('has-credentials'),

  onRefreshData: (callback: () => void) =>
    ipcRenderer.on('refresh-data', callback),
});
