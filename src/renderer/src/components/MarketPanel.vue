<script setup lang="ts">
import { ArrowLeft, RefreshCw } from 'lucide-vue-next';
import type { MarketSnapshot } from '../../../main/types/market';
import { amount } from '../utils/format';
defineProps<{snapshot: MarketSnapshot | null; loading: boolean; error: string}>();
defineEmits<{close: []; refresh: []}>();
const pct = (value: number | null | undefined) => value == null ? '不可用' : `${(value*100).toFixed(2)}%`;
const date = (value: number | null | undefined) => value ? new Date(value).toLocaleString('zh-CN') : '不可用';
</script>
<template>
  <section class="screen" aria-labelledby="market-title">
    <header class="screen-header"><button class="icon-button" aria-label="返回持仓" @click="$emit('close')"><ArrowLeft :size="19" /></button><h1 id="market-title" tabindex="-1">公共市场 · 研究观察</h1></header>
    <div class="screen-body health-body" tabindex="0" aria-label="公共市场研究内容" :aria-busy="loading">
      <p class="helper">Binance USDT永续合约范围。按需读取公共行情，不需要交易所密钥；不向行情接口发送数量、权益或账户标识。</p>
      <p v-if="loading" role="status">正在获取公共市场背景…</p><p v-if="error" role="alert">{{ error }}</p>
      <template v-if="snapshot">
        <p class="helper">{{ snapshot.source }} · 获取 {{ date(snapshot.fetchedAt) }} · {{ snapshot.status === 'available' ? '数据齐全' : snapshot.status === 'partial' ? '部分缺失' : '不可用' }}</p>
        <section v-if="snapshot.breadth" class="analysis-section"><h2>平台合约市场宽度 · 滚动24h</h2>
          <dl class="fact-grid"><div><dt>有有效行情 / 合格合约</dt><dd>{{ snapshot.breadth.pricedContracts }} / {{ snapshot.breadth.eligibleContracts }}</dd></div><div><dt>涨 / 跌 / 平</dt><dd>{{ snapshot.breadth.rising }} / {{ snapshot.breadth.falling }} / {{ snapshot.breadth.flat }}</dd></div><div><dt>涨跌中位数</dt><dd>{{ pct(snapshot.breadth.medianChange24h) }}</dd></div><div><dt>成交额 · USDT</dt><dd>{{ amount(snapshot.breadth.quoteVolume24h,0) }}</dd></div></dl>
        </section>
        <details class="analysis-method" open><summary>成交活跃观察 · 24h成交额前5</summary><ul><li v-for="row in snapshot.active" :key="row.symbol"><strong>{{ row.symbol }}</strong> · {{ pct(row.change24h) }}<br />{{ amount(row.quoteVolume24h,0) }} USDT · 行情 {{ date(row.exchangeTimestamp) }}</li></ul><p class="helper">成交额排序便于研究，不是盘口深度或可成交价格承诺。</p></details>
        <details class="analysis-method"><summary>新上市观察 · 最近30天，最多5个</summary><p class="helper">仅按平台合约上线时间排序。仍需核对代币解锁、估值、团队和需求；未提供这些资料，不能判断早期价值。</p><p v-if="!snapshot.recentListings.length">本次没有符合条件且有有效行情的记录。</p><ul><li v-for="row in snapshot.recentListings" :key="row.symbol"><strong>{{ row.symbol }}</strong> · {{ pct(row.change24h) }}<br />合约上线 {{ date(row.onboardAt) }}<br />24h成交额 {{ amount(row.quoteVolume24h,0) }} USDT</li></ul></details>
        <details v-for="asset in snapshot.assets" :key="asset.symbol" class="analysis-method"><summary>{{ asset.symbol }} · 资金费 / OI / 价格历史</summary>
          <p>标记价 {{ amount(asset.mark?.price,6) }} USDT · 时间 {{ date(asset.mark?.exchangeTimestamp) }}</p>
          <p>资金费参考 {{ pct(asset.mark?.lastFundingRate) }} · 下次时间 {{ date(asset.mark?.nextFundingAt) }}</p>
          <p>最近实际结算 {{ pct(asset.funding?.lastSettledRate) }} · {{ date(asset.funding?.lastSettledAt) }}</p>
          <p>间隔 {{ asset.funding?.intervalHours ?? '不可用' }} 小时（{{ asset.funding?.intervalBasis === 'announced' ? '平台公告字段' : asset.funding?.intervalBasis === 'observed' ? '最近历史观测，不保证下次' : '未知' }}）</p>
          <p>未平仓量 {{ amount(asset.openInterest?.baseQuantity,4) }} {{ asset.baseAsset }} · {{ date(asset.openInterest?.exchangeTimestamp) }}</p>
          <template v-if="asset.history"><p>已收盘1h价格 · {{ asset.history.samples }}条<br />{{ date(asset.history.start) }} — {{ date(asset.history.end) }}</p><p>窗口涨跌 {{ pct(asset.history.priceChange) }} · 收盘价最大回撤 {{ pct(asset.history.maxDrawdown) }} · 标的价格年化波动率 {{ pct(asset.history.annualizedPriceVolatility) }}</p></template>
          <p v-for="gap in asset.gaps" :key="gap" class="helper">{{ gap }}</p>
        </details>
        <p v-if="snapshot.unavailableSymbols.length" class="helper">不在本数据源支持范围：{{ snapshot.unavailableSymbols.join('、') }}</p>
        <details class="analysis-method"><summary>数据边界与原始来源</summary><ul><li v-for="note in snapshot.notes" :key="note">{{ note }}</li></ul><ul><li v-for="source in snapshot.sources" :key="source"><code class="market-source">{{ source }}</code></li></ul></details>
      </template>
      <p v-else-if="!loading">暂无市场快照。网络或区域限制可能使公共接口不可用。</p>
    </div>
    <footer class="health-footer"><p class="helper">仅供研究，不下单或资金转移<br />按需刷新，60秒内复用原时间快照</p><button class="button primary compact-button" :disabled="loading" @click="$emit('refresh')"><RefreshCw :size="14" :class="{spinning:loading}" />刷新研究</button></footer>
  </section>
</template>
