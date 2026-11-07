<script setup lang="ts">
import { computed, ref } from 'vue';
import { CircleAlert, Eye, EyeOff, RefreshCw, Sparkles } from 'lucide-vue-next';
import type { AppModel } from '../../composables/useTradingApp';
import { liquidationDistance } from '../../../../main/utils/position-math';
import { positionKey } from '../../../../main/utils/position-order';
import { signed, symbol } from '../../utils/format';
import { number, sign, time } from './format';
import { providers } from '../../types';
import type { SettingsPage } from '../../types';
import ConfirmDialog from '../ConfirmDialog.vue';
import HealthPanel from '../HealthPanel.vue';
const props = defineProps<{ model: AppModel }>();
const emit = defineEmits<{ settings: [page?: SettingsPage] }>();
const selected = ref('');
const healthConsent = ref(false);
const healthOpen = ref(false);
const positions = computed(() => props.model.sortedPositions.filter(p => p.exchange === 'binance'));
const active = computed(() => positions.value.find(p => positionKey(p) === selected.value) || positions.value[0]);
const account = computed(() => props.model.accounts.find(a => a.exchange === 'binance'));
const hidden = computed(() => props.model.preferences.hideAmounts);
const mask = (value: number | null | undefined) => hidden.value ? '••••••' : number(value);
const provider = computed(() => providers.find(p => p.id === props.model.preferences.defaultProvider)?.name || props.model.preferences.defaultProvider);
async function analyzeHoldings() { healthConsent.value = false; props.model.currentView = 'overview'; const result = await props.model.analyze(); if (result === false) emit('settings', 'ai'); else if (props.model.currentView as string === 'health' && props.model.healthScore) healthOpen.value = true; }
</script>
<template>
  <main class="positions-page" aria-labelledby="positions-heading">
    <div class="workspace-heading"><div><p class="eyebrow">BINANCE · 账户只读</p><h1 id="positions-heading">我的持仓</h1></div><div class="inline-actions"><button class="button subtle" :disabled="!positions.length || model.stale || model.loading || model.analyzing" @click="healthConsent = true"><Sparkles :size="14"/>{{ model.analyzing ? '正在分析…' : '持仓分析' }}</button><button class="icon-button" :aria-label="hidden ? '显示金额' : '隐藏金额'" @click="model.preferences.hideAmounts = !hidden; model.savePreference('hideAmounts')"><EyeOff v-if="hidden" :size="17"/><Eye v-else :size="17"/></button><button class="button subtle" :disabled="model.loading || !model.hasCredentials" @click="model.retry"><RefreshCw :size="15"/>刷新</button></div></div>
    <div v-if="model.stale || model.error" class="research-error" role="status"><CircleAlert :size="15"/>连接需关注 · {{ positions.length ? '保留上次数据' : '尚未取得完整持仓' }}<button class="text-button" @click="$emit('settings')">检查配置</button></div>
    <div class="position-summary-strip"><div><span>未实现盈亏 · USDT</span><strong :class="hidden ? '' : sign(account?.totalUnrealizedProfit)">{{ hidden ? '••••••' : account?.totalUnrealizedProfit == null ? '—' : signed(account.totalUnrealizedProfit) }}</strong></div><div><span>合约权益 · USDT</span><strong>{{ mask(account?.totalMarginBalance) }}</strong></div><div><span>可用余额 · USDT</span><strong>{{ mask(account?.availableBalance) }}</strong></div><div><span>现货估值 · USDT</span><strong>{{ mask(account?.spotTotalUSDT) }}</strong></div></div>
    <div class="positions-layout"><section class="positions-table" aria-label="Binance 持仓列表"><div class="positions-table-header"><span>币种 / 方向</span><span>标记价</span><span>未实现盈亏 · USDT</span></div><button v-for="p in positions" :key="positionKey(p)" class="positions-table-row" :class="{ selected: active && positionKey(active) === positionKey(p) }" :aria-pressed="!!active && positionKey(active) === positionKey(p)" @click="selected = positionKey(p)"><span><strong>{{ symbol(p.symbol) }}</strong><small>{{ Number(p.positionAmt) > 0 ? '多' : '空' }} · {{ p.marginType === 'cross' ? '全仓' : p.marginType === 'isolated' ? '逐仓' : '保证金模式未知' }} · {{ p.leverage ? `${p.leverage}×` : '杠杆未知' }}</small></span><span class="numeric">{{ number(Number(p.markPrice), 4) }}</span><strong class="numeric" :class="hidden ? '' : sign(Number(p.unRealizedProfit))">{{ hidden ? '••••' : signed(p.unRealizedProfit) }}</strong></button><div v-if="!positions.length" class="research-empty"><h2>{{ model.hasCredentials ? model.stale ? '持仓暂不可用' : '当前没有持仓' : '连接 Binance 账户' }}</h2><p>只读 API 用于在本机读取资产与仓位。</p><button class="button subtle" @click="$emit('settings')">配置只读连接</button></div></section><aside class="position-detail" tabindex="0" aria-label="仓位详情，可滚动"><h2>仓位详情</h2><template v-if="active"><div class="selected-position-heading"><strong>{{ symbol(active.symbol) }}</strong><span>{{ Number(active.positionAmt) > 0 ? '多头' : '空头' }}</span></div><dl class="evidence-values position-facts"><div><dt>开仓价 · USDT</dt><dd>{{ number(Number(active.entryPrice), 4) }}</dd></div><div><dt>标记价 · USDT</dt><dd>{{ number(Number(active.markPrice), 4) }}</dd></div><div><dt>币数</dt><dd>{{ hidden ? '••••' : number(Math.abs(Number(active.positionAmt)), 4) }}</dd></div><div><dt>名义价值 · USDT</dt><dd>{{ mask(Math.abs(Number(active.positionAmt)) * Number(active.markPrice)) }}</dd></div><div><dt>参考强平价 · USDT</dt><dd>{{ active.liquidationPrice == null ? '—' : number(Number(active.liquidationPrice), 4) }}</dd></div><div><dt>参考强平距离</dt><dd>{{ liquidationDistance(active) == null ? '—' : number(liquidationDistance(active)! * 100) + '%' }}</dd></div><div><dt>初始保证金 · {{ active.marginCurrency || '单位未知' }}</dt><dd>{{ mask(active.initialMargin == null ? null : Number(active.initialMargin)) }}</dd></div><div><dt>维持保证金 · {{ active.marginCurrency || '单位未知' }}</dt><dd>{{ mask(active.maintenanceMargin == null ? null : Number(active.maintenanceMargin)) }}</dd></div><div v-if="active.marginType === 'isolated'"><dt>逐仓保证金余额 · USDT</dt><dd>{{ mask(active.isolatedMargin == null ? null : Number(active.isolatedMargin)) }}</dd></div><div v-if="active.marginType === 'isolated'"><dt>逐仓钱包余额 · USDT</dt><dd>{{ mask(active.isolatedWallet == null ? null : Number(active.isolatedWallet)) }}</dd></div></dl><p class="helper">Binance 快照 · {{ time(active.fetchedAt) }}</p></template><p v-else class="muted">选择持仓后查看保证金、价格和风险参考。</p><p class="helper">强平距离不是安全保证。持仓数量变化不等于成交或转账。</p></aside></div>
    <footer class="workspace-bottomline">{{ model.lastUpdated ? `更新于 ${time(model.lastUpdated.getTime())}` : '等待账户数据' }} · 私有账户数据不会进入公共市场研究</footer>
    <ConfirmDialog v-if="healthConsent" title="发送持仓风险事实进行分析？" confirm-label="确认发送并分析" @close="healthConsent = false" @confirm="analyzeHoldings"><p>将向 {{ provider }} 发送基于币种、方向、数量、入场与标记价、盈亏、保证金和账户权益计算的风险事实。</p><p>这包含私有持仓信息。不会发送 API Key 或 Secret，也不会混入公共市场研究。仅本次点击后发送。</p></ConfirmDialog>
    <div v-if="healthOpen && model.healthScore" class="holdings-analysis-overlay"><HealthPanel :score="model.healthScore" :provider="model.analysisProvider" :time="model.analysisTime" :analyzing="model.analyzing" :hidden="hidden" @close="healthOpen = false" @analyze="healthConsent = true" /></div>
  </main>
</template>
