<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Bell, Check, ExternalLink, SearchCheck, Sparkles, Star } from 'lucide-vue-next';
import type { ResearchModel } from '../../composables/useResearch';
import type { ResearchAlertInput } from '../../../../main/types/research-ledger';
import AlertEditor from './AlertEditor.vue';
import { compact, factValue, number, percent, sign, time } from './format';
const props = defineProps<{ model: ResearchModel }>();
const alertOpen = ref(false);
const watched = computed(() => !!props.model.selected && !!props.model.ledger?.watchedSymbols.includes(props.model.selected.symbol));
const alerts = computed(() => props.model.ledger?.alerts.filter(a => a.symbol === props.model.selected?.symbol) || []);
const facts = computed(() => props.model.evidence?.facts || props.model.selected?.facts || []);
const gaps = computed(() => [...new Set([...(props.model.selected?.gaps || []), ...(props.model.evidence?.gaps || []), ...(props.model.analysis?.gaps || [])])]);
const expired = computed(() => !!props.model.evidence && props.model.now >= props.model.evidence.expiresAt);
const counterFacts = computed(() => props.model.analysis?.facts.filter(f => props.model.analysis?.counterFactIds.includes(f.id)) || []);
watch(() => props.model.selected?.id, () => { alertOpen.value = false; });
async function follow() { const symbol = props.model.selected?.symbol; if (symbol && props.model.api.setResearchWatch) await props.model.mutate(() => props.model.api.setResearchWatch!(symbol, !watched.value)); }
async function saveAlert(input: ResearchAlertInput) { if (!props.model.api.createResearchAlert) return; await props.model.mutate(() => props.model.api.createResearchAlert!(input)); if (!props.model.actionError) alertOpen.value = false; }
function source(url: string) { if (/^https:\/\/(?:fapi\.binance\.com|developers\.binance\.com)\//.test(url)) void window.electronAPI?.openExternal(url); }
</script>
<template>
  <aside class="evidence-pane" aria-label="所选事件证据">
    <div v-if="!model.selected" class="research-empty"><SearchCheck :size="30"/><h2>证据与事件，一起看</h2><p>选择一个候选，查看来源、流动性与待满足条件。</p></div>
    <template v-else>
      <header class="evidence-header"><div><span class="eyebrow">{{ model.selected.symbol }} · 只读研究</span><h2>{{ model.selected.title }}</h2></div><span class="status-pill">{{ model.stale || expired ? '已过期' : '待复核' }}</span></header>
      <div class="evidence-scroll">
        <p class="evidence-summary">{{ model.selected.reason }}</p>
        <p v-if="model.evidenceError" class="research-error" role="alert">{{ model.evidenceError }} <button class="text-button" @click="model.select(model.selected)">重试</button></p>
        <section class="evidence-section"><h3>关键证据 <span>{{ model.evidenceLoading ? '正在核对…' : time(model.evidence?.fetchedAt || model.selected.detectedAt) }}</span></h3><dl class="evidence-values"><div><dt>价格 · 近 1h</dt><dd :class="sign(model.evidence?.changes.price1hPercent)">{{ percent(model.evidence?.changes.price1hPercent) }}</dd></div><div><dt>未平仓量 · 近 1h</dt><dd :class="sign(model.evidence?.changes.openInterest1hPercent)">{{ percent(model.evidence?.changes.openInterest1hPercent) }}</dd></div><div><dt>已结算资金费率</dt><dd>{{ model.evidence?.changes.settledFundingRate == null ? '—' : percent(model.evidence.changes.settledFundingRate * 100) }}</dd></div></dl></section>
        <section class="evidence-section"><h3>流动性检查 <span>盘口快照</span></h3><dl class="evidence-values"><div><dt>买卖价差</dt><dd>{{ number(model.evidence?.liquidity.spreadBps) }} <small>bps</small></dd></div><div><dt>{{ model.evidence?.liquidity.bidBandCovered ? '买盘 · 距中间价 1%' : '已见买盘 · 1% 区间下界' }}</dt><dd>{{ compact(model.evidence?.liquidity.bidDepth1pctUSDT) }} <small>USDT</small></dd></div><div><dt>{{ model.evidence?.liquidity.askBandCovered ? '卖盘 · 距中间价 1%' : '已见卖盘 · 1% 区间下界' }}</dt><dd>{{ compact(model.evidence?.liquidity.askDepth1pctUSDT) }} <small>USDT</small></dd></div><div><dt>假设买入 1,000 USDT 冲击</dt><dd>{{ number(model.evidence?.liquidity.buyImpactBps) }} <small>bps</small></dd></div><div><dt>假设卖出 1,000 USDT 冲击</dt><dd>{{ number(model.evidence?.liquidity.sellImpactBps) }} <small>bps</small></dd></div></dl><p class="helper">盘口不等于可成交保证；仅当前深度，无费用与延迟估算。</p></section>
        <section class="evidence-section ai-section"><h3><Sparkles :size="14"/> AI 查证 <span>按需运行</span></h3><template v-if="model.analysis"><p>{{ model.analysis.summary }}</p><p v-if="model.now >= model.analysis.expiresAt" class="research-error">本次 AI 查证已过期，请刷新后重新查证。</p><span class="status-pill">{{ {observation:'暂不判断','conditional-long':'有条件多头假设','conditional-short':'有条件空头假设'}[model.analysis.status] }}</span><p class="helper">{{ model.analysis.provider }} · {{ model.analysis.model }} · {{ time(model.analysis.analyzedAt) }}</p><details><summary>查证过程 · {{ model.analysis.modelCalls }} 次模型调用</summary><p v-for="trace in model.analysis.toolTrace" :key="trace.tool">{{ trace.tool }} · {{ trace.status }} · {{ trace.factIds.length }} 条事实</p><p class="helper">实际用量与费用：未知</p></details></template><p v-else-if="model.outdatedAnalysis" class="muted">上次 AI 查证已过期或证据已更新，请基于当前快照重新查证。</p><p v-else class="muted">只发送本次公共市场证据。AI 可提出待验证假设，也可以不作判断。</p><button class="button subtle" :disabled="!!model.aiBusy || model.stale || expired || !model.selected.deepResearchEligible || !model.api.analyzeResearch" @click="model.analyze"><Sparkles :size="14"/>{{ model.aiBusy === model.selected.id ? '正在查证…' : model.analysis ? '重新查证' : 'AI 查证 · 最多两次调用' }}</button></section>
        <section class="evidence-section"><h3>可能推翻判断</h3><ul v-if="counterFacts.length" class="evidence-bullets"><li v-for="fact in counterFacts" :key="fact.id">{{ fact.label }} · {{ factValue(fact) }}</li></ul><p v-else class="muted">尚无经过查证的反证结论，不能据此认定信号有效。</p></section>
        <section class="evidence-section"><h3>等待条件</h3><ul v-if="model.evidence?.conditions.length" class="condition-list"><li v-for="condition in model.evidence.conditions" :key="condition.id"><Check v-if="condition.state === 'met'" :size="14"/><span v-else class="condition-dot"/><span>{{ condition.label }}</span><small>{{ {met:'已满足','not-met':'未满足',unknown:'未知'}[condition.state] }}</small></li></ul><p v-else class="muted">暂无可验证条件。</p></section>
        <details class="evidence-section source-details"><summary>原始依据 · {{ facts.length }} 条</summary><div v-for="fact in facts" :key="fact.id" class="source-fact"><strong>{{ fact.label }}</strong><span class="numeric">{{ factValue(fact) }}</span><small>{{ fact.window }} · {{ time(fact.observedAt) }}</small><button class="text-button" @click="source(fact.source)">Binance 原始来源<ExternalLink :size="11"/></button></div></details>
        <details v-if="gaps.length" class="evidence-section source-details"><summary>数据缺口 · {{ gaps.length }}</summary><ul class="evidence-bullets"><li v-for="gap in gaps" :key="gap">{{ gap }}</li></ul></details>
        <div v-for="alert in alerts" :key="alert.id" class="saved-alert"><Bell :size="13"/><span>{{ alert.metric }} {{ alert.operator === 'above' ? '↑' : '↓' }} {{ alert.threshold }} · {{ alert.status === 'armed' ? '等待穿越' : '已触发' }}</span><button class="text-button" :disabled="model.actionBusy" @click="model.mutate(() => model.api.removeResearchAlert!(alert.id))">移除</button></div>
      </div>
      <p v-if="model.actionError" class="research-error" role="alert">{{ model.actionError }}</p>
      <footer class="evidence-actions"><button class="button subtle" :aria-pressed="watched" :disabled="model.actionBusy || !model.api.setResearchWatch" @click="follow"><Star :size="15" :fill="watched ? 'currentColor' : 'none'"/>{{ watched ? '已关注' : '关注' }}</button><button class="button subtle" :disabled="!model.api.createResearchAlert" @click="alertOpen = true"><Bell :size="15"/>条件提醒</button></footer>
      <AlertEditor v-if="alertOpen" :symbol="model.selected.symbol" :busy="model.actionBusy" @close="alertOpen = false" @save="saveAlert" />
    </template>
  </aside>
</template>
