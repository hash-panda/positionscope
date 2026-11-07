<script setup lang="ts">
import { computed, ref } from 'vue';
import { CircleAlert, Eye, EyeOff, RefreshCw, Sparkles } from 'lucide-vue-next';
import type { AppModel } from '../../composables/useTradingApp';
import { liquidationDistance } from '../../../../main/utils/position-math';
import { positionKey } from '../../../../main/utils/position-order';
import { priceText, entryPriceChange } from '../../../../main/utils/menu-format';
import { signed, symbol } from '../../utils/format';
import { number, percent, sign, time } from './format';
import { providers } from '../../types';
import type { SettingsPage } from '../../types';
import ConfirmDialog from '../ConfirmDialog.vue';
import HealthPanel from '../HealthPanel.vue';
const props = defineProps<{ model: AppModel }>();
const emit = defineEmits<{ settings: [page?: SettingsPage] }>();
const healthConsent = ref(false);
const healthOpen = ref(false);
const positions = computed(() => props.model.sortedPositions.filter(p => p.exchange === 'binance'));
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
    <section class="holdings-scroll" tabindex="0" aria-label="完整持仓表，可横向滚动">
      <table v-if="positions.length" class="holdings-table">
        <caption class="sr-only">Binance USDT 永续持仓；价格单位 USDT，缺失值显示横线。</caption>
        <thead><tr><th scope="col">币种 / 方向</th><th scope="col">标记价<small>开仓均价 · USDT</small></th><th scope="col">距成本涨跌<small>价格变化 · 非收益率</small></th><th scope="col">未实现盈亏<small>USDT</small></th><th scope="col">数量<small>名义价值 · USDT</small></th><th scope="col">参考强平价<small>强平距离</small></th><th scope="col">初始保证金<small>维持保证金</small></th><th scope="col">逐仓钱包余额<small>逐仓保证金余额 · USDT</small></th></tr></thead>
        <tbody><tr v-for="p in positions" :key="positionKey(p)" class="positions-table-row">
          <th scope="row"><strong>{{ symbol(p.symbol) }}</strong><small>{{ Number(p.positionAmt) > 0 ? '多' : '空' }} · {{ p.marginType === 'cross' ? '全仓' : p.marginType === 'isolated' ? '逐仓' : '模式未知' }} · {{ p.leverage ? `${p.leverage}×` : '杠杆未知' }}</small></th>
          <td>{{ priceText(Number(p.markPrice)) }}<small>{{ priceText(Number(p.entryPrice)) }}</small></td>
          <td :class="hidden ? '' : sign(entryPriceChange(p))">{{ hidden ? '••••••' : percent(entryPriceChange(p)) }}</td>
          <td :class="hidden ? '' : sign(Number(p.unRealizedProfit))">{{ hidden ? '••••••' : signed(p.unRealizedProfit) }}</td>
          <td>{{ hidden ? '••••••' : number(Math.abs(Number(p.positionAmt)), 6) }}<small>{{ mask(Math.abs(Number(p.positionAmt)) * Number(p.markPrice)) }}</small></td>
          <td>{{ p.liquidationPrice == null || Number(p.liquidationPrice) <= 0 ? '—' : priceText(Number(p.liquidationPrice)) }}<small>{{ liquidationDistance(p) == null ? '—' : number(liquidationDistance(p)! * 100) + '%' }}</small></td>
          <td>{{ mask(p.initialMargin == null ? null : Number(p.initialMargin)) }}<small>{{ mask(p.maintenanceMargin == null ? null : Number(p.maintenanceMargin)) }} {{ p.marginCurrency || '单位未知' }}</small></td>
          <td><span data-wallet>{{ p.marginType !== 'isolated' ? '不适用' : mask(p.isolatedWallet == null ? null : Number(p.isolatedWallet)) }}</span><small data-margin>{{ p.marginType !== 'isolated' ? '不适用' : mask(p.isolatedMargin == null ? null : Number(p.isolatedMargin)) }}</small></td>
        </tr></tbody>
      </table>
      <div v-else class="research-empty"><h2>{{ model.hasCredentials ? model.stale ? '持仓暂不可用' : '当前没有持仓' : '连接 Binance 账户' }}</h2><p>只读 API 用于在本机读取资产与仓位。</p><button class="button subtle" @click="$emit('settings')">配置只读连接</button></div>
    </section>
    <p class="holdings-note">距成本 = 标记价 ÷ 开仓均价 − 1，多空同口径；未计费用与资金费。参考强平距离不是安全保证。</p>
    <footer class="workspace-bottomline">{{ model.lastUpdated ? `更新于 ${time(model.lastUpdated.getTime())}` : '等待账户数据' }} · 私有账户数据不会进入公共市场研究</footer>
    <ConfirmDialog v-if="healthConsent" title="发送持仓风险事实进行分析？" confirm-label="确认发送并分析" @close="healthConsent = false" @confirm="analyzeHoldings"><p>将向 {{ provider }} 发送基于币种、方向、数量、入场与标记价、盈亏、保证金和账户权益计算的风险事实。</p><p>这包含私有持仓信息。不会发送 API Key 或 Secret，也不会混入公共市场研究。仅本次点击后发送。</p></ConfirmDialog>
    <div v-if="healthOpen && model.healthScore" class="holdings-analysis-overlay"><HealthPanel :score="model.healthScore" :provider="model.analysisProvider" :time="model.analysisTime" :analyzing="model.analyzing" :hidden="hidden" @close="healthOpen = false" @analyze="healthConsent = true" /></div>
  </main>
</template>
