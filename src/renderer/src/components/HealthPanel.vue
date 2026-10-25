<script setup lang="ts">
import { computed } from 'vue';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-vue-next';
import type { HealthScore } from '../types';
import { amount } from '../utils/format';
const props = defineProps<{ score: HealthScore; provider: string; time: Date | null; analyzing: boolean; hidden: boolean }>();
defineEmits<{ close: []; analyze: [] }>();
const facts = computed(() => props.score.facts);
const modeName = (v: string) => ({cross:'全仓',isolated:'逐仓',portfolio:'组合保证金','single-asset':'单资产','multi-asset':'多资产',standard:'标准账户','account-defined':'平台账户模式'}[v] || '模式未知');
const scopeName = (v: string) => ({UNIFIED:'统一账户','USD-M futures':'USDⓈ-M合约',trading_account_adjusted:'调整后交易账户',default_perps_cross_only:'默认永续DEX的全仓部分'}[v] || '口径待核对');
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
          <div><dt>名义价值 / 监控权益</dt><dd>{{ ratio(facts.grossToEquity) }}</dd></div>
          <div><dt>最大币种集中度 · {{ facts.largestAsset }}</dt><dd>{{ ratio(facts.largestAssetShare, '%') }}</dd></div>
          <div><dt>各仓不利 5% · 损失情景</dt><dd class="negative">−{{ amount(facts.adverseMove5Percent) }}</dd></div>
        </dl>
        <p class="helper">集中度按名义价值合并同币种多空仓。压力情景未计费用，不代表损失概率。</p>
        <details class="analysis-method" v-if="facts?.positions?.length"><summary>逐仓强平与保证金</summary>
          <div v-for="(p,index) in facts.positions" :key="index"><h3>{{ p.exchange }} · {{ p.symbol }} · {{ p.side === 'long' ? '多' : '空' }}</h3>
            <p>参考强平价 {{ amount(p.liquidationPrice, 6) }} · 参考距离 {{ ratio(p.liquidationDistance, '%') }}</p>
            <p>初始 / 维持保证金 {{ amount(p.initialMargin) }} / {{ amount(p.maintenanceMargin) }} {{ p.currency }}</p>
          </div>
        </details>
        <details class="analysis-method" v-if="facts?.accounts?.length"><summary>各交易所独立账户口径</summary>
          <div v-for="a in facts.accounts" :key="a.exchange"><h3>{{ a.exchange }} · {{ modeName(a.mode) }}</h3>
            <p>监控权益 {{ amount(a.equity) }} · {{ a.currency }}</p>
            <p>风险口径 {{ scopeName(a.scope) }} · 对应权益 {{ amount(a.riskEquity) }} · 维持保证金 {{ amount(a.maintenanceMargin) }}</p>
            <p v-if="a.nativeRatio">平台原生 {{ a.nativeRatio.name }} {{ ratio(a.nativeRatio.value, '%') }}（越{{ a.nativeRatio.direction === 'higher-risk' ? '高' : '低' }}风险越高；不可跨平台比较）</p>
            <p v-for="note in a.notes" :key="note" class="helper">{{ note }}</p>
          </div>
        </details>
        <details class="analysis-method" v-if="facts?.scenarios?.length"><summary>保持 / 缩减仓位的价格情景</summary>
          <p class="helper">所有资产同幅变动；仅比较剩余仓位的价格盈亏，不含已平仓盈亏、费用或中途强平，不是策略收益预测。</p>
          <table class="scenario-table"><caption>假设价格情景 · USDT等值</caption><thead><tr><th>价格变动</th><th>保持</th><th>缩减25%</th><th>缩减50%</th></tr></thead><tbody>
            <tr v-for="move in [-.2,-.1,-.05,.05,.1,.2]" :key="move"><th>{{ move*100 }}%</th><td v-for="share in [1,.75,.5]" :key="share">{{ amount(facts.scenarios.find(s => s.retainedShare === share && s.priceMove === move)?.pricePnl) }}</td></tr>
          </tbody></table>
        </details>
        <section class="analysis-section"><h2>AI 解读</h2><p>{{ score.summary }}</p></section>
        <section v-if="score.warnings?.length" class="analysis-warning"><h2><AlertTriangle :size="16" />需要关注</h2><ul><li v-for="(warning,index) in score.warnings" :key="index">{{ warning }}</li></ul></section>
        <section v-if="score.suggestions?.length" class="analysis-section"><h2>建议复核</h2><ul><li v-for="(suggestion,index) in score.suggestions" :key="index">{{ suggestion }}</li></ul></section>
        <details class="analysis-method"><summary>计算口径与数据边界</summary><ul><li v-for="limit in facts?.limitations" :key="limit">{{ limit }}</li></ul><p>版本 {{ facts?.version }} · 快照 {{ score.snapshotId }}</p><p>模型 {{ score.model }}</p></details>
      </template>
    </div>
    <footer class="health-footer"><div class="helper">{{ provider }}<span v-if="time"> · {{ time.toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' }) }}</span><br />AI 解读不构成投资建议</div><button class="button primary compact-button" :disabled="analyzing" @click="$emit('analyze')"><RefreshCw :size="14" :class="{spinning:analyzing}" />{{ analyzing ? '分析中…' : '重新分析' }}</button></footer>
  </section>
</template>
