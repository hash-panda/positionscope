<script setup lang="ts">
import { computed } from 'vue';
import { ShieldCheck, Trash2 } from 'lucide-vue-next';
import { exchanges } from '../../types';
import type { Exchange } from '../../types';
import ExchangeLogo from '../ExchangeLogo.vue';
import SecretInput from '../SecretInput.vue';
import type { AppModel } from '../../composables/useTradingApp';
const props = defineProps<{ model: AppModel }>();
const emit = defineEmits<{ confirm: [exchange: Exchange] }>();
const draft = computed(() => props.model.credentialDrafts.binance);
const credentialSaved = computed(() => !!props.model.savedCredentials.binance.apiKey);
const credentialDirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(props.model.savedCredentials.binance));
const retainedExchanges = computed(() => exchanges.filter(item => item.id !== 'binance' && props.model.savedCredentials[item.id].apiKey));
</script>
<template>
  <form class="settings-form" aria-label="Binance 只读连接" @submit.prevent="model.saveExchange('binance')">
    <div class="section-heading exchange-form-title">
      <span class="inline-label"><ExchangeLogo exchange="binance" />Binance</span>
      <span class="small-text muted">{{ credentialDirty ? '未保存' : credentialSaved ? '凭证已保存' : '尚未配置' }}</span>
    </div>
    <SecretInput id="binance-key" v-model="draft.apiKey" label="API Key" :disabled="!!model.saving" />
    <SecretInput id="binance-secret" v-model="draft.apiSecret" label="API Secret" :disabled="!!model.saving" />
    <p class="inline-note"><ShieldCheck :size="15" /><span>只读权限即可，请勿开启交易或提现。持仓研究仅覆盖 USDT 线性合约。</span></p>
    <button class="button primary full-width" :disabled="!!model.saving">{{ model.saving.startsWith('exchange:') ? '正在保存…' : '保存配置' }}</button>
    <button v-if="credentialSaved" type="button" class="text-button subdued" :disabled="model.loading || !!model.saving" @click="model.retry">{{ model.loading ? '正在获取数据…' : '重新连接' }}</button>
  </form>
  <button v-if="credentialSaved" class="text-button danger-text remove-credential" :disabled="!!model.saving" @click="emit('confirm', 'binance')"><Trash2 :size="15" />移除 Binance 凭证</button>
  <section v-if="retainedExchanges.length" class="settings-section">
    <h2>其他已保存平台</h2>
    <p class="helper">本版聚焦 Binance。以下凭证仍保留在本机加密配置中，不开放新增或编辑，可单独移除。</p>
    <div v-for="item in retainedExchanges" :key="item.id" class="setting-row"><span>{{ item.name }}</span><button class="text-button danger-text" :disabled="!!model.saving" :aria-label="`移除 ${item.name} 凭证`" @click="emit('confirm', item.id)"><Trash2 :size="15" />移除</button></div>
  </section>
</template>
