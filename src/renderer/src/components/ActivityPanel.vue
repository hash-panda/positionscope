<script setup lang="ts">
import { ref } from 'vue';
import { ArrowLeft, Pause, Play } from 'lucide-vue-next';
import type { AppModel } from '../composables/useTradingApp';
import { symbol } from '../utils/format';
defineProps<{model: AppModel}>();
defineEmits<{close: []}>();
const paused = ref(false);
const labels = {opened:'新增持仓',closed:'持仓消失',increased:'数量增加',reduced:'数量减少'};
</script>
<template>
 <section class="screen activity-screen" aria-labelledby="activity-title">
  <header class="screen-header"><button class="icon-button" aria-label="返回持仓" @click="$emit('close')"><ArrowLeft :size="19" /></button><h1 id="activity-title" tabindex="-1">持仓动态</h1><button class="icon-button header-end" :aria-label="paused ? '播放示意动画' : '暂停示意动画'" :aria-pressed="paused" @click="paused = !paused"><Play v-if="paused" :size="16"/><Pause v-else :size="16"/></button></header>
  <div class="screen-body" tabindex="0" aria-label="交易室与持仓变动">
   <div class="room-title"><span>交易室 / 会话视图</span><span class="tag">示意动画</span></div>
   <svg class="trading-room" :class="{paused}" viewBox="0 0 400 180" role="img" aria-label="三阶段示意：交易所读取、本地计算、按需 AI 解读；图形不代表资金转账">
    <path d="M20 130 200 170 380 130 200 90Z" class="room-floor"/>
    <path d="M65 117 200 146 335 117" class="room-route"/>
    <g v-for="(label,index) in ['数据台','计算台','AI 台']" :key="label" :transform="`translate(${40+index*135} 36)`"><rect width="65" height="41" rx="6" class="room-desk"/><path d="M7 47 7 68M58 47 58 68" class="room-route"/><text x="32" y="25" text-anchor="middle">{{label}}</text></g>
    <g class="room-character runner-one"><ellipse cx="0" cy="16" rx="10" ry="4" class="room-shadow"/><rect x="-8" y="-2" width="16" height="17" rx="5" fill="#e6be66"/><circle cy="-9" r="8" fill="#f1d4b5"/><path d="M-3-10h1m4 0h1" stroke="#26313d" stroke-width="2"/></g>
    <g class="room-character runner-two"><ellipse cx="0" cy="16" rx="10" ry="4" class="room-shadow"/><rect x="-8" y="-2" width="16" height="17" rx="5" fill="#9baece"/><circle cy="-9" r="8" fill="#e8c3a2"/><path d="M-3-10h1m4 0h1" stroke="#26313d" stroke-width="2"/></g>
   </svg>
   <ol class="operation-stages"><li><strong>交易所读取</strong><span>{{model.loading?'更新中':model.stale?'连接异常':model.lastUpdated?'已有快照':'等待连接'}}</span></li><li><strong>持仓比对</strong><span>{{model.positionEvents.length}} 条变化</span></li><li><strong>AI 解读</strong><span>{{model.analyzing?'分析中':model.analysisTime?'已有分析':'尚未请求'}}</span></li></ol>
   <p class="helper">角色展示流程结构；下方记录来自本机会话内的成功快照。数量变化不等于成交记录或资金转账。</p>
   <p v-if="model.historyGap" class="inline-note warning-text" role="status">连接中断后会重建基线，间隔内变化未分类。</p>
   <div class="section-heading"><h2>本次会话变化</h2><span class="muted small-text">最多 40 条 · 退出即清除</span></div>
   <ol v-if="model.positionEvents.length" class="event-list"><li v-for="event in model.positionEvents" :key="event.id"><div><strong>{{symbol(event.symbol)}} · {{labels[event.kind]}}</strong><time>{{new Date(event.at).toLocaleTimeString('zh-CN',{hour12:false})}}</time></div><p>{{event.exchange}} · {{event.side==='long'?'多仓':'空仓'}} · {{model.preferences.hideAmounts?'••••':`${event.previousQuantity} → ${event.quantity}`}}</p></li></ol>
   <div v-else class="empty-state compact"><h2>等待下一次持仓变化</h2><p>第一份快照建立基线。随后只记录数量变化，行情涨跌不会生成加减仓事件。</p></div>
  </div>
 </section>
</template>
<style scoped>
.room-title{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--muted)}
.trading-room{display:block;width:100%;height:170px;margin:6px 0;background:var(--surface);border-radius:6px}.room-floor{fill:var(--raised)}.room-route{fill:none;stroke:var(--muted);stroke-width:1;opacity:.45}.room-desk{fill:var(--canvas);stroke:var(--border)}text{fill:var(--text);font-size:11px}.room-shadow{fill:#000;opacity:.15}.runner-one{animation:walk-one 8s ease-in-out infinite}.runner-two{animation:walk-two 10s ease-in-out infinite}.paused .room-character{animation-play-state:paused}@keyframes walk-one{0%,100%{transform:translate(75px,115px)}50%{transform:translate(194px,142px)}}@keyframes walk-two{0%,100%{transform:translate(326px,115px)}50%{transform:translate(218px,139px)}}
.operation-stages{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;list-style:none;margin:12px 0}.operation-stages strong,.operation-stages span{display:block;font-size:11px}.operation-stages span{color:var(--muted);margin-top:3px}.section-heading{margin-top:20px}.event-list{list-style:none}.event-list li{padding:10px 0;border-bottom:1px solid var(--border)}.event-list li>div{display:flex;justify-content:space-between;gap:10px;font-size:12px}.event-list time,.event-list p{color:var(--muted);font-size:10px}.event-list p{margin-top:4px}@media(prefers-reduced-motion:reduce){.room-character{animation:none}.runner-one{transform:translate(90px,120px)}.runner-two{transform:translate(300px,120px)}}
</style>
