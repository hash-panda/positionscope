<script setup lang="ts">
import { Cpu } from 'lucide-vue-next';
import ToggleRow from '../ToggleRow.vue';
import type { AppModel } from '../../composables/useTradingApp';

defineProps<{ model: AppModel }>();
</script>
<template>
  <ToggleRow
    v-model="model.preferences.debugMode"
    label="调试模式"
    description="开启后显示开发者工具（DevTools）"
    :disabled="!!model.saving"
    @change="model.savePreference('debugMode')"
  />
  <p class="inline-note"><Cpu :size="16" /><span>仅在排查问题时启用。</span></p>
</template>
