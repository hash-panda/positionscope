<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useTradingApp } from './composables/useTradingApp';
import type { Exchange, NoticeInput, SettingsPage } from './types';
import { exchanges } from './types';
import type { ResearchAPI } from './composables/useResearch';
import ConfirmDialog from './components/ConfirmDialog.vue';
import NotificationCenter from './components/NotificationCenter.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import WorkspaceShell from './components/research/WorkspaceShell.vue';
import PopupDashboard from './components/research/PopupDashboard.vue';
import './components/research/research.css';
const notificationCenter = ref<InstanceType<typeof NotificationCenter>>();
const notificationsOpen = ref(false);
const unread = ref(0);
const app = reactive(useTradingApp((notice: NoticeInput) => notificationCenter.value?.addNotification(notice)));
const query = new URLSearchParams(window.location.search);
const mode = ref<'popup' | 'workspace'>(query.get('mode') === 'workspace' ? 'workspace' : 'popup');
const settingsPage = ref<SettingsPage>('index');
const confirmation = ref<'quit' | 'delete' | 'reset' | Exchange | null>(null);
const confirmError = ref('');
const confirmBusy = ref(false);
const reversed = computed(() => (app.preferences as typeof app.preferences & { colorScheme?: string }).colorScheme === 'red-up');
const dataClearRevision = computed(() => (app as typeof app & { dataClearRevision?: number }).dataClearRevision || 0);
watch(dataClearRevision, () => { notificationCenter.value?.clearAll(); notificationsOpen.value = false; confirmation.value = null; });
watch(notificationsOpen, async open => { if (!open) { await nextTick(); document.querySelector<HTMLElement>('.workspace-header button[aria-label^="通知中心"],.popup-header button[aria-label^="通知中心"]')?.focus(); } });
const confirmationCopy = computed(() => {
  if (confirmation.value === 'quit')
    return {
      title: '退出应用？',
      button: '退出应用',
      body: '退出后将停止在菜单栏监控持仓。你可以随时重新打开应用。',
      danger: false,
    };
  if (confirmation.value === 'delete')
    return {
      title: '删除所有数据？',
      button: '删除所有数据',
      body: '将删除交易所凭证、AI 配置、持仓顺序、关注、提醒、复盘记录和应用设置。此操作无法撤销。',
      danger: true,
    };
  if (confirmation.value === 'reset')
    return {
      title: '恢复默认设置？',
      button: '恢复默认设置',
      body: '恢复显示、外观与系统设置。保留交易所凭证与 AI 配置。',
      danger: false,
    };
  const name = exchanges.find((item) => item.id === confirmation.value)?.name || '';
  return {
    title: `移除 ${name} 凭证？`,
    button: '移除凭证',
    body: '移除后将停止读取该交易所的数据。其他交易所不受影响。',
    danger: true,
  };
});
async function confirmAction() {
  if (!confirmation.value || confirmBusy.value) return;
  confirmBusy.value = true;
  confirmError.value = '';
  try {
    let success = true;
    if (confirmation.value === 'quit') await app.api?.quitApp();
    else if (confirmation.value === 'delete') {
      success = await app.deleteAll();
      if (success) notificationCenter.value?.clearAll();
    } else if (confirmation.value === 'reset') success = await app.resetDefaults();
    else success = await app.removeExchange(confirmation.value);
    if (success) confirmation.value = null;
    else confirmError.value = app.formError || '操作失败，请重试';
  } catch (cause) {
    confirmError.value = cause instanceof Error ? cause.message : '操作失败，请重试';
  } finally {
    confirmBusy.value = false;
  }
}

function askConfirmation(action: NonNullable<typeof confirmation.value>) { confirmError.value = ''; confirmation.value = action; }
async function open(page: 'research' | 'positions' | 'review' | 'settings') {
  const api = window.electronAPI as typeof window.electronAPI & Partial<ResearchAPI>;
  if (api?.openWorkspace) { const result = await api.openWorkspace(page); if (!result.success) notificationCenter.value?.addNotification({ type: 'error', title: '打开工作台失败', message: result.error || '请稍后重试。' }); }
  else if (page === 'settings') { app.currentView = 'settings'; settingsPage.value = 'index'; }
  else mode.value = 'workspace';
}
type AlertNotice = { id: string; symbol: string; metric: 'price' | 'funding' | 'openInterest'; threshold: number; triggeredAt: number };
let alertCleanup: (() => void) | undefined;
onMounted(async () => {
  const api = window.electronAPI as typeof window.electronAPI & Partial<ResearchAPI> & { onResearchAlert?: (callback: (alerts: AlertNotice[]) => void) => (() => void) | void };
  const cleanup = api?.onResearchAlert?.(alerts => {
    for (const alert of alerts) {
      const metric = alert.metric === 'price' ? '成交价' : alert.metric === 'funding' ? '资金费率' : '未平仓量';
      const threshold = alert.metric === 'funding' ? `${(alert.threshold * 100).toFixed(4)}%` : `${alert.threshold.toLocaleString('en-US')} ${alert.metric === 'price' ? 'USDT' : '币'}`;
      notificationCenter.value?.addNotification({ type: 'info', title: `${alert.symbol} · 条件触发`, message: `应用内提醒：${metric}穿越已设阈值 ${threshold}。请复核最新证据；不会执行交易。`, persistent: true, actionLabel: '查看复盘', onAction: () => { void open('review'); } });
    }
  });
  if (typeof cleanup === 'function') alertCleanup = cleanup;
  if (api?.getWindowMode) mode.value = await api.getWindowMode();
});
onUnmounted(() => alertCleanup?.());
</script>
<template>
  <div :data-color-scheme="reversed ? 'red-up' : 'green-up'" class="app positionscope-app" :class="{ 'light-mode': !app.preferences.dark, 'red-up': reversed, 'workspace-mode': mode === 'workspace' }">
    <WorkspaceShell v-if="mode === 'workspace'" :key="dataClearRevision" :inert="notificationsOpen || undefined" :model="app" :initial-page="query.get('page') || 'research'" :unread="unread" @confirm="askConfirmation" @notifications="notificationsOpen = true" />
    <SettingsPanel v-else-if="app.currentView === 'settings'" v-model:page="settingsPage" :inert="notificationsOpen || undefined" :model="app" @close="app.currentView = 'overview'" @confirm="askConfirmation" />
    <PopupDashboard v-else :key="dataClearRevision" :inert="notificationsOpen || undefined" :model="app" :unread="unread" @notifications="notificationsOpen = true" @settings="open('settings')" @positions="open('positions')" @research="open('research')" />
    <NotificationCenter ref="notificationCenter" v-model:open="notificationsOpen" @unread-change="unread = $event" />
    <ConfirmDialog v-if="confirmation" :title="confirmationCopy.title" :confirm-label="confirmationCopy.button" :danger="confirmationCopy.danger" :busy="confirmBusy" @close="confirmation = null" @confirm="confirmAction"><p>{{ confirmationCopy.body }}</p><p v-if="confirmError" class="error-feedback" role="alert">{{ confirmError }}</p></ConfirmDialog>
  </div>
</template>
