<script setup lang="ts">
import { ref } from 'vue';
import { Eye, EyeOff } from 'lucide-vue-next';
import AppTextInput from './ui/AppTextInput.vue';
defineProps<{
  modelValue: string;
  label: string;
  id: string;
  placeholder?: string;
  disabled?: boolean;
  plain?: boolean;
}>();
defineEmits<{ 'update:modelValue': [value: string] }>();
const revealed = ref(false);
</script>

<template>
  <div class="field">
    <label :for="id">{{ label }}</label>
    <div class="secret-control">
      <AppTextInput
        :id="id"
        :type="plain || revealed ? 'text' : 'password'"
        :model-value="modelValue"
        :placeholder="placeholder || `输入 ${label}`"
        :disabled="disabled"
        autocomplete="off"
        spellcheck="false"
        autocapitalize="off"
        @update:model-value="$emit('update:modelValue', $event)"
      />
      <button
        v-if="!plain"
        type="button"
        class="icon-button"
        :aria-label="`${revealed ? '隐藏' : '显示'} ${label}`"
        :aria-pressed="revealed"
        :disabled="disabled"
        @click="revealed = !revealed"
      >
        <EyeOff v-if="revealed" :size="16" /><Eye v-else :size="16" />
      </button>
    </div>
  </div>
</template>
