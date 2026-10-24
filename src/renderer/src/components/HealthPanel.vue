<script setup lang="ts">
import { computed } from 'vue';
import { AlertTriangle, ArrowLeft, RefreshCw, Sparkles } from 'lucide-vue-next';
import type { HealthScore } from '../types';
const props = defineProps<{
  score: HealthScore;
  provider: string;
  time: Date | null;
  analyzing: boolean;
  hidden: boolean;
}>();
defineEmits<{ close: []; analyze: [] }>();
const bounded = (value: number) => Math.round(Math.max(0, Math.min(100, Number(value))));
const rating = computed(() =>
  props.score.overallScore >= 80
    ? '整体较稳健'
    : props.score.overallScore >= 60
      ? '有待关注'
      : '需重点关注'
);
const metrics = computed(() => [
  { name: '分散度', value: props.score.diversification },
  { name: '杠杆合理性', value: props.score.leverage },
  { name: '风险敞口', value: props.score.riskExposure },
  { name: '盈亏比', value: props.score.profitabilityRatio },
]);
</script>

<template>
  <section class="screen health-screen" aria-labelledby="health-title">
    <header class="screen-header">
      <button class="icon-button" aria-label="返回持仓" @click="$emit('close')">
        <ArrowLeft :size="19" />
      </button>
      <h1 id="health-title" tabindex="-1">AI 持仓分析</h1>
      <Sparkles :size="17" class="muted header-end" />
    </header>
    <div class="screen-body health-body" tabindex="0" aria-label="持仓分析内容">
      <template v-if="hidden"
        ><div class="empty-state">
          <Sparkles :size="28" />
          <h2>分析内容已隐藏</h2>
          <p>关闭“隐藏金额”后可查看分析，避免泄露账户信息。</p>
        </div></template
      >
      <template v-else>
        <div class="health-summary">
          <div class="health-score numeric">
            {{ bounded(score.overallScore) }}<small>/100</small>
          </div>
          <span class="rating-label"
            ><AlertTriangle v-if="score.overallScore < 80" :size="14" />{{ rating }}</span
          >
        </div>
        <p class="helper">AI 评估，不代表盈利概率。</p>
        <dl class="health-metrics">
          <div v-for="metric in metrics" :key="metric.name">
            <dt>{{ metric.name }}</dt>
            <dd class="numeric">{{ bounded(metric.value) }}</dd>
          </div>
        </dl>
        <section v-if="score.summary" class="analysis-section">
          <h2>总结</h2>
          <p>{{ score.summary }}</p>
        </section>
        <section
          v-if="Array.isArray(score.warnings) && score.warnings.length"
          class="analysis-warning"
        >
          <h2><AlertTriangle :size="16" />风险提示</h2>
          <ul>
            <li v-for="(warning, index) in score.warnings" :key="index">{{ warning }}</li>
          </ul>
        </section>
        <section
          v-if="Array.isArray(score.suggestions) && score.suggestions.length"
          class="analysis-section"
        >
          <h2>建议</h2>
          <ul>
            <li v-for="(suggestion, index) in score.suggestions" :key="index">{{ suggestion }}</li>
          </ul>
        </section>
      </template>
    </div>
    <footer class="health-footer">
      <div class="helper">
        {{ provider
        }}<span v-if="time">
          · {{ time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span
        >
      </div>
      <button class="button primary compact-button" :disabled="analyzing" @click="$emit('analyze')">
        <RefreshCw :size="14" :class="{ spinning: analyzing }" />{{
          analyzing ? '分析中…' : '重新分析'
        }}
      </button>
    </footer>
  </section>
</template>
