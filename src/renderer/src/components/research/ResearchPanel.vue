<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { ArrowDown, ArrowUp, ArrowUpRight, LayoutGrid, List, RefreshCw, Search, Star } from 'lucide-vue-next';
import type { ResearchModel } from '../../composables/useResearch';
import type { ResearchEvent } from '../../../../main/types/research';
import AppTextInput from '../ui/AppTextInput.vue';
import EvidencePanel from './EvidencePanel.vue';
import { compact, percent, sign, time } from './format';
const props = defineProps<{ model: ResearchModel; reversed: boolean }>();
const filter = ref<'all' | 'focus' | 'watched'>('all');
const display = ref<'list' | 'matrix'>('list');
const query = ref('');
const rows = computed(() => (props.model.snapshot?.events || []).filter(e =>
  (!query.value || `${e.symbol} ${e.title}`.toLowerCase().includes(query.value.toLowerCase())) &&
  (filter.value !== 'focus' || e.deepResearchEligible) &&
  (filter.value !== 'watched' || props.model.ledger?.watchedSymbols.includes(e.symbol))));
const filters = [{ id: 'all' as const, label: '全部' }, { id: 'focus' as const, label: '待查证' }, { id: 'watched' as const, label: '已关注' }];
const change = (e: ResearchEvent) => e.facts.find(f => f.unit === 'percent')?.value;
const turnover = (e: ResearchEvent) => e.facts.find(f => f.unit === 'USDT' && /成交|volume|turnover/i.test(`${f.id} ${f.label}`))?.value;
const direction = (e: ResearchEvent) => ({ long: '多头线索', short: '空头线索', neutral: '中性观察' }[e.direction]);
const coverage = computed(() => props.model.snapshot?.status === 'unavailable' ? undefined : props.model.snapshot?.breadth);
async function navigate(event: KeyboardEvent, index: number) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.value.length - 1 : Math.min(rows.value.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)));
  if (rows.value[next]) { void props.model.select(rows.value[next]); await nextTick(); document.querySelector<HTMLElement>(`[data-event-row="${next}"]`)?.focus(); }
}
</script>
<template>
  <main class="research-page" aria-labelledby="research-heading">
    <div class="workspace-heading"><div><p class="eyebrow">BINANCE · USDT 永续</p><h1 id="research-heading">值得关注的变化</h1></div><button class="button subtle" :disabled="model.loading" @click="model.refresh"><RefreshCw :size="15" :class="{ spinning: model.loading }" />{{ model.loading ? '正在扫描' : '刷新扫描' }}</button></div>
    <div class="market-context" aria-label="市场扫描概览">
      <div class="context-breadth"><span class="context-label">24 小时市场温度</span><div class="breadth-line"><div class="breadth-track" aria-hidden="true"><i class="up" :style="{ width: `${coverage?.priced ? coverage.rising / coverage.priced * 100 : 0}%` }"/><i class="down" :style="{ width: `${coverage?.priced ? coverage.falling / coverage.priced * 100 : 0}%` }"/></div><span class="numeric"><ArrowUp :size="12"/>{{ coverage?.rising ?? '—' }} <ArrowDown :size="12"/>{{ coverage?.falling ?? '—' }}</span></div></div>
      <div><span class="context-label">异常事件</span><strong class="numeric">{{ model.snapshot?.status === 'unavailable' ? '—' : model.snapshot?.events.length ?? '—' }}<small> 项待复核</small></strong></div>
      <div><span class="context-label">扫描覆盖</span><strong class="numeric">{{ coverage?.priced ?? '—' }}<small> / {{ coverage?.eligible ?? '—' }} 合约</small></strong></div>
      <div><span class="context-label">数据状态</span><strong class="context-status">{{ model.stale ? '快照已过期' : model.snapshot?.status === 'available' ? '数据可用' : model.snapshot?.status === 'partial' ? '部分数据缺失' : '等待数据' }}</strong><small>{{ time(model.snapshot?.timestamps.fetchedAt) }}</small></div>
    </div>
    <p v-if="model.error" class="research-error" role="alert">{{ model.error }}</p>
    <div class="research-columns">
      <section class="event-queue" aria-label="研究事件队列">
        <div class="queue-toolbar"><div class="segmented" aria-label="候选筛选"><button v-for="item in filters" :key="item.id" :aria-pressed="filter === item.id" @click="filter = item.id">{{ item.label }}</button></div><div class="segmented compact-segment" aria-label="展示方式"><button :aria-pressed="display === 'list'" aria-label="列表视图" @click="display = 'list'"><List :size="16" /></button><button :aria-pressed="display === 'matrix'" aria-label="异常矩阵视图" @click="display = 'matrix'"><LayoutGrid :size="15" /></button></div></div>
        <label class="research-search"><Search :size="15"/><AppTextInput v-model="query" aria-label="搜索研究币种或事件" placeholder="搜索币种或变化" /></label>
        <div v-if="model.loading && !model.snapshot" class="research-empty" role="status"><Search :size="26"/><h2>正在检查公开市场</h2><p>读取 Binance 合约范围、价格与资金费。</p></div>
        <div v-else-if="!rows.length" class="research-empty" role="status"><Search :size="26"/><h2>{{ model.snapshot && model.snapshot.status !== 'unavailable' ? '没有符合条件的事件' : '尚未取得市场快照' }}</h2><p>{{ filter === 'watched' ? '在右侧关注币种，下一次扫描仍可追踪。' : '没有信号也是有效结果。调整筛选或刷新公开数据。' }}</p></div>
        <template v-else>
          <div v-if="display === 'list'" class="queue-column-labels"><span>币种 / 变化依据</span><span>24h 涨跌</span><span>状态</span></div>
          <div class="event-list" :class="{ 'event-matrix': display === 'matrix' }">
            <button v-for="(event, index) in rows" :key="event.id" class="event-row" :class="{ selected: model.selectedId === event.id }" :data-event-row="index" :aria-pressed="model.selectedId === event.id" @click="model.select(event)" @keydown="navigate($event, index)">
              <div class="event-main"><span class="coin-monogram" aria-hidden="true">{{ event.baseAsset.slice(0, 2) }}</span><div><strong>{{ event.baseAsset }}<Star v-if="model.ledger?.watchedSymbols.includes(event.symbol)" :size="11" class="watched-star" /></strong><span class="event-title">{{ event.title }}</span><small>{{ display === 'matrix' ? direction(event) : event.reason }}</small></div></div>
              <div class="event-change numeric" :class="sign(change(event))">{{ percent(change(event)) }}<small v-if="display === 'matrix'">24h 涨跌 · 成交 {{ compact(turnover(event)) }} USDT</small></div>
              <span class="event-status"><i :class="event.deepResearchEligible ? 'candidate' : ''"/>{{ event.deepResearchEligible ? '待查证' : '观察' }}<ArrowUpRight :size="13" /></span>
            </button>
          </div>
        </template>
        <footer class="queue-legend"><span>{{ reversed ? '红涨绿跌' : '绿涨红跌' }} · — 缺失数据</span><span>↑ ↓ 切换 · 不自动跳转排序</span></footer>
        <details v-if="model.snapshot" class="scan-disclosure"><summary>本次如何进入研究视野</summary><p>{{ model.snapshot.coverage.scope }}</p><p>有效成交合约 {{ model.snapshot.coverage.tickerValid }}；成交额门槛 {{ compact(model.snapshot.coverage.turnoverFloorUSDT) }} USDT；深度查证预算 {{ model.snapshot.coverage.deepResearchBudget }} 个。优先级是规则分流，不是胜率。</p><p v-for="gap in model.snapshot.gaps" :key="gap">{{ gap }}</p></details>
      </section>
      <EvidencePanel :model="model" />
    </div>
  </main>
</template>
