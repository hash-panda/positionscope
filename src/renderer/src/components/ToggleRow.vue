<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui';
defineProps<{ modelValue: boolean; label: string; description?: string; disabled?: boolean }>();
defineEmits<{ 'update:modelValue': [value: boolean]; change: [] }>();
</script>

<template>
  <label class="setting-row toggle-row">
    <span class="row-copy"
      ><span class="row-label">{{ label }}</span
      ><span v-if="description" class="helper">{{ description }}</span></span
    >
    <SwitchRoot class="ui-switch" :aria-label="label" :model-value="modelValue" :disabled="disabled" @update:model-value="value => { $emit('update:modelValue', value); $emit('change'); }"><SwitchThumb class="ui-switch-thumb" /></SwitchRoot>
  </label>
</template>
