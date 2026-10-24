<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { ArrowLeft, Bell, CheckCircle2, AlertTriangle, Info, X } from 'lucide-vue-next';
import type { NoticeInput } from '../types';
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ 'update:open': [value: boolean]; 'unread-change': [count: number] }>();
interface Notice extends NoticeInput {
  id: number;
  timestamp: number;
  read: boolean;
}
const notices = ref<Notice[]>([]);
const toast = ref<Notice | null>(null);
let nextId = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const backButton = ref<HTMLButtonElement>();
const unread = computed(() => notices.value.filter((notice) => !notice.read).length);
watch(unread, (count) => emit('unread-change', count), { immediate: true });
watch(
  () => props.open,
  async (open) => {
    if (open) {
      toast.value = null;
      await nextTick();
      backButton.value?.focus();
    }
  }
);
function addNotification(input: NoticeInput) {
  const duplicate = notices.value.find(
    (notice) => !notice.read && notice.title === input.title && notice.message === input.message
  );
  if (duplicate) {
    duplicate.timestamp = Date.now();
    return;
  }
  const notice = { ...input, id: nextId++, timestamp: Date.now(), read: false };
  notices.value.unshift(notice);
  notices.value = notices.value.slice(0, 100);
  if (!input.persistent && !props.open) {
    toast.value = notice;
    if (timer) clearTimeout(timer);
    timer = setTimeout(
      () => {
        toast.value = null;
      },
      input.type === 'error' ? 6500 : 3600
    );
  }
}
function activate(notice: Notice) {
  notice.read = true;
  emit('update:open', false);
  notice.onAction?.();
}
function clearAll() {
  notices.value = [];
  toast.value = null;
}
function relativeTime(timestamp: number) {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  return minutes < 1
    ? '刚刚'
    : minutes < 60
      ? `${minutes} 分钟前`
      : `${Math.floor(minutes / 60)} 小时前`;
}
defineExpose({ addNotification, clearAll });
onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <section
    v-if="open"
    class="screen notification-screen"
    aria-labelledby="notifications-title"
    @keydown.esc="emit('update:open', false)"
  >
    <header class="screen-header">
      <button
        ref="backButton"
        class="icon-button"
        aria-label="返回持仓"
        @click="emit('update:open', false)"
      >
        <ArrowLeft :size="19" />
      </button>
      <h1 id="notifications-title">通知中心</h1>
      <button
        class="text-button header-end"
        :disabled="!unread"
        @click="notices.forEach((notice) => (notice.read = true))"
      >
        全部已读
      </button>
    </header>
    <div class="screen-body">
      <div v-if="notices.length" class="section-heading">
        <span class="muted">{{ notices.length }} 条通知</span
        ><button class="text-button subdued" @click="clearAll">清空</button>
      </div>
      <div v-if="!notices.length" class="empty-state">
        <span class="empty-symbol"><Bell :size="28" /></span>
        <h2>暂无通知</h2>
        <p>连接状态与分析结果会显示在这里。</p>
      </div>
      <ol v-else class="notice-list">
        <li
          v-for="notice in notices"
          :key="notice.id"
          class="notice-item"
          :class="{ unread: !notice.read }"
        >
          <span class="notice-icon" :class="notice.type"
            ><AlertTriangle
              v-if="notice.type === 'error' || notice.type === 'warning'"
              :size="20" /><CheckCircle2 v-else-if="notice.type === 'success'" :size="20" /><Info
              v-else
              :size="20"
          /></span>
          <div class="notice-copy">
            <div class="notice-title">
              <strong>{{ notice.title }}</strong
              ><span v-if="!notice.read" class="unread-dot" role="img" aria-label="未读" />
            </div>
            <p>{{ notice.message }}</p>
            <div class="notice-bottom">
              <time>{{ relativeTime(notice.timestamp) }}</time>
              <button v-if="notice.actionLabel" class="text-button" @click="activate(notice)">
                {{ notice.actionLabel }}
              </button>
              <button
                v-else-if="!notice.read"
                class="text-button subdued"
                @click="notice.read = true"
              >
                标为已读
              </button>
            </div>
          </div>
          <button
            class="icon-button small"
            :aria-label="`删除通知：${notice.title}`"
            @click="notices = notices.filter((item) => item.id !== notice.id)"
          >
            <X :size="15" />
          </button>
        </li>
      </ol>
    </div>
    <footer class="status-bar"><Info :size="13" /><span>当前会话的通知记录</span></footer>
  </section>
  <Transition name="toast">
    <div
      v-if="toast && !open"
      class="toast-message"
      :role="toast.type === 'error' ? 'alert' : 'status'"
    >
      <CheckCircle2 v-if="toast.type === 'success'" :size="18" /><Info v-else :size="18" />
      <div>
        <strong>{{ toast.title }}</strong>
        <p>{{ toast.message }}</p>
      </div>
      <button class="icon-button small" aria-label="关闭通知" @click="toast = null">
        <X :size="15" />
      </button>
    </div>
  </Transition>
</template>
