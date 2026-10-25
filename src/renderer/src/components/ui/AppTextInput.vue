<script setup lang="ts">
import { computed } from 'vue';
defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{ modelValue: string; type?: string; disabled?: boolean; invalid?: boolean }>(), { type: 'text' });
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const value = computed({ get: () => props.modelValue, set: (next: string) => emit('update:modelValue', next) });
</script>
<template><input v-bind="$attrs" v-model="value" class="ui-text-input" :type="type" :disabled="disabled" :aria-invalid="invalid || undefined" /></template>
