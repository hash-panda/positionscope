<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-vue-next';
import { providers } from '../../types';
import SecretInput from '../SecretInput.vue';
import ToggleRow from '../ToggleRow.vue';
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
      ><select
        v-model="model.preferences.defaultProvider"
        aria-label="默认提供商"
        :disabled="!!model.saving"
        @change="
          provider = model.preferences.defaultProvider;
          model.saveAI();
        "
      >
        <option v-for="item in providers" :key="item.id" :value="item.id">{{ item.name }}</option>
      </select></label
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
        <button class="button primary full-width" :disabled="!!model.saving">
          {{ model.saving === 'ai' ? '正在保存…' : '保存配置' }}
        </button>
      </form>
    </template>
    <p v-else class="inline-note">请开启自定义 API Key 并配置默认提供商。</p>
    <p class="inline-note">
      <ShieldCheck :size="15" /><span>分析时会将当前持仓与账户汇总发送给所选 AI 提供商。</span>
    </p>
  </template>
  <div v-else class="empty-state compact">
    <Sparkles :size="28" />
    <h2>按需开启 AI 分析</h2>
    <p>配置提供商后，可评估持仓健康度。</p>
  </div>
</template>
