<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { AlertTriangle, X } from 'lucide-vue-next';
defineProps<{ title: string; confirmLabel: string; busy?: boolean; danger?: boolean }>();
const emit = defineEmits<{ close: []; confirm: [] }>();
const dialog = ref<HTMLDialogElement>();
const previousFocus = document.activeElement as HTMLElement | null;
onMounted(() => {
  dialog.value?.showModal();
});
onUnmounted(() => {
  dialog.value?.close();
  previousFocus?.focus();
});
</script>

<template>
  <dialog
    ref="dialog"
    class="confirm-dialog"
    aria-labelledby="confirm-title"
    @cancel.prevent="!busy && emit('close')"
    @click="$event.target === dialog && !busy && emit('close')"
  >
    <div class="dialog-top">
      <AlertTriangle v-if="danger" :size="22" class="danger-text" />
      <button
        class="icon-button"
        aria-label="关闭确认对话框"
        :disabled="busy"
        @click="emit('close')"
      >
        <X :size="18" />
      </button>
    </div>
    <h2 id="confirm-title">{{ title }}</h2>
    <div class="dialog-copy"><slot /></div>
    <div class="dialog-actions">
      <button class="button secondary" autofocus :disabled="busy" @click="emit('close')">
        取消
      </button>
      <button
        class="button"
        :class="danger ? 'danger' : 'primary'"
        :disabled="busy"
        @click="emit('confirm')"
      >
        {{ busy ? '正在处理…' : confirmLabel }}
      </button>
    </div>
  </dialog>
</template>
