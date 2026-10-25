<script setup lang="ts">
import { CircleHelp } from 'lucide-vue-next';
import ToggleRow from '../ToggleRow.vue';
import SecretInput from '../SecretInput.vue';
import type { AppModel } from '../../composables/useTradingApp';

defineProps<{ model: AppModel }>();
</script>
<template>
  <ToggleRow
    v-model="model.preferences.autoLaunch"
    label="开机自动启动"
    description="登录后在菜单栏运行"
    :disabled="!!model.saving"
    @change="model.savePreference('autoLaunch')"
  />
  <section class="settings-section">
    <h2>网络代理</h2>
    <form class="settings-form" @submit.prevent="model.saveProxy">
      <SecretInput
          id="proxy-url"
          label="代理地址（可选）"
          v-model="model.preferences.proxyUrl"
          placeholder="http://127.0.0.1:7890"
          autocomplete="off"
          :disabled="!!model.saving"
      />
      <p class="helper">留空则不使用代理。修改后需保存。</p>
      <button class="button primary full-width" :disabled="!!model.saving">
        {{ model.saving === 'proxy' ? '正在保存…' : '保存代理' }}
      </button>
    </form>
  </section>
  <p class="inline-note">
    <CircleHelp :size="15" /><span>如果连接失败，请检查代理地址后重新获取数据。</span>
  </p>
</template>
