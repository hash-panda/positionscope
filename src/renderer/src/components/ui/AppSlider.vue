<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui';
defineProps<{ modelValue: number; label: string; id?: string; min: number; max: number; step: number; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: number]; commit: [] }>();
function update(values: number[] | undefined) { if (values?.length) emit('update:modelValue', values[0]); }
</script>
<template>
  <SliderRoot class="ui-slider" :model-value="[modelValue]" :min="min" :max="max" :step="step" :disabled="disabled" @update:model-value="update" @value-commit="emit('commit')">
    <SliderTrack class="ui-slider-track"><SliderRange class="ui-slider-range" /></SliderTrack><SliderThumb :id="id" class="ui-slider-thumb" :aria-label="label" :aria-valuetext="`${Math.round(modelValue * 100)}%`" />
  </SliderRoot>
</template>
