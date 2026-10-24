export type Exchange = 'binance' | 'bybit' | 'okx' | 'hyperliquid';
export type Provider = 'openai' | 'anthropic' | 'deepseek' | 'qwen' | 'grok' | 'gemini';
export type SettingsPage =
  | 'index'
  | 'exchanges'
  | 'display'
  | 'appearance'
  | 'system'
  | 'ai'
  | 'developer'
  | 'about';
export interface Position {
  exchange: Exchange;
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  marginType: string;
  isolatedMargin: string;
  leverage: string;
}
export interface AccountInfo {
  exchange: Exchange;
  totalWalletBalance: number;
  totalUnrealizedProfit: number;
  totalMarginBalance: number;
  availableBalance: number;
  maxWithdrawAmount: number;
  spotTotalUSDT?: number;
  totalAssets?: number;
  fundingAccountUSDT?: number;
  tradingAccountUSDT?: number;
}
export interface Credentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
}
export type CredentialsMap = Record<Exchange, Credentials>;
export interface AISettings {
  enabled: boolean;
  defaultProvider: Provider;
  useCustomKeys: boolean;
  credentials: Partial<Record<Provider, { provider: Provider; apiKey: string; baseURL?: string; model?: string }>>;
}
export type HealthScore = import('../../main/types/ai').HealthScore;
export interface ExchangeError {
  exchange: Exchange;
  errorCode: string;
  errorMessage?: string;
  suggestion: string;
}
export interface Preferences {
  maxDisplayCount: number;
  refreshInterval: number;
  hideAmounts: boolean;
  dark: boolean;
  windowOpacity: number;
  autoLaunch: boolean;
  debugMode: boolean;
  proxyUrl: string;
  aiEnabled: boolean;
  defaultProvider: Provider;
  useCustomKeys: boolean;
}
export interface NoticeInput {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  persistent?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}
export interface Result {
  success: boolean;
  error?: string;
}
export interface ElectronAPI {
  hasCredentials(): Promise<boolean>;
  getAllExchangesCredentials(): Promise<Partial<CredentialsMap>>;
  saveExchangeCredentials(
    exchange: Exchange,
    credentials: Credentials & { proxyUrl: string }
  ): Promise<Result>;
  removeExchangeCredentials(exchange: Exchange): Promise<Result>;
  getFuturesPositions(): Promise<Position[] | { error: string }>;
  getFuturesAccountInfo(): Promise<AccountInfo[] | { error: string }>;
  getDisplaySettings(): Promise<{ maxDisplayCount: number; refreshInterval: number }>;
  saveDisplaySettings(settings: {
    maxDisplayCount: number;
    refreshInterval: number;
  }): Promise<Result>;
  getTheme(): Promise<'light' | 'dark' | 'auto'>;
  saveTheme(theme: 'light' | 'dark'): Promise<void | Result>;
  getHideAmounts(): Promise<boolean>;
  saveHideAmounts(value: boolean): Promise<void | Result>;
  getDebugMode(): Promise<boolean>;
  saveDebugMode(value: boolean): Promise<void | Result>;
  getWindowOpacity(): Promise<number>;
  saveWindowOpacity(value: number): Promise<void | Result>;
  getAutoLaunch(): Promise<boolean>;
  saveAutoLaunch(value: boolean): Promise<void | Result>;
  getAppVersion(): Promise<string>;
  getPositionOrder(): Promise<string[]>;
  savePositionOrder(order: string[]): Promise<Result>;
  getAISettings(): Promise<AISettings | null>;
  saveAISettings(settings: AISettings): Promise<Result>;
  aiAnalyzeHealth(
    positions: Position[],
    accountInfo: Omit<AccountInfo, 'exchange'> & { exchange: string },
    provider: Provider,
    forceRefresh?: boolean
  ): Promise<Result & { data?: HealthScore }>;
  getExchangeErrors(): Promise<ExchangeError[]>;
  clearExchangeErrors(): Promise<Result>;
  saveProxySettings(value: string): Promise<Result>;
  resetToDefaults(): Promise<Result>;
  deleteAllData(): Promise<Result>;
  openExternal(url: string): Promise<void>;
  minimizeWindow(): Promise<void>;
  quitApp(): Promise<void>;
  onRefreshData(callback: () => void): (() => void) | void;
  onExchangeErrors(callback: (errors: ExchangeError[]) => void): (() => void) | void;
}
export const exchanges: { id: Exchange; name: string }[] = [
  { id: 'binance', name: 'Binance' },
  { id: 'bybit', name: 'Bybit' },
  { id: 'okx', name: 'OKX' },
  { id: 'hyperliquid', name: 'Hyperliquid' },
];
export const providers: { id: Provider; name: string; url: string }[] = [
  { id: 'openai', name: 'OpenAI', url: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', name: 'Anthropic', url: 'https://console.anthropic.com/' },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://platform.deepseek.com/' },
  { id: 'qwen', name: 'Qwen', url: 'https://bailian.console.aliyun.com/' },
  { id: 'grok', name: 'Grok', url: 'https://console.x.ai/' },
  { id: 'gemini', name: 'Gemini', url: 'https://aistudio.google.com/apikey' },
];
