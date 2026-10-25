<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-vue-next';
import { providers } from '../../types';
import SecretInput from '../SecretInput.vue';
import ToggleRow from '../ToggleRow.vue';
import AppSelect from '../ui/AppSelect.vue';
import AppTextInput from '../ui/AppTextInput.vue';
import type { AppModel } from '../../composables/useTradingApp';

const props = defineProps<{ model: AppModel }>();
const provider = ref(props.model.preferences.defaultProvider);
const selectedProvider = computed(() => providers.find((item) => item.id === provider.value)!);
</script>
<template>
  <ToggleRow
    v-model="model.preferences.aiEnabled"
    label="启用 AI 功能"
    :disabled="!!model.saving"
    @change="model.saveAI()"
  />
  <template v-if="model.preferences.aiEnabled">
    <label class="setting-row"
      ><span>默认提供商</span
      ><AppSelect
        v-model="model.preferences.defaultProvider"
        label="默认提供商"
        :options="providers.map(item => ({ value: item.id, label: item.name }))"
        :disabled="!!model.saving"
        @change="
          provider = model.preferences.defaultProvider;
          model.saveAI();
        "
      /></label
    >
    <ToggleRow
      v-model="model.preferences.useCustomKeys"
      label="使用自定义 API Key"
      :disabled="!!model.saving"
      @change="model.saveAI()"
    />
    <template v-if="model.preferences.useCustomKeys">
      <div class="provider-tabs" aria-label="配置提供商">
        <button
          v-for="item in providers"
          :key="item.id"
          :class="{ selected: provider === item.id }"
          :aria-pressed="provider === item.id"
          @click="
            provider = item.id;
            model.formError = '';
            model.formSuccess = '';
          "
        >
          {{ item.name }}
        </button>
      </div>
      <form class="settings-form" @submit.prevent="model.saveAI(true)">
        <div class="section-heading">
          <span class="muted small-text">{{ selectedProvider.name }} 凭证</span
          ><button
            type="button"
            class="text-button small-text"
            @click="model.api?.openExternal(selectedProvider.url)"
          >
            获取 API Key<ArrowUpRight :size="13" />
          </button>
        </div>
        <SecretInput
          :key="provider"
          :id="`${provider}-ai-key`"
          v-model="model.aiKeyDrafts[provider]"
          :label="`${selectedProvider.name} API Key`"
          :disabled="!!model.saving"
        />
        <label class="field-label" :for="`${provider}-model`">模型 ID（可选）</label>
        <AppTextInput :id="`${provider}-model`" v-model="model.aiModelDrafts[provider]" class="text-input" :aria-describedby="`${provider}-model-help`" :disabled="!!model.saving" placeholder="留空沿用默认模型" autocomplete="off" />
        <p :id="`${provider}-model-help`" class="helper">按提供商文档填写可用模型 ID；旧默认模型可能已停用。</p>
        <button class="button primary full-width" :disabled="!!model.saving">
          {{ model.saving === 'ai' ? '正在保存…' : '保存配置' }}
        </button>
      </form>
    </template>
    <p v-else class="inline-note">请开启自定义 API Key 并配置默认提供商。</p>
    <p class="inline-note">
      <ShieldCheck :size="15" /><span>分析时仅将本地计算的风险汇总发送给所选 AI 提供商，不发送 API Key 或逐笔开仓信息。</span>
    </p>
  </template>
  <div v-else class="empty-state compact">
    <Sparkles :size="28" />
    <h2>按需开启 AI 分析</h2>
    <p>配置提供商后，可评估持仓健康度。</p>
  </div>
</template>
