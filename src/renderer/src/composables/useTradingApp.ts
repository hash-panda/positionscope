import { sumKnown } from '../../../main/utils/position-math';
import { diffPositions, type PositionEvent } from '../../../main/utils/position-diff';
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import type { UnwrapNestedRefs } from 'vue';
import { orderPositions, positionKey } from '../../../main/utils/position-order';
import { exchanges, providers } from '../types';
import type {
  AccountInfo,
  AISettings,
  CredentialsMap,
  Exchange,
  ExchangeError,
  HealthScore,
  NoticeInput,
  Position,
  Preferences,
  Provider,
  Result,
} from '../types';

const emptyCredentials = (): CredentialsMap => ({
  binance: { apiKey: '', apiSecret: '' },
  bybit: { apiKey: '', apiSecret: '' },
  okx: { apiKey: '', apiSecret: '', passphrase: '' },
  hyperliquid: { apiKey: '', apiSecret: '' },
});
const emptyKeys = (): Record<Provider, string> => ({
  openai: '',
  anthropic: '',
  deepseek: '',
  qwen: '',
  grok: '',
  gemini: '',
});
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
function check(result: Result | void) {
  if (result && !result.success) throw new Error(result.error || '操作未完成，请重试');
}

export function useTradingApp(notify: (notice: NoticeInput) => void) {
  const api = window.electronAPI;
  const ready = ref(false);
  const storageStatus = ref<import('../../../main/settings').StorageStatus>({state: 'empty', message: ''});
  const loading = ref(false);
  const hasCredentials = ref(false);
  const positions = ref<Position[]>([]);
  const positionEvents = ref<PositionEvent[]>([]);
  const historyGap = ref(false);
  let journalBaseline: Position[] | null = null;
  const accounts = ref<AccountInfo[]>([]);
  const exchangeErrors = ref<ExchangeError[]>([]);
  const error = ref('');
  const lastUpdated = ref<Date | null>(null);
  const currentView = ref<'overview' | 'settings' | 'sort' | 'health' | 'activity'>('overview');
  const preferences = reactive<Preferences>({
    maxDisplayCount: 2,
    refreshInterval: 5,
    hideAmounts: false,
    dark: true,
    windowOpacity: 1,
    autoLaunch: false,
    debugMode: false,
    proxyUrl: '',
    aiEnabled: false,
    defaultProvider: 'anthropic',
    useCustomKeys: true,
  });
  const credentialDrafts = reactive(emptyCredentials());
  const savedCredentials = reactive(emptyCredentials());
  const aiKeyDrafts = reactive(emptyKeys());
  const aiModelDrafts = reactive(emptyKeys());
  let savedAI: AISettings['credentials'] = {};
  const appVersion = ref('');
  const savedOrder = ref<string[]>([]);
  const editingOrder = ref<string[]>([]);
  const saving = ref('');
  const formError = ref('');
  const formSuccess = ref('');
  const analyzing = ref(false);
  const healthScore = ref<HealthScore | null>(null);
  const analysisTime = ref<Date | null>(null);
  const analysisProvider = ref('');
  let timer: ReturnType<typeof setInterval> | undefined;
  let disposed = false;
  let generation = 0;
  const cleanups: (() => void)[] = [];
  let committedPreferences = { ...preferences };

  const configuredExchanges = computed(() =>
    exchanges.filter(({ id }) => !!savedCredentials[id].apiKey)
  );
  const sortedPositions = computed(() =>
    orderPositions(
      [...positions.value].sort(
        (a, b) => Math.abs(Number(b.unRealizedProfit)) - Math.abs(Number(a.unRealizedProfit))
      ),
      currentView.value === 'sort' ? editingOrder.value : savedOrder.value
    )
  );
  const totals = computed(() => ({
    totalAssets: sumKnown(accounts.value.map(a => a.totalAssets)),
    spot: sumKnown(accounts.value.map(a => a.spotTotalUSDT)),
    margin: sumKnown(accounts.value.map(a => a.totalMarginBalance)),
    available: sumKnown(accounts.value.map(a => a.availableBalance)),
  }));
  const totalPnL = computed(() =>
    positions.value.reduce((sum, position) => sum + Number(position.unRealizedProfit || 0), 0)
  );
  const stale = computed(() => !!error.value || exchangeErrors.value.length > 0);
  const mask = (value: string) => (preferences.hideAmounts ? '••••••' : value);

  async function fetchData() {
    if (!api || loading.value || !hasCredentials.value) return;
    const requestGeneration = generation;
    loading.value = true;
    try {
      const [positionResult, accountResult] = await Promise.allSettled([
        api.getFuturesPositions(),
        api.getFuturesAccountInfo(),
      ]);
      if (disposed || requestGeneration !== generation) return;
      const failures: string[] = [];
      // Error states are read AFTER the data requests so partial responses keep their context.
      try {
        exchangeErrors.value = await api.getExchangeErrors();
      } catch {
        failures.push('连接状态暂时不可用');
      }
      if (disposed || requestGeneration !== generation) return;
      const failedExchanges = new Set(exchangeErrors.value.map((item) => item.exchange));
      if (positionResult.status === 'fulfilled' && Array.isArray(positionResult.value)) {
        positions.value = [
          ...positionResult.value.filter((item) => !failedExchanges.has(item.exchange)),
          ...positions.value.filter((item) => failedExchanges.has(item.exchange)),
        ];
      } else failures.push('持仓更新失败');
      if (accountResult.status === 'fulfilled' && Array.isArray(accountResult.value)) {
        accounts.value = [
          ...accountResult.value.filter((item) => !failedExchanges.has(item.exchange)),
          ...accounts.value.filter((item) => failedExchanges.has(item.exchange)),
        ];
      } else failures.push('资产更新失败');
      error.value = failures.join('，');
      if (!failures.length && !failedExchanges.size) {
        lastUpdated.value = new Date();
        try {
          if (journalBaseline) positionEvents.value = [...diffPositions(journalBaseline as any, positions.value as any, Date.now()), ...positionEvents.value].slice(0,40);
          journalBaseline = JSON.parse(JSON.stringify(positions.value));
        } catch { journalBaseline = null; historyGap.value = true; }
      } else { journalBaseline = null; historyGap.value = true; }
    } catch (cause) {
      journalBaseline = null; historyGap.value = true;
      if (!disposed && requestGeneration === generation)
        error.value = `数据更新失败：${message(cause)}`;
    } finally {
      if (requestGeneration === generation) loading.value = false;
    }
  }

  function restartTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      if (currentView.value === 'overview' || currentView.value === 'activity') void fetchData();
    }, preferences.refreshInterval * 1000);
  }

  async function runSave(scope: string, action: () => Promise<void>, success: string) {
    if (!api || saving.value) return false;
    saving.value = scope;
    formError.value = '';
    formSuccess.value = '';
    try {
      await action();
      storageStatus.value = await api.getStorageStatus();
      formSuccess.value = success;
      return true;
    } catch (cause) {
      formError.value = message(cause);
      notify({ type: 'error', title: '保存失败', message: formError.value, persistent: true });
      return false;
    } finally {
      saving.value = '';
    }
  }

  async function saveExchange(exchange: Exchange) {
    formError.value = '';
    const draft = credentialDrafts[exchange];
    if (
      !draft.apiKey.trim() ||
      (exchange !== 'hyperliquid' && !draft.apiSecret.trim()) ||
      (exchange === 'okx' && !draft.passphrase?.trim())
    ) {
      formError.value = exchange === 'hyperliquid' ? '请输入钱包地址' : '请完整填写所需凭证';
      return;
    }
    if (exchange === 'hyperliquid' && !/^0x[0-9a-fA-F]{40}$/.test(draft.apiKey.trim())) {
      formError.value = '请输入有效的 0x 钱包地址（40 位十六进制字符）';
      return;
    }
    await runSave(
      `exchange:${exchange}`,
      async () => {
        const credentials = {
          apiKey: draft.apiKey.trim(),
          apiSecret: draft.apiSecret.trim(),
          ...(exchange === 'okx' ? { passphrase: draft.passphrase?.trim() } : {}),
        };
        check(
          await api!.saveExchangeCredentials(exchange, {
            ...credentials,
            proxyUrl: preferences.proxyUrl.trim(),
          })
        );
        Object.assign(savedCredentials[exchange], credentials);
        hasCredentials.value = await api!.hasCredentials();
        notify({
          type: 'success',
          title: '凭证已保存',
          message: `${exchange} 配置已保存，正在获取数据`,
          persistent: true,
        });
        await fetchData();
      },
      '凭证已保存'
    );
  }

  async function removeExchange(exchange: Exchange) {
    return runSave(
      `remove:${exchange}`,
      async () => {
        check(await api!.removeExchangeCredentials(exchange));
        generation++;
        loading.value = false;
        Object.assign(savedCredentials[exchange], emptyCredentials()[exchange]);
        Object.assign(credentialDrafts[exchange], emptyCredentials()[exchange]);
        journalBaseline = null;
        positionEvents.value = positionEvents.value.filter(item => item.exchange !== exchange);
        positions.value = positions.value.filter((item) => item.exchange !== exchange);
        accounts.value = accounts.value.filter((item) => item.exchange !== exchange);
        exchangeErrors.value = exchangeErrors.value.filter((item) => item.exchange !== exchange);
        hasCredentials.value = await api!.hasCredentials();
        healthScore.value = null;
        await fetchData();
      },
      '凭证已移除'
    );
  }

  async function savePreference(
    key: 'display' | 'hideAmounts' | 'dark' | 'windowOpacity' | 'autoLaunch' | 'debugMode'
  ) {
    const previous = { ...committedPreferences };
    const success = await runSave(
      key,
      async () => {
        if (key === 'display')
          check(
            await api!.saveDisplaySettings({
              maxDisplayCount: preferences.maxDisplayCount,
              refreshInterval: preferences.refreshInterval,
            })
          );
        else if (key === 'dark') check(await api!.saveTheme(preferences.dark ? 'dark' : 'light'));
        else if (key === 'hideAmounts') check(await api!.saveHideAmounts(preferences.hideAmounts));
        else if (key === 'windowOpacity')
          check(await api!.saveWindowOpacity(preferences.windowOpacity));
        else if (key === 'autoLaunch') check(await api!.saveAutoLaunch(preferences.autoLaunch));
        else check(await api!.saveDebugMode(preferences.debugMode));
      },
      '设置已保存'
    );
    if (success) {
      committedPreferences = { ...preferences };
      restartTimer();
    } else if (key === 'display') {
      preferences.maxDisplayCount = previous.maxDisplayCount;
      preferences.refreshInterval = previous.refreshInterval;
    } else Object.assign(preferences, { [key]: previous[key] });
  }

  async function saveProxy() {
    const value = preferences.proxyUrl.trim();
    if (value) {
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error();
      } catch {
        formError.value = '请输入有效的 HTTP / HTTPS 代理地址，或留空以直连';
        return;
      }
    }
    await runSave(
      'proxy',
      async () => {
        check(await api!.saveProxySettings(value));
        preferences.proxyUrl = value;
      },
      value ? '代理已保存，将应用于后续请求' : '代理已清除'
    );
  }

  async function saveAI(commitKeys = false) {
    const credentials = commitKeys
      ? Object.fromEntries(
          providers.map(({ id }) => [
            id,
            { ...savedAI[id], provider: id, apiKey: aiKeyDrafts[id].trim(), model: aiModelDrafts[id].trim() || undefined },
          ])
        )
      : savedAI;
    const success = await runSave(
      'ai',
      async () => {
        check(
          await api!.saveAISettings({
            enabled: preferences.aiEnabled,
            defaultProvider: preferences.defaultProvider,
            useCustomKeys: preferences.useCustomKeys,
            credentials,
          })
        );
      },
      'AI 配置已保存'
    );
    if (success) {
      savedAI = structuredClone(credentials);
      committedPreferences = { ...preferences };
    } else {
      preferences.aiEnabled = committedPreferences.aiEnabled;
      preferences.defaultProvider = committedPreferences.defaultProvider;
      preferences.useCustomKeys = committedPreferences.useCustomKeys;
    }
  }

  async function analyze() {
    if (!api || analyzing.value || !positions.value.length || stale.value || loading.value) return;
    if (
      !preferences.aiEnabled ||
      !preferences.useCustomKeys ||
      !savedAI[preferences.defaultProvider]?.apiKey
    ) {
      notify({
        type: 'info',
        title: '请配置 AI 分析',
        message: '为默认提供商保存 API Key 后即可分析。',
      });
      currentView.value = 'settings';
      return false;
    }
    analyzing.value = true;
    const requestGeneration = generation;
    const selectedProvider = preferences.defaultProvider;
    try {
      const result = await api.aiAnalyzeHealth(
        JSON.parse(JSON.stringify(positions.value)),
        JSON.parse(JSON.stringify(accounts.value)),
        selectedProvider,
        true
      );
      if (disposed || requestGeneration !== generation) return;
      check(result);
      if (!result.data?.facts || typeof result.data.summary !== 'string' || !Array.isArray(result.data.warnings) || !Array.isArray(result.data.suggestions)) throw new Error('分析结果不完整，请重试');
      healthScore.value = result.data;
      analysisTime.value = new Date();
      analysisProvider.value =
        providers.find((item) => item.id === selectedProvider)?.name || selectedProvider;
      currentView.value = 'health';
      notify({
        type: 'success',
        title: 'AI 分析完成',
        message: '持仓健康度分析已更新',
        persistent: true,
        actionLabel: '查看详情',
        onAction: () => {
          if (healthScore.value) currentView.value = 'health';
        },
      });
    } catch (cause) {
      notify({ type: 'error', title: 'AI 分析失败', message: message(cause) });
    } finally {
      analyzing.value = false;
    }
    return true;
  }

  function beginSort() {
    editingOrder.value = sortedPositions.value.map(positionKey);
    currentView.value = 'sort';
  }
  function movePosition(index: number, offset: number) {
    const keys = sortedPositions.value.map(positionKey);
    const target = index + offset;
    if (target < 0 || target >= keys.length) return;
    [keys[index], keys[target]] = [keys[target], keys[index]];
    editingOrder.value = keys;
  }
  async function saveOrder() {
    const order = sortedPositions.value.map(positionKey);
    if (
      await runSave(
        'order',
        async () => {
          check(await api!.savePositionOrder(order));
          savedOrder.value = order;
        },
        '顺序已保存'
      )
    ) {
      currentView.value = 'overview';
      notify({ type: 'success', title: '顺序已保存', message: '持仓与菜单栏已使用新顺序' });
    }
  }

  async function retry() {
    if (!api || loading.value) return;
    try {
      check(await api.clearExchangeErrors());
      await fetchData();
    } catch (cause) {
      error.value = message(cause);
    }
  }

  async function loadPreferences() {
    if (!api) return;
    const settings = await api.getDisplaySettings();
    const theme = await api.getTheme();
    Object.assign(preferences, {
      ...settings,
      dark:
        theme === 'auto'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
          : theme !== 'light',
      hideAmounts: await api.getHideAmounts(),
      debugMode: await api.getDebugMode(),
      windowOpacity: await api.getWindowOpacity(),
      autoLaunch: await api.getAutoLaunch(),
    });
    const ai = await api.getAISettings();
    if (ai) {
      preferences.aiEnabled = ai.enabled;
      preferences.defaultProvider = ai.defaultProvider;
      preferences.useCustomKeys = ai.useCustomKeys;
      savedAI = structuredClone(ai.credentials || {});
      for (const { id } of providers) { aiKeyDrafts[id] = savedAI[id]?.apiKey || ''; aiModelDrafts[id] = savedAI[id]?.model || ''; }
    } else {
      Object.assign(aiKeyDrafts, emptyKeys());
      Object.assign(aiModelDrafts, emptyKeys());
      savedAI = {};
      preferences.aiEnabled = false;
    }
    committedPreferences = { ...preferences };
  }

  async function resetDefaults() {
    return runSave(
      'reset',
      async () => {
        check(await api!.resetToDefaults());
        await loadPreferences();
        savedOrder.value = await api!.getPositionOrder();
        preferences.proxyUrl = '';
        check(await api!.saveProxySettings(''));
        check(
          await api!.saveDisplaySettings({
            maxDisplayCount: preferences.maxDisplayCount,
            refreshInterval: preferences.refreshInterval,
          })
        );
        await api!.saveWindowOpacity(preferences.windowOpacity);
        await api!.saveDebugMode(preferences.debugMode);
        restartTimer();
      },
      '默认设置已恢复'
    );
  }
  async function deleteAll() {
    return runSave(
      'delete',
      async () => {
        check(await api!.deleteAllData());
        generation++;
        loading.value = false;
        positions.value = [];
        positionEvents.value = []; journalBaseline = null; historyGap.value = false;
        accounts.value = [];
        exchangeErrors.value = [];
        hasCredentials.value = false;
        lastUpdated.value = null;
        healthScore.value = null;
        Object.assign(credentialDrafts, emptyCredentials());
        Object.assign(savedCredentials, emptyCredentials());
        Object.assign(aiKeyDrafts, emptyKeys());
      Object.assign(aiModelDrafts, emptyKeys());
        savedAI = {};
        savedOrder.value = [];
        editingOrder.value = [];
        preferences.proxyUrl = '';
        await loadPreferences();
        restartTimer();
      },
      '所有数据已删除'
    );
  }

  watch(currentView, () => {
    formError.value = '';
    formSuccess.value = '';
  });
  watch(
    () => preferences.dark,
    (dark) => {
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    }
  );
  onMounted(async () => {
    if (!api) {
      error.value = '请通过桌面应用打开此界面';
      ready.value = true;
      return;
    }
    try {
      storageStatus.value = await api.getStorageStatus();
      await loadPreferences();
      const credentials = await api.getAllExchangesCredentials();
      for (const { id } of exchanges) {
        if (credentials[id]) {
          Object.assign(savedCredentials[id], credentials[id]);
          Object.assign(credentialDrafts[id], credentials[id]);
        }
      }
      preferences.proxyUrl = await api.getProxySettings();

      appVersion.value = await api.getAppVersion();
      savedOrder.value = await api.getPositionOrder();
      hasCredentials.value = await api.hasCredentials();
      const refreshCleanup = api.onRefreshData(() => {
        void fetchData();
      });
      const errorCleanup = api.onExchangeErrors((errors) => {
        exchangeErrors.value = errors;
      });
      if (refreshCleanup) cleanups.push(refreshCleanup);
      if (errorCleanup) cleanups.push(errorCleanup);
      restartTimer();
      await fetchData();
    } catch (cause) {
      error.value = `初始化失败：${message(cause)}`;
    } finally {
      ready.value = true;
    }
  });
  onUnmounted(() => {
    disposed = true;
    if (timer) clearInterval(timer);
    cleanups.forEach((cleanup) => cleanup());
  });

  return {
    api,
    storageStatus,
    ready,
    loading,
    hasCredentials,
    positions,
    positionEvents,
    historyGap,
    accounts,
    exchangeErrors,
    error,
    lastUpdated,
    currentView,
    preferences,
    credentialDrafts,
    savedCredentials,
    aiKeyDrafts,
    aiModelDrafts,
    appVersion,
    saving,
    formError,
    formSuccess,
    analyzing,
    healthScore,
    analysisTime,
    analysisProvider,
    configuredExchanges,
    sortedPositions,
    totals,
    totalPnL,
    stale,
    mask,
    fetchData,
    saveExchange,
    removeExchange,
    savePreference,
    saveProxy,
    saveAI,
    analyze,
    beginSort,
    movePosition,
    saveOrder,
    retry,
    resetDefaults,
    deleteAll,
  };
}
export type TradingApp = ReturnType<typeof useTradingApp>;
export type AppModel = UnwrapNestedRefs<TradingApp>;
