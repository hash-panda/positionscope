<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { Bell, ChartNoAxesCombined, ClipboardList, Search, Settings } from 'lucide-vue-next';
import { useResearch } from '../../composables/useResearch';
import type { AppModel } from '../../composables/useTradingApp';
import type { Exchange, SettingsPage } from '../../types';
import SettingsPanel from '../SettingsPanel.vue';
import ResearchPanel from './ResearchPanel.vue';
import PositionsPanel from './PositionsPanel.vue';
import ReviewPanel from './ReviewPanel.vue';
import brandMark from '../../../../../assets/brand/mark.svg';
const props = defineProps<{ model: AppModel; initialPage?: string; unread: number }>();
const emit = defineEmits<{ confirm: [action: 'reset' | 'delete' | Exchange]; notifications: [] }>();
type Page = 'research' | 'positions' | 'review' | 'settings';
const valid = (page: string): page is Page => ['research', 'positions', 'review', 'settings'].includes(page);
const page = ref<Page>(props.initialPage && valid(props.initialPage) ? props.initialPage : 'research');
const settingsPage = ref<SettingsPage>('exchanges');
const research = reactive(useResearch());
const tabs = [{ id: 'research' as const, label: '研究', icon: Search }, { id: 'positions' as const, label: '持仓', icon: ChartNoAxesCombined }, { id: 'review' as const, label: '复盘', icon: ClipboardList }, { id: 'settings' as const, label: '设置', icon: Settings }];
const reversed = computed(() => (props.model.preferences as typeof props.model.preferences & { colorScheme?: string }).colorScheme === 'red-up');
let cleanup: (() => void) | undefined;
function navigate(next: Page) { page.value = next; props.model.currentView = next === 'settings' ? 'settings' : 'overview'; }
function escape(event: KeyboardEvent) { if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[data-app-overlay][data-state="open"],dialog[open],.holdings-analysis-overlay,.notification-screen')) return; if (page.value !== 'research') navigate('research'); else document.querySelector<HTMLElement>('.event-row.selected')?.focus(); }
onMounted(() => { const api = window.electronAPI as typeof window.electronAPI & { onWorkspacePage?: (callback: (page: string) => void) => (() => void) }; const unsubscribe = api?.onWorkspacePage?.(next => { if (valid(next)) navigate(next); }); if (typeof unsubscribe === 'function') cleanup = unsubscribe; document.addEventListener('keydown', escape); });
onUnmounted(() => { cleanup?.(); document.removeEventListener('keydown', escape); });
</script>
<template>
  <section class="workspace-shell">
    <header class="workspace-header"><div class="new-wordmark"><img :src="brandMark" alt=""/><span>PositionScope</span></div><nav aria-label="主导航"><button v-for="tab in tabs" :key="tab.id" :aria-current="page === tab.id ? 'page' : undefined" @click="navigate(tab.id)"><component :is="tab.icon" :size="16"/>{{ tab.label }}</button></nav><button class="icon-button" :aria-label="`通知中心${unread ? `，${unread} 条未读` : ''}`" @click="emit('notifications')"><Bell :size="17"/><span v-if="unread" class="notification-count">{{ unread }}</span></button></header>
    <ResearchPanel v-show="page === 'research'" :model="research" :reversed="reversed" />
    <PositionsPanel v-if="page === 'positions'" :model="model" @settings="navigate('settings'); settingsPage = $event || 'exchanges'" />
    <ReviewPanel v-if="page === 'review'" :model="research" />
    <div v-if="page === 'settings'" class="workspace-settings"><aside><h1>设置</h1><p>你的工作方式。</p><button v-for="section in [{id:'exchanges',label:'Binance 连接'},{id:'display',label:'显示与参考币种'},{id:'appearance',label:'外观'},{id:'ai',label:'AI 与模型'},{id:'system',label:'系统'},{id:'developer',label:'开发者'},{id:'about',label:'关于与更新'}]" :key="section.id" :aria-current="settingsPage === section.id ? 'page' : undefined" @click="settingsPage = section.id as SettingsPage">{{ section.label }}</button></aside><SettingsPanel v-model:page="settingsPage" :model="model" @close="navigate('research')" @confirm="emit('confirm', $event)" /></div>
  </section>
</template>
