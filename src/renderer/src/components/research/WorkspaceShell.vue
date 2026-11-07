<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { FlaskConical, Power, Bell, ChartNoAxesCombined, ClipboardList, Search, Settings, KeyRound, Monitor, Palette, Sparkles, Wrench, CircleHelp } from 'lucide-vue-next';
import { useResearch } from '../../composables/useResearch';
import type { AppModel } from '../../composables/useTradingApp';
import type { Exchange, SettingsPage } from '../../types';
import SettingsPanel from '../SettingsPanel.vue';
import ResearchPanel from './ResearchPanel.vue';
import PositionsPanel from './PositionsPanel.vue';
import ReviewPanel from './ReviewPanel.vue';
import PaperPanel from './PaperPanel.vue';
import PaperReviewPanel from './PaperReviewPanel.vue';
import brandMark from '../../../../../assets/brand/mark.svg';
const props = defineProps<{ model: AppModel; initialPage?: string; unread: number }>();
// Alerts deep-link to research records; ordinary navigation can open paper review.
const reviewTab = ref(props.initialPage === 'review' ? 'research' : 'paper');
const emit = defineEmits<{ confirm: [action: 'reset' | 'delete' | Exchange]; notifications: [] }>();
type Page = 'paper' | 'research' | 'positions' | 'review' | 'settings';
const valid = (page: string): page is Page => ['paper', 'research', 'positions', 'review', 'settings'].includes(page);
const page = ref<Page>(props.initialPage && valid(props.initialPage) ? props.initialPage : 'research');
const settingsPage = ref<SettingsPage>('exchanges');
const research = reactive(useResearch());
const tabs = [{ id: 'research' as const, label: '研究', icon: Search }, { id: 'paper' as const, label: '模拟', icon: FlaskConical }, { id: 'positions' as const, label: '持仓', icon: ChartNoAxesCombined }, { id: 'review' as const, label: '复盘', icon: ClipboardList }, { id: 'settings' as const, label: '设置', icon: Settings }];
const settingSections = [{id:'display',label:'显示与菜单栏',icon:Monitor},{id:'exchanges',label:'Binance 连接',icon:KeyRound},{id:'ai',label:'AI 与模型',icon:Sparkles},{id:'appearance',label:'外观',icon:Palette},{id:'system',label:'系统',icon:Settings},{id:'developer',label:'开发者',icon:Wrench},{id:'about',label:'关于与更新',icon:CircleHelp}];
const reversed = computed(() => (props.model.preferences as typeof props.model.preferences & { colorScheme?: string }).colorScheme === 'red-up');
let cleanup: (() => void) | undefined;
function navigate(next: Page) { page.value = next; props.model.currentView = next === 'settings' ? 'settings' : 'overview'; }
function escape(event: KeyboardEvent) { if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[data-app-overlay][data-state="open"],dialog[open],.holdings-analysis-overlay,.notification-screen')) return; if (page.value !== 'research') navigate('research'); else document.querySelector<HTMLElement>('.event-row.selected')?.focus(); }
onMounted(() => { const api = window.electronAPI as typeof window.electronAPI & { onWorkspacePage?: (callback: (page: string) => void) => (() => void) }; const unsubscribe = api?.onWorkspacePage?.(next => { if (valid(next)) { if(next==='review')reviewTab.value='research'; navigate(next); } }); if (typeof unsubscribe === 'function') cleanup = unsubscribe; document.addEventListener('keydown', escape); });
onUnmounted(() => { cleanup?.(); document.removeEventListener('keydown', escape); });
</script>
<template>
  <section class="workspace-shell">
    <header class="workspace-header"><div class="new-wordmark"><img :src="brandMark" alt=""/><span>PositionScope</span></div><nav aria-label="主导航"><button v-for="tab in tabs" :key="tab.id" :aria-current="page === tab.id ? 'page' : undefined" @click="navigate(tab.id)"><component :is="tab.icon" :size="16"/>{{ tab.label }}</button></nav><button class="icon-button" :aria-label="`通知中心${unread ? `，${unread} 条未读` : ''}`" @click="emit('notifications')"><Bell :size="17"/><span v-if="unread" class="notification-count">{{ unread }}</span></button><button class="icon-button quit-button" aria-label="退出 PositionScope" title="退出 PositionScope" @click="model.api?.quitApp()"><Power :size="17"/></button></header>
    <ResearchPanel v-show="page === 'research'" :model="research" :reversed="reversed" />
    <PaperPanel v-if="page === 'paper'" :model="model" @settings="navigate('settings'); settingsPage = 'ai'" />
    <PositionsPanel v-if="page === 'positions'" :model="model" @settings="navigate('settings'); settingsPage = $event || 'exchanges'" />
    <template v-if="page === 'review'"><nav class="review-nav" aria-label="复盘类型"><button :aria-pressed="reviewTab==='paper'" @click="reviewTab='paper'">模拟复盘</button><button :aria-pressed="reviewTab==='research'" @click="reviewTab='research'">研究记录</button></nav><PaperReviewPanel v-if="reviewTab==='paper'" :model="model"/><ReviewPanel v-else :model="research" /></template>
    <div v-if="page === 'settings'" class="workspace-settings"><aside><h1>设置</h1><p>你的工作方式。</p><button v-for="section in settingSections" :key="section.id" :aria-current="settingsPage === section.id ? 'page' : undefined" @click="settingsPage = section.id as SettingsPage"><component :is="section.icon" :size="17" aria-hidden="true"/>{{ section.label }}</button></aside><SettingsPanel v-model:page="settingsPage" :model="model" @close="navigate('research')" @confirm="emit('confirm', $event)" /></div>
  </section>
</template>

<style scoped>
.review-nav{display:flex;gap:24px;padding:14px 28px 0;flex-shrink:0}.review-nav button{font-size:12px;border:0;background:none;padding:8px 0;color:var(--muted);border-bottom:2px solid transparent}.review-nav button[aria-pressed=true]{color:var(--text);border-color:var(--brand)}
</style>
