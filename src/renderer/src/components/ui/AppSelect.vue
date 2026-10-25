<script setup lang="ts" generic="T extends string | number">
import { Check, ChevronDown, ChevronUp } from 'lucide-vue-next';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { SelectContent, SelectItem, SelectItemIndicator, SelectItemText, SelectPortal, SelectRoot, SelectScrollDownButton, SelectScrollUpButton, SelectTrigger, SelectValue, SelectViewport, useId } from 'reka-ui';
const props = defineProps<{ modelValue: T; label: string; options: readonly { value: T; label: string; disabled?: boolean }[]; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: T]; change: [] }>();
const open = ref(false);
const triggerId = useId();
let waitingForSave = false;
const background = new Map<HTMLElement, boolean>();
function restoreBackground() { background.forEach((inert, element) => { element.inert = inert; }); background.clear(); }
watch(open, value => {
  restoreBackground();
  if (value) document.querySelectorAll<HTMLElement>('.app > .screen').forEach(element => {
    background.set(element, element.inert);
    element.inert = true;
  });
}, { flush: 'post' });
onBeforeUnmount(restoreBackground);
function closeFocus(event: Event) {
  if (props.disabled) { event.preventDefault(); waitingForSave = true; }
}
watch(() => props.disabled, async disabled => {
  if (!disabled && waitingForSave) {
    waitingForSave = false;
    await nextTick();
    if (document.activeElement === document.body) document.getElementById(triggerId)?.focus();
  }
});
function choose(value: unknown) {
  const option = props.options.find(item => String(item.value) === String(value));
  if (option && !option.disabled && option.value !== props.modelValue) {
    emit('update:modelValue', option.value);
    emit('change');
  }
}
</script>
<template>
  <SelectRoot v-model:open="open" :model-value="String(modelValue)" :disabled="disabled" @update:model-value="choose">
    <SelectTrigger :id="triggerId" class="ui-select-trigger" :aria-label="label"><SelectValue>{{ options.find(option => option.value === modelValue)?.label || '请选择' }}</SelectValue><ChevronDown :size="14" aria-hidden="true" /></SelectTrigger>
    <SelectPortal to=".app">
      <SelectContent class="ui-select-content" data-app-overlay position="popper" align="end" :side-offset="6" :collision-padding="8" :body-lock="false" @close-auto-focus="closeFocus">
        <SelectScrollUpButton class="ui-select-scroll"><ChevronUp :size="14" aria-hidden="true" /></SelectScrollUpButton>
        <SelectViewport class="ui-select-viewport">
          <SelectItem v-for="option in options" :key="String(option.value)" class="ui-select-item" :value="String(option.value)" :disabled="option.disabled">
            <SelectItemText>{{ option.label }}</SelectItemText><SelectItemIndicator class="ui-select-check"><Check :size="14" aria-hidden="true" /></SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
        <SelectScrollDownButton class="ui-select-scroll"><ChevronDown :size="14" aria-hidden="true" /></SelectScrollDownButton>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
