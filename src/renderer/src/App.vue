<template>
  <div class="app" :class="{ 'dark-mode': isDarkMode }">
    <!-- Quit Confirmation Dialog -->
    <div v-if="showQuitConfirm" class="modal-overlay" @click="cancelQuit">
      <div class="modal-dialog" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">确认退出</h3>
        </div>
        <div class="modal-body">
          <p>确定要退出应用吗？</p>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-cancel" @click="cancelQuit">
            取消
          </button>
          <button class="modal-btn modal-btn-confirm" @click="confirmQuitApp">
            退出
          </button>
        </div>
      </div>
    </div>

    <!-- Settings Panel -->
    <div v-if="showSettings" class="settings-panel">
      <div class="settings-header">
        <button class="back-btn" @click="showSettings = false">
          <ChevronLeft :size="24" />
        </button>
        <h2 class="settings-title">设置</h2>
        <button class="quit-button-header" @click="showQuitConfirmDialog" title="退出应用">
          <Power :size="18" />
        </button>
      </div>

      <div class="settings-content">
        <!-- Theme Toggle -->
        <div class="settings-section">
          <div class="section-header">外观</div>
          <div class="setting-item">
            <div class="setting-label">
              <Moon :size="18" class="setting-icon-svg" />
              <span>深色模式</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="isDarkMode" @change="toggleTheme">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- API Settings -->
        <div class="settings-section">
          <div class="section-header">API 配置</div>
          <div class="setting-item column">
            <label class="input-label">API Key</label>
            <input
              v-model="apiKey"
              type="text"
              class="text-input"
              placeholder="输入 Binance API Key"
              @blur="saveApiCredentials"
            />
          </div>
          <div class="setting-item column">
            <label class="input-label">API Secret</label>
            <input
              v-model="apiSecret"
              type="password"
              class="text-input"
              placeholder="输入 Binance API Secret"
              @blur="saveApiCredentials"
            />
          </div>
          <div class="setting-notice">
            <AlertTriangle :size="16" class="notice-icon-svg" />
            <span>请确保 API Key 仅开启查询权限，不要开启交易权限</span>
          </div>
        </div>

        <!-- Proxy Settings -->
        <div class="settings-section">
          <div class="section-header">网络代理</div>
          <div class="setting-item column">
            <label class="input-label">代理地址（可选）</label>
            <input
              v-model="proxyUrl"
              type="text"
              class="text-input"
              placeholder="例如: http://127.0.0.1:7890"
              @blur="saveProxySettings"
            />
          </div>
          <div class="setting-notice">
            <Info :size="16" class="notice-icon-svg" />
            <span>留空则不使用代理。ClashX 默认端口为 7890</span>
          </div>
        </div>

        <!-- Menu Bar Display Settings -->
        <div class="settings-section">
          <div class="section-header">菜单栏显示</div>
          <div class="setting-item">
            <div class="setting-label">
              <Hash :size="18" class="setting-icon-svg" />
              <span>显示数量</span>
            </div>
            <select v-model="maxDisplayCount" class="select-input" @change="saveDisplaySettings">
              <option :value="1">1 个</option>
              <option :value="2">2 个</option>
            </select>
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <Clock :size="18" class="setting-icon-svg" />
              <span>刷新间隔</span>
            </div>
            <select v-model="refreshInterval" class="select-input" @change="saveDisplaySettings">
              <option :value="3">3 秒</option>
              <option :value="5">5 秒</option>
              <option :value="10">10 秒</option>
              <option :value="30">30 秒</option>
              <option :value="60">1 分钟</option>
            </select>
          </div>
          <div class="setting-notice">
            <Info :size="16" class="notice-icon-svg" />
            <span>使用文字模式在菜单栏显示持仓信息（币种 价格 收益 收益率）</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Panel -->
    <div v-else class="main-panel">
      <div class="main-header">
        <div class="header-left">
          <h1 class="app-title">合约持仓</h1>
          <span
            :class="[
              'total-pnl',
              totalPnL > 0 ? 'profit' : totalPnL < 0 ? 'loss' : 'neutral'
            ]"
          >
            {{ totalPnL >= 0 ? '+' : '' }}{{ formatNumber(totalPnL, 2) }} USDT
          </span>
        </div>
        <div class="header-actions">
          <template v-if="isEditMode">
            <button class="action-btn" @click="cancelEditMode" title="取消">
              <X :size="18" />
            </button>
            <button class="action-btn save-btn" @click="saveEditedOrder" title="保存">
              <Save :size="18" />
            </button>
          </template>
          <template v-else>
            <button class="action-btn" @click="enterEditMode" :disabled="!futuresPositions.length" title="编辑顺序">
              <Edit :size="18" />
            </button>
            <button class="action-btn" @click="fetchData" :disabled="loading" title="刷新">
              <RefreshCw :size="18" :class="{ 'rotating': loading }" />
            </button>
            <button class="action-btn" @click="showSettings = true" title="设置">
              <Settings :size="18" />
            </button>
          </template>
        </div>
      </div>

      <div v-if="error" class="error-message">{{ error }}</div>

      <div v-if="isEditMode" class="edit-mode-hint">
        <Info :size="14" class="hint-icon" />
        <span>使用上下箭头调整持仓顺序，完成后点击保存</span>
      </div>

      <div v-if="!hasCredentials" class="empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-title">未配置 API</div>
        <div class="empty-desc">请先在设置中配置您的 Binance API Key</div>
        <button class="primary-button" @click="showSettings = true">
          前往设置
        </button>
      </div>

      <div v-else-if="loading && !futuresPositions.length" class="loading-state">
        <div class="spinner"></div>
        <div class="loading-text">加载中...</div>
      </div>

      <div v-else class="positions-list">
        <div v-if="sortedPositions.length > 0">
          <div
            v-for="(position, index) in sortedPositions"
            :key="position.symbol"
            class="position-card"
            :class="{
              'is-profit': !isEditMode && parseFloat(position.unRealizedProfit) > 0,
              'is-loss': !isEditMode && parseFloat(position.unRealizedProfit) < 0,
              'is-neutral': !isEditMode && parseFloat(position.unRealizedProfit) === 0,
              'edit-mode-card': isEditMode
            }"
          >
            <!-- 编辑模式：简化显示 -->
            <div v-if="isEditMode" class="edit-mode-content">
              <div class="edit-controls">
                <button
                  class="edit-control-btn"
                  @click="movePositionUp(index)"
                  :disabled="index === 0"
                  title="上移"
                >
                  <ChevronUp :size="18" />
                </button>
                <button
                  class="edit-control-btn"
                  @click="movePositionDown(index)"
                  :disabled="index === sortedPositions.length - 1"
                  title="下移"
                >
                  <ChevronDown :size="18" />
                </button>
              </div>
              <div class="edit-symbol-info">
                <span class="edit-symbol-name">{{ formatSymbol(position.symbol) }}</span>
                <span class="edit-tag">{{ position.leverage }}x</span>
                <span class="edit-tag" :class="parseFloat(position.positionAmt) > 0 ? 'long' : 'short'">
                  {{ parseFloat(position.positionAmt) > 0 ? '多' : '空' }}
                </span>
              </div>
            </div>

            <!-- 正常模式：完整显示 -->
            <template v-else>
              <div class="card-header">
                <div class="symbol-info">
                  <span class="symbol-name">{{ formatSymbol(position.symbol) }}</span>
                  <span class="tag tag-leverage">{{ position.leverage }}x</span>
                  <span class="tag tag-side" :class="parseFloat(position.positionAmt) > 0 ? 'long' : 'short'">
                    {{ parseFloat(position.positionAmt) > 0 ? '多' : '空' }}
                  </span>
                </div>
                <div class="pnl-info">
                  <span class="pnl-amount" :class="{
                    'text-green': parseFloat(position.unRealizedProfit) > 0,
                    'text-red': parseFloat(position.unRealizedProfit) < 0,
                    'text-gray': parseFloat(position.unRealizedProfit) === 0
                  }">
                    {{ parseFloat(position.unRealizedProfit) >= 0 ? '+' : '' }}{{ formatNumber(parseFloat(position.unRealizedProfit), 2) }} USDT
                  </span>
                  <span class="pnl-percent" :class="{
                    'text-green': parseFloat(position.unRealizedProfit) > 0,
                    'text-red': parseFloat(position.unRealizedProfit) < 0,
                    'text-gray': parseFloat(position.unRealizedProfit) === 0
                  }">
                    {{ getPnLPercent(position) }}%
                  </span>
                </div>
              </div>

              <div class="card-grid">
                <div class="data-item">
                  <span class="data-label">开仓价</span>
                  <span class="data-value">{{ formatPrice(position.entryPrice) }}</span>
                </div>
                <div class="data-item">
                  <span class="data-label">当前价</span>
                  <span class="data-value">{{ formatPrice(position.markPrice) }}</span>
                </div>
                <div class="data-item">
                  <span class="data-label">持仓量</span>
                  <span class="data-value">{{ formatPositionValue(position) }} <span class="unit">USDT</span></span>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div v-else class="empty-state">
          <div class="empty-icon">💤</div>
          <div class="empty-title">暂无持仓</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import {
  ChevronLeft,
  Moon,
  AlertTriangle,
  Info,
  Hash,
  Clock,
  RefreshCw,
  Settings,
  Power,
  ChevronUp,
  ChevronDown,
  Edit,
  Save,
  X
} from 'lucide-vue-next';

interface FuturesPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  marginType: string;
  isolatedMargin: string;
  leverage: string;
}

// State
const showSettings = ref(false);
const apiKey = ref('');
const apiSecret = ref('');
const proxyUrl = ref('');
const isDarkMode = ref(false);
const maxDisplayCount = ref(2);
const refreshInterval = ref(5); // 默认5秒
const loading = ref(false);
const error = ref('');
const hasCredentials = ref(false);
const futuresPositions = ref<FuturesPosition[]>([]);
const customPositionOrder = ref<string[]>([]); // 用户自定义的持仓顺序（symbol数组）
const showQuitConfirm = ref(false); // 显示退出确认对话框
const isEditMode = ref(false); // 是否处于编辑模式
const editingOrder = ref<string[]>([]); // 编辑中的临时顺序
let panelRefreshInterval: NodeJS.Timeout | null = null;

// Computed
const totalPnL = computed(() => {
  return futuresPositions.value.reduce((sum, position) => {
    return sum + parseFloat(position.unRealizedProfit);
  }, 0);
});

// 按自定义顺序排序的持仓列表
const sortedPositions = computed(() => {
  // 在编辑模式下使用临时顺序，否则使用保存的顺序
  const orderToUse = isEditMode.value ? editingOrder.value : customPositionOrder.value;

  if (orderToUse.length === 0) {
    return futuresPositions.value;
  }

  // 按照顺序排序
  const ordered: FuturesPosition[] = [];
  const symbolMap = new Map<string, FuturesPosition>();

  futuresPositions.value.forEach(pos => {
    symbolMap.set(pos.symbol, pos);
  });

  // 先添加顺序中的持仓
  orderToUse.forEach(symbol => {
    const pos = symbolMap.get(symbol);
    if (pos) {
      ordered.push(pos);
      symbolMap.delete(symbol);
    }
  });

  // 再添加新的持仓（不在顺序中的）
  symbolMap.forEach(pos => {
    ordered.push(pos);
  });

  return ordered;
});

// Helper Functions
const formatSymbol = (symbol: string) => {
  return symbol.replace('USDT', '').replace('BUSD', '');
};

// 动态格式化价格 - 根据价格大小决定小数位数
const formatPrice = (priceStr: string) => {
  const price = parseFloat(priceStr);
  if (price >= 1000) return price.toFixed(2);      // 大于1000: 2位小数
  if (price >= 1) return price.toFixed(4);         // 1-1000: 4位小数
  if (price >= 0.01) return price.toFixed(6);      // 0.01-1: 6位小数
  return price.toFixed(8);                          // 小于0.01: 8位小数
};

// 格式化数字
const formatNumber = (num: number, decimals: number = 2) => {
  return num.toFixed(decimals);
};

// 计算持仓价值（USDT）
const formatPositionValue = (position: FuturesPosition) => {
  const positionAmt = Math.abs(parseFloat(position.positionAmt));
  const markPrice = parseFloat(position.markPrice);
  const value = positionAmt * markPrice;
  return formatNumber(value, 2);
};

const getPnLPercent = (position: FuturesPosition) => {
  const entry = parseFloat(position.entryPrice);
  const mark = parseFloat(position.markPrice);
  const posAmt = parseFloat(position.positionAmt);

  const pnlPercent = posAmt > 0
    ? ((mark - entry) / entry) * 100
    : ((entry - mark) / entry) * 100;

  return (pnlPercent >= 0 ? '+' : '') + pnlPercent.toFixed(2);
};

const getPnLClass = (pnl: string) => {
  const value = parseFloat(pnl);
  return value >= 0 ? 'profit' : 'loss';
};

// 进入编辑模式
const enterEditMode = () => {
  // 初始化编辑顺序
  if (customPositionOrder.value.length > 0) {
    editingOrder.value = [...customPositionOrder.value];
  } else {
    editingOrder.value = sortedPositions.value.map(p => p.symbol);
  }
  isEditMode.value = true;
};

// 退出编辑模式（取消）
const cancelEditMode = () => {
  isEditMode.value = false;
  editingOrder.value = [];
};

// 保存编辑后的顺序
const saveEditedOrder = async () => {
  customPositionOrder.value = [...editingOrder.value];
  await savePositionOrder();
  isEditMode.value = false;
  editingOrder.value = [];
};

// 移动持仓上移（仅在编辑模式下）
const movePositionUp = (index: number) => {
  if (index === 0) return;

  // 交换位置
  const temp = editingOrder.value[index];
  editingOrder.value[index] = editingOrder.value[index - 1];
  editingOrder.value[index - 1] = temp;
};

// 移动持仓下移（仅在编辑模式下）
const movePositionDown = (index: number) => {
  if (index >= sortedPositions.value.length - 1) return;

  // 交换位置
  const temp = editingOrder.value[index];
  editingOrder.value[index] = editingOrder.value[index + 1];
  editingOrder.value[index + 1] = temp;
};

// 保存持仓顺序到本地存储
const savePositionOrder = async () => {
  if (!(window as any).electronAPI) {
    return;
  }

  try {
    // 确保传递的是纯数组，不包含响应式代理
    const orderArray = [...customPositionOrder.value];
    await (window as any).electronAPI.savePositionOrder(orderArray);
    console.log('[Position Order] Saved:', orderArray);
  } catch (err: any) {
    console.error('[Position Order] Failed to save:', err);
  }
};

// Theme
const toggleTheme = async () => {
  const theme = isDarkMode.value ? 'dark' : 'light';

  if ((window as any).electronAPI) {
    await (window as any).electronAPI.saveTheme(theme);
  }
};

const loadTheme = async () => {
  if (!(window as any).electronAPI) {
    // 如果没有 electronAPI，默认深色模式
    isDarkMode.value = true;
    return;
  }

  try {
    const savedTheme = await (window as any).electronAPI.getTheme();
    if (savedTheme === 'dark') {
      isDarkMode.value = true;
    } else if (savedTheme === 'light') {
      isDarkMode.value = false;
    } else if (savedTheme === 'auto') {
      // auto - 跟随系统
      isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      // 首次启动，没有保存的主题 - 默认深色模式
      isDarkMode.value = true;
    }
  } catch (err) {
    console.error('Failed to load theme:', err);
    // 出错时默认深色模式
    isDarkMode.value = true;
  }
};

// Settings
// 显示退出确认对话框
const showQuitConfirmDialog = () => {
  showQuitConfirm.value = true;
};

// 取消退出
const cancelQuit = () => {
  showQuitConfirm.value = false;
};

// 确认退出应用
const confirmQuitApp = async () => {
  if (!(window as any).electronAPI) {
    return;
  }

  try {
    await (window as any).electronAPI.quitApp();
  } catch (err) {
    console.error('Failed to quit app:', err);
  }
};

// 保存 API 凭证
const saveApiCredentials = async () => {
  if (!apiKey.value || !apiSecret.value) {
    return; // 静默失败，用户还在输入
  }

  if (!(window as any).electronAPI) {
    return;
  }

  try {
    // 保存 API Keys 和代理地址
    await (window as any).electronAPI.saveApiKeys(apiKey.value, apiSecret.value, proxyUrl.value.trim());

    hasCredentials.value = true;
    error.value = '';

    // 重新启动面板刷新定时器
    startPanelRefresh();
    fetchData();

    console.log('[Settings] API credentials saved');
  } catch (err: any) {
    error.value = '保存 API 失败: ' + err.message;
  }
};

// 保存代理设置
const saveProxySettings = async () => {
  if (!(window as any).electronAPI) {
    return;
  }

  try {
    // 如果已经有凭证，重新保存
    if (apiKey.value && apiSecret.value) {
      await (window as any).electronAPI.saveApiKeys(apiKey.value, apiSecret.value, proxyUrl.value.trim());
    }

    console.log('[Settings] Proxy settings saved');
  } catch (err: any) {
    error.value = '保存代理失败: ' + err.message;
  }
};

// 保存菜单栏显示设置
const saveDisplaySettings = async () => {
  if (!(window as any).electronAPI) {
    return;
  }

  try {
    // 保存菜单栏显示设置
    await (window as any).electronAPI.saveDisplaySettings({
      maxDisplayCount: maxDisplayCount.value,
      refreshInterval: refreshInterval.value
    });

    // 重新启动面板刷新定时器（使用新的刷新间隔）
    startPanelRefresh();

    console.log('[Settings] Display settings saved');
  } catch (err: any) {
    error.value = '保存显示设置失败: ' + err.message;
  }
};

const fetchData = async () => {
  if (!(window as any).electronAPI) {
    error.value = 'Electron API 未加载';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const futuresData = await (window as any).electronAPI.getFuturesPositions();

    if (futuresData.error) {
      error.value = '合约数据获取失败: ' + futuresData.error;
    } else {
      futuresPositions.value = futuresData;
    }
  } catch (err: any) {
    error.value = '数据获取失败: ' + err.message;
  } finally {
    loading.value = false;
  }
};

// 启动面板刷新定时器
const startPanelRefresh = () => {
  // 清除旧的定时器
  if (panelRefreshInterval) {
    clearInterval(panelRefreshInterval);
  }

  // 启动新的定时器
  panelRefreshInterval = setInterval(() => {
    if (hasCredentials.value && !showSettings.value) {
      fetchData();
    }
  }, refreshInterval.value * 1000); // 转换为毫秒

  console.log(`[Panel] Refresh interval set to ${refreshInterval.value} seconds`);
};

// 监听刷新间隔变化
watch(refreshInterval, () => {
  if (hasCredentials.value) {
    startPanelRefresh();
  }
});

onMounted(async () => {
  // 加载主题
  loadTheme();

  // 加载代理设置
  const savedProxy = localStorage.getItem('proxyUrl');
  if (savedProxy) {
    proxyUrl.value = savedProxy;
  }

  // 检查 electronAPI 是否可用
  if (!(window as any).electronAPI) {
    error.value = '请使用 Electron 启动应用（运行 pnpm dev 或 ./dev.sh）';
    return;
  }

  // 加载菜单栏显示设置
  try {
    const settings = await (window as any).electronAPI.getDisplaySettings();
    if (settings) {
      maxDisplayCount.value = settings.maxDisplayCount || 2;
      refreshInterval.value = settings.refreshInterval || 5;
    }
  } catch (err) {
    console.error('Failed to load display settings:', err);
  }

  // 加载持仓顺序
  try {
    const savedOrder = await (window as any).electronAPI.getPositionOrder();
    if (savedOrder && savedOrder.length > 0) {
      customPositionOrder.value = savedOrder;
      console.log('[Position Order] Loaded:', savedOrder);
    }
  } catch (err) {
    console.error('Failed to load position order:', err);
  }

  hasCredentials.value = await (window as any).electronAPI.hasCredentials();

  if (hasCredentials.value) {
    fetchData();
    // 启动面板刷新定时器
    startPanelRefresh();
  }

  // 监听刷新事件
  (window as any).electronAPI.onRefreshData(() => {
    fetchData();
  });
});

// 组件卸载时清理定时器
onUnmounted(() => {
  if (panelRefreshInterval) {
    clearInterval(panelRefreshInterval);
  }
});
</script>

<style scoped>
/* CSS Variables - Light Mode */
.app {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f7;
  --bg-tertiary: #e8e8ed;
  --card-bg: #ffffff;
  --text-primary: #1d1d1f;
  --text-secondary: #86868b;
  --text-tertiary: #a1a1a6;
  --border-color: #d2d2d7;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --accent-blue: #007aff;
  --accent-green: #34c759;
  --accent-red: #ff3b30;
  --accent-orange: #ff9500;

  /* 盈利状态颜色 */
  --color-profit: #2da44e;
  --color-profit-glow: rgba(45, 164, 78, 0.2);
  --color-profit-text: #1e8449;
  --color-profit-border: rgba(45, 164, 78, 0.3);

  /* 亏损状态颜色 */
  --color-loss: #da3633;
  --color-loss-glow: rgba(218, 54, 51, 0.2);
  --color-loss-text: #c0392b;
  --color-loss-border: rgba(218, 54, 51, 0.3);

  /* 持平状态颜色 */
  --color-neutral: #7d8590;
  --color-neutral-glow: rgba(125, 133, 144, 0.15);
  --color-neutral-text: #86868b;
  --color-neutral-border: rgba(125, 133, 144, 0.3);
}

/* Dark Mode Variables */
.app.dark-mode {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --card-bg: #161b22;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-tertiary: #636366;
  --border-color: #30363d;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --accent-blue: #0a84ff;
  --accent-green: #32d74b;
  --accent-red: #ff453a;
  --accent-orange: #ff9f0a;

  /* 盈利状态颜色 - 深色模式 */
  --color-profit: #2da44e;
  --color-profit-glow: rgba(45, 164, 78, 0.2);
  --color-profit-text: #3fb950;
  --color-profit-border: rgba(45, 164, 78, 0.3);

  /* 亏损状态颜色 - 深色模式 */
  --color-loss: #da3633;
  --color-loss-glow: rgba(218, 54, 51, 0.2);
  --color-loss-text: #f85149;
  --color-loss-border: rgba(218, 54, 51, 0.3);

  /* 持平状态颜色 - 深色模式 */
  --color-neutral: #7d8590;
  --color-neutral-glow: rgba(125, 133, 144, 0.15);
  --color-neutral-text: #c9d1d9;
  --color-neutral-border: rgba(125, 133, 144, 0.3);
}

/* Base Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
  width: 400px;
  height: 600px;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  transition: background 0.3s ease, color 0.3s ease;
}

/* Settings Panel */
.settings-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  -webkit-app-region: drag; /* 使头部可拖拽 */
  min-height: 52px;
}

.back-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  color: var(--accent-blue);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  border-radius: 6px;
  -webkit-app-region: no-drag; /* 返回按钮可点击 */
}

.back-btn:hover {
  background: var(--bg-tertiary);
  opacity: 0.9;
}

.settings-title {
  font-size: 18px;
  font-weight: 600;
  flex: 1;
  margin-left: 4px;
  color: var(--text-primary);
}

.quit-button-header {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  color: var(--accent-red);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.2s, opacity 0.2s;
  -webkit-app-region: no-drag;
}

.quit-button-header:hover {
  background: var(--bg-tertiary);
  opacity: 0.9;
}

.quit-button-header:active {
  opacity: 0.7;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.settings-section {
  margin-bottom: 20px;
}

.section-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 10px;
  padding-left: 2px;
}

.setting-item {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.setting-item:hover {
  border-color: var(--border-color);
}

.setting-item.column {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.setting-icon {
  font-size: 18px;
}

.setting-icon-svg {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.input-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.text-input {
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  transition: all 0.2s;
}

.text-input:hover {
  border-color: var(--text-tertiary);
}

.text-input:focus {
  border-color: var(--accent-blue);
}

.app:not(.dark-mode) .text-input:focus {
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.app.dark-mode .text-input:focus {
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.15);
}

.text-input::placeholder {
  color: var(--text-tertiary);
}

.select-input {
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 100px;
}

.select-input:hover {
  border-color: var(--text-tertiary);
}

.select-input:focus {
  border-color: var(--accent-blue);
}

.app:not(.dark-mode) .select-input:focus {
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.app.dark-mode .select-input:focus {
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.15);
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 51px;
  height: 31px;
  cursor: pointer;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-tertiary);
  transition: 0.3s;
  border-radius: 31px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 27px;
  width: 27px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input:checked + .toggle-slider {
  background-color: var(--accent-green);
}

input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.setting-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-secondary);
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  border: 1px solid var(--border-color);
  margin-top: 4px;
}

.notice-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.notice-icon-svg {
  flex-shrink: 0;
  color: var(--text-secondary);
}

/* Main Panel */
.main-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  -webkit-app-region: drag; /* 使头部可拖拽 */
  min-height: 52px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.total-pnl {
  font-size: 14px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 6px;
}

.total-pnl.profit {
  background: rgba(45, 164, 78, 0.15);
  color: var(--color-profit-text);
}

.total-pnl.loss {
  background: rgba(218, 54, 51, 0.15);
  color: var(--color-loss-text);
}

.total-pnl.neutral {
  background: rgba(125, 133, 144, 0.15);
  color: var(--color-neutral-text);
}

.header-actions {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag; /* 按钮区域不可拖拽，保持可点击 */
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  -webkit-app-region: no-drag; /* 按钮可点击 */
}

.action-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
  border-color: var(--text-tertiary);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-btn {
  background-color: var(--accent-green);
  color: white;
  border-color: var(--accent-green);
}

.save-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.rotating {
  display: inline-block;
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Error Message */
.error-message {
  margin: 12px 16px;
  padding: 12px 14px;
  background: rgba(218, 54, 51, 0.1);
  color: var(--color-loss-text);
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.6;
  border: 1px solid rgba(218, 54, 51, 0.2);
}

/* Edit Mode Hint */
.edit-mode-hint {
  margin: 12px 16px;
  padding: 12px 14px;
  background: rgba(0, 122, 255, 0.1);
  color: var(--accent-blue);
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.6;
  border: 1px solid rgba(0, 122, 255, 0.2);
  display: flex;
  align-items: center;
  gap: 8px;
}

.app.dark-mode .edit-mode-hint {
  background: rgba(10, 132, 255, 0.15);
  border-color: rgba(10, 132, 255, 0.25);
}

.hint-icon {
  flex-shrink: 0;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 32px;
  text-align: center;
}

.empty-icon {
  font-size: 52px;
  margin-bottom: 18px;
  opacity: 0.8;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.empty-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.5;
}

.primary-button {
  padding: 11px 24px;
  background: var(--accent-blue);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.app:not(.dark-mode) .primary-button {
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.2);
}

.app.dark-mode .primary-button {
  box-shadow: 0 2px 8px rgba(10, 132, 255, 0.25);
}

.primary-button:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.app:not(.dark-mode) .primary-button:hover {
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}

.app.dark-mode .primary-button:hover {
  box-shadow: 0 4px 12px rgba(10, 132, 255, 0.35);
}

.primary-button:active {
  transform: translateY(0);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 32px;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 18px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

/* Positions List */
.positions-list {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}

/* Edit Mode Indicator */
.app:has(.main-header .save-btn) .positions-list {
  background: var(--bg-secondary);
}

.position-card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--border-color);
  border-left: 3px solid transparent;
  transition: all 0.2s;
  position: relative;
}

/* Edit Mode Card */
.position-card.edit-mode-card {
  padding: 0;
  border-left-width: 1px;
  min-height: auto;
}

.edit-mode-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
}

.edit-controls {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.edit-control-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.edit-control-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.edit-control-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.edit-control-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.edit-symbol-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.edit-symbol-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.edit-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.edit-tag.long {
  background: rgba(45, 164, 78, 0.15);
  color: var(--color-profit-text);
}

.edit-tag.short {
  background: rgba(218, 54, 51, 0.15);
  color: var(--color-loss-text);
}

.position-card:last-child {
  margin-bottom: 0;
}

/* 盈利状态样式 */
.position-card.is-profit {
  border: 1px solid var(--color-profit-border);
  border-left: 3px solid var(--color-profit);
  box-shadow: inset 4px 0 15px -4px var(--color-profit-glow);
}

/* 亏损状态样式 */
.position-card.is-loss {
  border: 1px solid var(--color-loss-border);
  border-left: 3px solid var(--color-loss);
  box-shadow: inset 4px 0 15px -4px var(--color-loss-glow);
}

/* 持平状态样式 */
.position-card.is-neutral {
  border: 1px solid var(--color-neutral-border);
  border-left: 3px solid var(--color-neutral);
  box-shadow: inset 4px 0 15px -4px var(--color-neutral-glow);
}

/* 卡片头部样式 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.symbol-info {
  display: flex;
  align-items: center;
  gap: 8px;
}


.symbol-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

/* 标签通用样式 */
.tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.tag-leverage {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.tag-side {
  text-transform: uppercase;
}

.tag-side.long {
  background: rgba(45, 164, 78, 0.15);
  color: var(--color-profit-text);
}

.tag-side.short {
  background: rgba(218, 54, 51, 0.15);
  color: var(--color-loss-text);
}

/* 盈亏信息 */
.pnl-info {
  text-align: right;
}

.pnl-amount {
  font-size: 16px;
  font-weight: 700;
  display: block;
  margin-bottom: 2px;
}

.pnl-percent {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.9;
}

/* 颜色辅助类 */
.text-green {
  color: var(--color-profit-text);
}

.text-red {
  color: var(--color-loss-text);
}

.text-gray {
  color: var(--color-neutral-text);
}

/* 卡片数据网格 */
.card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr;
  gap: 8px;
}

.data-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.data-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 400;
}

.data-value {
  font-size: 14px;
  color: var(--text-primary);
  font-family: 'Roboto Mono', 'SF Mono', 'Monaco', 'Courier New', monospace;
  font-weight: 500;
}

.unit {
  font-size: 10px;
  color: var(--text-secondary);
  margin-left: 2px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

/* Modal Dialog */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-dialog {
  background: var(--bg-primary);
  border-radius: 14px;
  width: 320px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.modal-header {
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-body {
  padding: 20px;
}

.modal-body p {
  margin: 0;
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  gap: 10px;
  padding: 14px 20px 18px;
  border-top: 1px solid var(--border-color);
}

.modal-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.modal-btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.modal-btn-cancel:hover {
  background: var(--bg-tertiary);
}

.modal-btn-confirm {
  background: var(--accent-red);
  color: white;
}

.modal-btn-confirm:hover {
  opacity: 0.9;
}

.modal-btn:active {
  transform: scale(0.98);
}
</style>
