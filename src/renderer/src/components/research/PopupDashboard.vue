<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ArrowUpRight, Bell, CircleAlert, Eye, EyeOff, RefreshCw, Settings } from 'lucide-vue-next';
import type { AppModel } from '../../composables/useTradingApp';
import type { ResearchAPI } from '../../composables/useResearch';
import { amount, signed, symbol } from '../../utils/format';
import { number, percent, sign, time } from './format';
import brandMark from '../../../../../assets/brand/mark.svg';
const props = defineProps<{ model: AppModel; unread: number }>();
const api = window.electronAPI as typeof window.electronAPI & Partial<ResearchAPI>;
const emit = defineEmits<{ settings: []; positions: []; research: []; notifications: [] }>();
const preferences = computed(() => props.model.preferences as typeof props.model.preferences & { watchlistSymbols?: string[]; colorScheme?: string });
const watchlist = computed(() => preferences.value.watchlistSymbols || ['BTCUSDT', 'ETHUSDT']);
interface Quote { symbol: string; lastPrice: number; change24hPercent: number; observedAt: number; fetchedAt: number }
const market = ref<Quote[]>([]);
const marketError = ref(false);
const marketNow = ref(Date.now());
const marketStale = computed(() => market.value.some(q => marketNow.value - q.observedAt > 180000));
let marketTimer: ReturnType<typeof setInterval> | undefined;
const marketTime = computed(() => market.value.length ? Math.min(...market.value.map(q => q.fetchedAt)) : null);
const marketLoading = ref(false);
const positions = computed(() => props.model.sortedPositions.filter(p => p.exchange === 'binance'));
const account = computed(() => props.model.accounts.find(a => a.exchange === 'binance'));
const pnl = computed(() => account.value?.totalUnrealizedProfit);
const stale = computed(() => props.model.stale || props.model.exchangeErrors.some(e => e.exchange === 'binance'));
const references = computed(() => watchlist.value.map(s => { const row = market.value.find(r => r.symbol === s); return { symbol: s, price: row?.lastPrice, change: row?.change24hPercent }; }));
async function refreshMarket() {
  const quoteAPI = api as typeof api & { getWatchlistMarket?: () => Promise<{success: boolean; data?: Quote[]}> };
  if (marketLoading.value || !quoteAPI?.getWatchlistMarket) return;
  marketLoading.value = true;
  try { const r = await quoteAPI.getWatchlistMarket(); if (r.success && r.data) { market.value = r.data; marketError.value = false; } else marketError.value = true; }
  catch { marketError.value = true; }
  finally { marketLoading.value = false; }
}
onMounted(() => { void refreshMarket(); marketTimer = setInterval(() => { marketNow.value = Date.now(); void refreshMarket(); }, 60000); });
onUnmounted(() => { if (marketTimer) clearInterval(marketTimer); });
watch(() => watchlist.value.join(','), () => void refreshMarket());
</script>
<template>
  <section class="popup-dashboard" aria-labelledby="popup-title">
    <header class="popup-header"><div class="new-wordmark"><img :src="brandMark" alt=""/><h1 id="popup-title">PositionScope</h1></div><div class="popup-actions"><button class="icon-button notification-button" :aria-label="`通知中心${unread ? `，${unread} 条未读` : ''}`" @click="emit('notifications')"><Bell :size="17"/><span v-if="unread" class="notification-count">{{ unread }}</span></button><button class="icon-button" aria-label="设置" @click="emit('settings')"><Settings :size="18"/></button></div></header>
    <div v-if="model.storageStatus.state === 'blocked'" class="popup-warning" role="alert"><CircleAlert :size="16"/><div><strong>配置未能安全读取</strong><p>{{ model.storageStatus.message }}</p><button class="text-button" @click="model.api?.restartForStorage()">重启并重新读取</button></div></div>
    <div v-else-if="model.error || stale" class="popup-warning" role="status"><CircleAlert :size="16"/><div><strong>{{ stale ? 'Binance 连接需关注' : model.error }}</strong><details><summary>查看连接详情</summary><p v-for="item in model.exchangeErrors.filter(e => e.exchange === 'binance')" :key="item.errorCode">{{ item.errorCode }} · {{ item.suggestion }}</p><p>上次数据不会当作实时数据。空值不代表没有持仓。</p></details><button class="text-button" :disabled="model.loading" @click="model.retry">重新连接</button><button class="text-button subdued" @click="emit('settings')">检查配置</button></div></div>
    <div class="popup-summary"><div class="popup-summary-label"><span>未实现盈亏 <small>USDT</small></span><button class="icon-button small" :aria-label="model.preferences.hideAmounts ? '显示金额' : '隐藏金额'" :aria-pressed="model.preferences.hideAmounts" @click="model.preferences.hideAmounts = !model.preferences.hideAmounts; model.savePreference('hideAmounts')"><EyeOff v-if="model.preferences.hideAmounts" :size="14"/><Eye v-else :size="14"/></button></div><strong class="popup-pnl numeric" :class="model.preferences.hideAmounts ? '' : sign(pnl)">{{ model.preferences.hideAmounts ? '••••••' : pnl == null ? '—' : signed(pnl) }}</strong><div class="popup-equity"><span>合约权益 <b class="numeric">{{ model.preferences.hideAmounts ? '••••' : number(account?.totalMarginBalance) }}</b></span><span>可用 <b class="numeric">{{ model.preferences.hideAmounts ? '••••' : number(account?.availableBalance) }}</b></span><span v-if="stale" class="stale-label">上次数据</span></div></div>
    <section class="popup-holdings"><header><h2>持仓 <span>{{ model.hasCredentials && !stale ? positions.length : '—' }}</span></h2><button class="text-button" @click="emit('positions')">详情<ArrowUpRight :size="13"/></button></header><div class="compact-position-head"><span>币种 / 方向</span><span>标记价</span><span>未实现盈亏 · USDT</span></div><div class="compact-positions"><button v-for="position in positions" :key="position.positionId || position.symbol" class="compact-position" @click="emit('positions')"><span><strong>{{ symbol(position.symbol) }}</strong><small>{{ Number(position.positionAmt) > 0 ? '多' : '空' }} · {{ position.leverage ? `${position.leverage}×` : '—' }}</small></span><span class="numeric">{{ amount(position.markPrice, 4) }}</span><strong class="numeric" :class="model.preferences.hideAmounts ? '' : sign(Number(position.unRealizedProfit))">{{ model.preferences.hideAmounts ? '••••' : signed(position.unRealizedProfit) }}</strong></button><div v-if="!positions.length" class="popup-empty"><strong>{{ model.storageStatus.state === 'blocked' ? '等待解锁加密配置' : !model.ready ? '正在读取持仓…' : !model.hasCredentials ? '连接 Binance，开始只读监控' : stale ? '持仓暂不可用' : '当前没有持仓' }}</strong><button v-if="!model.hasCredentials && model.storageStatus.state !== 'blocked'" class="text-button" @click="emit('settings')">配置只读 API <ArrowUpRight :size="12"/></button></div></div></section>
    <section class="popup-references"><header><h2>市场参考 <small>24h</small></h2><button class="icon-button small" aria-label="刷新参考行情" :disabled="marketLoading" @click="refreshMarket"><RefreshCw :size="13"/></button></header><div class="reference-grid"><div v-for="row in references" :key="row.symbol" class="reference-item"><strong>{{ symbol(row.symbol) }}</strong><span class="numeric">{{ number(row.price, 2) }}</span><small class="numeric" :class="sign(row.change)">{{ percent(row.change) }}</small></div></div><p class="reference-time">Binance USDT 永续 · {{ time(marketTime) }}{{ marketError || marketStale ? ' · 上次数据，需刷新' : '' }}</p></section>
    <footer class="popup-footer"><span>{{ model.lastUpdated ? time(model.lastUpdated.getTime()) : '等待账户数据' }}{{ stale ? ' · 需刷新' : '' }}</span><button class="workspace-entry" @click="emit('research')">打开研究工作台<ArrowUpRight :size="15"/></button></footer>
  </section>
</template>
