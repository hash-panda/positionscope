<template>
  <div class="container">
    <div v-if="showSettings">
      <div class="header">
        <div class="title">API 设置</div>
        <button class="settings-btn" @click="showSettings = false">返回</button>
      </div>

      <div class="settings-form">
        <div class="form-group">
          <label class="form-label">API Key</label>
          <input
            v-model="apiKey"
            type="text"
            class="form-input"
            placeholder="输入 Binance API Key"
          />
        </div>

        <div class="form-group">
          <label class="form-label">API Secret</label>
          <input
            v-model="apiSecret"
            type="password"
            class="form-input"
            placeholder="输入 Binance API Secret"
          />
        </div>

        <button class="save-btn" @click="saveSettings">保存</button>

        <div class="empty-state" style="margin-top: 12px;">
          <div style="color: #f59e0b; margin-bottom: 8px;">⚠️ 安全提示</div>
          <div>请确保 API Key 仅开启查询权限，不要开启交易权限</div>
        </div>
      </div>
    </div>

    <div v-else>
      <div class="header">
        <div class="title">
          合约持仓
          <span v-if="totalPnL !== 0"
            :class="['total-pnl', totalPnL >= 0 ? 'profit-positive' : 'profit-negative']">
            {{ totalPnL >= 0 ? '+' : '' }}{{ totalPnL.toFixed(2) }} USDT
          </span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="icon-btn" @click="fetchData" :disabled="loading" title="刷新">
            {{ loading ? '⟳' : '↻' }}
          </button>
          <button class="icon-btn" @click="showSettings = true" title="设置">⚙</button>
        </div>
      </div>

      <div v-if="error" class="error">{{ error }}</div>

      <div v-if="!hasCredentials" class="empty-state">
        <div style="margin-bottom: 12px;">📊</div>
        <div>请先配置 API Key</div>
        <button class="settings-btn" @click="showSettings = true" style="margin-top: 12px;">
          前往设置
        </button>
      </div>

      <div v-else-if="loading && !futuresPositions.length" class="loading">
        加载中...
      </div>

      <div v-else>
        <div v-if="futuresPositions.length > 0">
          <div class="position-card" v-for="position in futuresPositions" :key="position.symbol"
            :class="getPnLClass(position.unRealizedProfit)">

            <div class="card-header">
              <div class="symbol-info">
                <span class="symbol-name">{{ formatSymbol(position.symbol) }}</span>
                <span class="leverage-badge">{{ position.leverage }}x</span>
                <span class="position-side" :class="parseFloat(position.positionAmt) > 0 ? 'long' : 'short'">
                  {{ parseFloat(position.positionAmt) > 0 ? 'LONG' : 'SHORT' }}
                </span>
              </div>

              <div class="pnl-section">
                <div class="pnl-amount">
                  {{ parseFloat(position.unRealizedProfit) >= 0 ? '+' : '' }}{{ parseFloat(position.unRealizedProfit).toFixed(2) }}
                </div>
                <div class="pnl-percent">
                  {{ getPnLPercent(position) }}%
                </div>
              </div>
            </div>

            <div class="card-body">
              <div class="price-row">
                <div class="price-item">
                  <span class="label">持仓</span>
                  <span class="value">{{ parseFloat(position.entryPrice).toFixed(2) }}</span>
                </div>
                <div class="price-item">
                  <span class="label">当前</span>
                  <span class="value">{{ parseFloat(position.markPrice).toFixed(2) }}</span>
                </div>
                <div class="price-item">
                  <span class="label">数量</span>
                  <span class="value">{{ Math.abs(parseFloat(position.positionAmt)).toFixed(3) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          暂无持仓
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

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

const showSettings = ref(false);
const apiKey = ref('');
const apiSecret = ref('');
const loading = ref(false);
const error = ref('');
const hasCredentials = ref(false);
const futuresPositions = ref<FuturesPosition[]>([]);

const totalPnL = computed(() => {
  return futuresPositions.value.reduce((sum, position) => {
    return sum + parseFloat(position.unRealizedProfit);
  }, 0);
});

const formatSymbol = (symbol: string) => {
  return symbol.replace('USDT', '').replace('BUSD', '');
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

const saveSettings = async () => {
  if (!apiKey.value || !apiSecret.value) {
    error.value = '请输入 API Key 和 Secret';
    return;
  }

  if (!(window as any).electronAPI) {
    error.value = 'Electron API 未加载，请确保应用正确启动';
    return;
  }

  try {
    await (window as any).electronAPI.saveApiKeys(apiKey.value, apiSecret.value);
    hasCredentials.value = true;
    showSettings.value = false;
    error.value = '';
    fetchData();
  } catch (err: any) {
    error.value = '保存失败: ' + err.message;
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

onMounted(async () => {
  // 检查 electronAPI 是否可用
  if (!(window as any).electronAPI) {
    error.value = '请使用 Electron 启动应用（运行 pnpm dev 或 ./dev.sh）';
    return;
  }

  hasCredentials.value = await (window as any).electronAPI.hasCredentials();

  if (hasCredentials.value) {
    fetchData();
  }

  // 监听刷新事件
  (window as any).electronAPI.onRefreshData(() => {
    fetchData();
  });

  // 定时刷新（每30秒）
  setInterval(() => {
    if (hasCredentials.value && !showSettings.value) {
      fetchData();
    }
  }, 30000);
});
</script>
