<script setup lang="ts">
import { computed, ref } from 'vue';
import { ShieldCheck, Trash2 } from 'lucide-vue-next';
import { exchanges } from '../../types';
import type { Exchange } from '../../types';
import ExchangeLogo from '../ExchangeLogo.vue';
import SecretInput from '../SecretInput.vue';
import type { AppModel } from '../../composables/useTradingApp';

const props = defineProps<{ model: AppModel }>();
const emit = defineEmits<{ confirm: [exchange: Exchange] }>();
const exchange = ref<Exchange>('binance');
const selectedExchange = computed(() => exchanges.find((item) => item.id === exchange.value)!);
const draft = computed(() => props.model.credentialDrafts[exchange.value]);
const credentialSaved = computed(() => !!props.model.savedCredentials[exchange.value].apiKey);
const credentialDirty = computed(
  () => JSON.stringify(draft.value) !== JSON.stringify(props.model.savedCredentials[exchange.value])
);
function exchangeTabKey(event: KeyboardEvent) {
  const index = exchanges.findIndex((item) => item.id === exchange.value);
  const target =
    event.key === 'ArrowRight'
      ? (index + 1) % exchanges.length
      : event.key === 'ArrowLeft'
        ? (index + exchanges.length - 1) % exchanges.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? exchanges.length - 1
            : -1;
  if (target < 0) return;
  event.preventDefault();
  exchange.value = exchanges[target].id;
  props.model.formError = '';
  props.model.formSuccess = '';
  document.getElementById('exchange-tab-' + exchange.value)?.focus();
}
</script>
<template>
  <div class="exchange-tabs" role="tablist" aria-label="选择交易所" @keydown="exchangeTabKey">
    <button
      v-for="item in exchanges"
      :key="item.id"
      :id="`exchange-tab-${item.id}`"
      role="tab"
      :aria-selected="exchange === item.id"
      :tabindex="exchange === item.id ? 0 : -1"
      aria-controls="exchange-form"
      :class="{ selected: exchange === item.id }"
      @click="
        exchange = item.id;
        model.formError = '';
        model.formSuccess = '';
      "
    >
      {{ item.name }}
    </button>
  </div>
  <form
    id="exchange-form"
    class="settings-form"
    role="tabpanel"
    :aria-labelledby="`exchange-tab-${exchange}`"
    @submit.prevent="model.saveExchange(exchange)"
  >
    <div class="section-heading exchange-form-title">
      <span class="inline-label"
        ><ExchangeLogo :exchange="exchange" />{{ selectedExchange.name }}</span
      >
      <span class="small-text muted">{{
        credentialDirty ? '未保存' : credentialSaved ? '凭证已保存' : '尚未配置'
      }}</span>
    </div>
    <SecretInput
      :key="`${exchange}-key`"
      :id="`${exchange}-key`"
      v-model="draft.apiKey"
      :label="exchange === 'hyperliquid' ? '钱包地址' : 'API Key'"
      :plain="exchange === 'hyperliquid'"
      :disabled="!!model.saving"
    />
    <SecretInput
      v-if="exchange !== 'hyperliquid'"
      :key="`${exchange}-secret`"
      :id="`${exchange}-secret`"
      v-model="draft.apiSecret"
      label="API Secret"
      :disabled="!!model.saving"
    />
    <SecretInput
      v-if="exchange === 'okx'"
      id="okx-passphrase"
      v-model="draft.passphrase!"
      label="Passphrase"
      :disabled="!!model.saving"
    />
    <p class="inline-note">
      <ShieldCheck :size="15" /><span>{{
        exchange === 'hyperliquid'
          ? '仅使用公开钱包地址，无需私钥。暂仅支持标准账户（disabled），其他模式不生成汇总。'
          : '请仅授予查询权限，不开启交易或提现权限。'
      }}</span>
    </p>
    <button class="button primary full-width" :disabled="!!model.saving">
      {{ model.saving.startsWith('exchange:') ? '正在保存…' : '保存配置' }}
    </button>
    <button
      v-if="credentialSaved"
      type="button"
      class="text-button subdued"
      :disabled="model.loading || !!model.saving"
      @click="model.retry"
    >
      {{ model.loading ? '正在获取数据…' : '重新连接' }}
    </button>
  </form>
  <button
    v-if="credentialSaved"
    class="text-button danger-text remove-credential"
    :disabled="!!model.saving"
    @click="emit('confirm', exchange)"
  >
    <Trash2 :size="15" />移除 {{ selectedExchange.name }} 凭证
  </button>
</template>
