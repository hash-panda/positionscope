/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  electronAPI: {
    saveApiKeys: (apiKey: string, apiSecret: string) => Promise<{ success: boolean }>;
    getSpotPositions: () => Promise<any>;
    getFuturesPositions: () => Promise<any>;
    hasCredentials: () => Promise<boolean>;
    onRefreshData: (callback: () => void) => void;
  };
}
