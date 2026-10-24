<script setup lang="ts">
defineProps<{ modelValue: boolean; label: string; description?: string; disabled?: boolean }>();
defineEmits<{ 'update:modelValue': [value: boolean]; change: [] }>();
</script>

<template>
  <label class="setting-row toggle-row">
    <span class="row-copy"
      ><span class="row-label">{{ label }}</span
      ><span v-if="description" class="helper">{{ description }}</span></span
    >
    <span class="switch">
      <input
        type="checkbox"
        role="switch"
        :aria-label="label"
        :checked="modelValue"
        :disabled="disabled"
        @change="
          $emit('update:modelValue', ($event.target as HTMLInputElement).checked);
          $emit('change');
        "
      />
      <span class="switch-track" aria-hidden="true"><span /></span>
    </span>
  </label>
</template>
