<script setup lang="ts">
import { computed } from 'vue';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-vue-next';
import type { HealthScore } from '../types';
import { amount } from '../utils/format';
const props = defineProps<{ score: HealthScore; provider: string; time: Date | null; analyzing: boolean; hidden: boolean }>();
defineEmits<{ close: []; analyze: [] }>();
const facts = computed(() => props.score.facts);
const ratio = (v: number | null, unit = '×') => v === null ? '不可计算' : `${(v * (unit === '%' ? 100 : 1)).toFixed(2)}${unit}`;
</script>
<template>
  <section class="screen health-screen" aria-labelledby="health-title">
    <header class="screen-header"><button class="icon-button" aria-label="返回持仓" @click="$emit('close')"><ArrowLeft :size="19" /></button><h1 id="health-title" tabindex="-1">AI 持仓分析</h1><span class="tag header-end">快照分析</span></header>
    <div class="screen-body health-body" tabindex="0" aria-label="持仓分析内容">
      <div v-if="hidden" class="empty-state"><h2>分析内容已隐藏</h2><p>关闭“隐藏金额”后可查看分析，避免泄露账户信息。</p></div>
      <template v-else>
        <div class="analysis-kicker"><span class="connection-dot" />本地计算 · 可复核事实</div>
        <dl v-if="facts" class="fact-grid">
          <div><dt>总名义价值 · USDT</dt><dd>{{ amount(facts.grossNotional) }}</dd></div>
          <div><dt>名义价值 / 合约权益</dt><dd>{{ ratio(facts.grossToEquity) }}</dd></div>
          <div><dt>最大币种集中度 · {{ facts.largestAsset }}</dt><dd>{{ ratio(facts.largestAssetShare, '%') }}</dd></div>
          <div><dt>各仓不利 5% · 损失情景</dt><dd class="negative">−{{ amount(facts.adverseMove5Percent) }}</dd></div>
        </dl>
        <p class="helper">集中度按名义价值合并同币种多空仓。压力情景未计费用，不代表损失概率。</p>
        <section class="analysis-section"><h2>AI 解读</h2><p>{{ score.summary }}</p></section>
        <section v-if="score.warnings?.length" class="analysis-warning"><h2><AlertTriangle :size="16" />需要关注</h2><ul><li v-for="(warning,index) in score.warnings" :key="index">{{ warning }}</li></ul></section>
        <section v-if="score.suggestions?.length" class="analysis-section"><h2>建议复核</h2><ul><li v-for="(suggestion,index) in score.suggestions" :key="index">{{ suggestion }}</li></ul></section>
        <details class="analysis-method"><summary>计算口径与数据边界</summary><ul><li v-for="limit in facts?.limitations" :key="limit">{{ limit }}</li></ul><p>版本 {{ facts?.version }} · 快照 {{ score.snapshotId }}</p><p>模型 {{ score.model }}</p></details>
      </template>
    </div>
    <footer class="health-footer"><div class="helper">{{ provider }}<span v-if="time"> · {{ time.toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' }) }}</span><br />AI 解读不构成投资建议</div><button class="button primary compact-button" :disabled="analyzing" @click="$emit('analyze')"><RefreshCw :size="14" :class="{spinning:analyzing}" />{{ analyzing ? '分析中…' : '重新分析' }}</button></footer>
  </section>
</template>
