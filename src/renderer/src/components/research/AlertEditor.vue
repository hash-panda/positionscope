<script setup lang="ts">
import { computed, ref } from 'vue';
import { X } from 'lucide-vue-next';
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import AppSelect from '../ui/AppSelect.vue';
import AppTextInput from '../ui/AppTextInput.vue';
import type { ResearchAlertInput } from '../../../../main/types/research-ledger';
const props = defineProps<{ symbol: string; busy: boolean }>();
const emit = defineEmits<{ close: []; save: [input: ResearchAlertInput] }>();
const metric = ref<'price' | 'funding' | 'openInterest'>('price');
const operator = ref<'above' | 'below'>('above');
const threshold = ref('');
const valid = computed(() => threshold.value.trim() !== '' && Number.isFinite(Number(threshold.value)) && (metric.value === 'funding' || Number(threshold.value) > 0));
function save() { if (valid.value) emit('save', { symbol: props.symbol, metric: metric.value, operator: operator.value, threshold: Number(threshold.value) / (metric.value === 'funding' ? 100 : 1) }); }
</script>
<template>
  <DialogRoot :open="true" @update:open="!$event && !busy && emit('close')"><DialogPortal to=".app"><DialogOverlay class="research-dialog-overlay"/><DialogContent class="research-dialog" data-app-overlay @escape-key-down="busy && $event.preventDefault()">
    <div class="dialog-title-row"><DialogTitle>条件提醒 · {{ symbol }}</DialogTitle><button class="icon-button" aria-label="关闭提醒设置" :disabled="busy" @click="emit('close')"><X :size="17"/></button></div>
    <DialogDescription class="muted">在应用运行且公共数据刷新时检查。首次读数建立基线；跨过阈值后提醒一次。</DialogDescription>
    <form @submit.prevent="save"><label class="research-field">观察指标<AppSelect v-model="metric" label="观察指标" :options="[{value:'price',label:'最新成交价 · USDT'},{value:'funding',label:'资金费率 · %'}]"/></label><label class="research-field">触发条件<AppSelect v-model="operator" label="触发条件" :options="[{value:'above',label:'从下方穿越阈值'},{value:'below',label:'从上方穿越阈值'}]"/></label><label class="research-field">阈值 · {{ metric === 'funding' ? '%' : 'USDT' }}<AppTextInput v-model="threshold" aria-label="提醒阈值" inputmode="decimal" placeholder="输入明确阈值" /></label><p class="helper">每 60 秒检查；应用关闭或断网时不检查。关注与提醒分别保存，不会执行交易。</p><button class="button primary full-width" type="submit" :disabled="!valid || busy">{{ busy ? '正在保存…' : '保存条件提醒' }}</button></form>
  </DialogContent></DialogPortal></DialogRoot>
</template>
