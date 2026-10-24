<script setup lang="ts">
import { computed } from 'vue';
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  KeyRound,
  Monitor,
  Palette,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-vue-next';
import type { AppModel } from '../composables/useTradingApp';
import { providers } from '../types';
import type { Exchange, SettingsPage } from '../types';
import ExchangeSettings from './settings/ExchangeSettings.vue';
import DisplaySettings from './settings/DisplaySettings.vue';
import AppearanceSettings from './settings/AppearanceSettings.vue';
import SystemSettings from './settings/SystemSettings.vue';
import AISettings from './settings/AISettings.vue';
import DeveloperSettings from './settings/DeveloperSettings.vue';
import AboutSettings from './settings/AboutSettings.vue';
const props = defineProps<{ model: AppModel; page: SettingsPage }>();
const emit = defineEmits<{
  close: [];
  'update:page': [page: SettingsPage];
  confirm: [action: 'reset' | 'delete' | Exchange];
}>();
const pageComponents = {
  index: null,
  exchanges: ExchangeSettings,
  display: DisplaySettings,
  appearance: AppearanceSettings,
  system: SystemSettings,
  ai: AISettings,
  developer: DeveloperSettings,
  about: AboutSettings,
};
const sections = [
  { id: 'exchanges' as const, label: 'API 配置', icon: KeyRound },
  { id: 'display' as const, label: '显示设置', icon: BarChart3 },
  { id: 'appearance' as const, label: '外观', icon: Palette },
  { id: 'system' as const, label: '系统', icon: Monitor },
  { id: 'ai' as const, label: 'AI 分析', icon: Sparkles },
  { id: 'developer' as const, label: '开发者', icon: Wrench },
  { id: 'about' as const, label: '关于', icon: CircleHelp },
];
const title = computed(
  () => sections.find((section) => section.id === props.page)?.label || '设置'
);
function navigate(page: SettingsPage) {
  props.model.formError = '';
  props.model.formSuccess = '';
  emit('update:page', page);
}
function summary(page: SettingsPage) {
  const model = props.model;
  if (page === 'exchanges')
    return model.configuredExchanges.length
      ? `${model.configuredExchanges.length} 个已配置`
      : '尚未配置';
  if (page === 'display') return `${model.preferences.refreshInterval} 秒刷新`;
  if (page === 'appearance')
    return `${model.preferences.dark ? '深色' : '浅色'} · ${Math.round(model.preferences.windowOpacity * 100)}%`;
  if (page === 'system') return model.preferences.proxyUrl ? '已设置代理' : '直连';
  if (page === 'ai')
    return model.preferences.aiEnabled
      ? providers.find((item) => item.id === model.preferences.defaultProvider)?.name
      : '未启用';
  if (page === 'developer') return model.preferences.debugMode ? '调试已开启' : '';
  return model.appVersion ? `v${model.appVersion}` : '';
}
</script>
<template>
  <section class="screen settings-screen" aria-labelledby="settings-title">
    <header class="screen-header">
      <button
        class="icon-button"
        :aria-label="page === 'index' ? '返回持仓' : '返回设置'"
        @click="page === 'index' ? emit('close') : navigate('index')"
      >
        <ArrowLeft :size="19" />
      </button>
      <h1 id="settings-title" tabindex="-1">{{ title }}</h1>
      <span v-if="model.saving" class="header-end muted small-text" role="status">正在保存…</span>
    </header>
    <div :key="page" class="screen-body settings-body">
      <template v-if="page === 'index'">
        <p class="page-intro">管理连接，专注每一次变化。</p>
        <nav aria-label="设置分类" class="settings-navigation">
          <button
            v-for="section in sections"
            :key="section.id"
            class="settings-link"
            @click="navigate(section.id)"
          >
            <component :is="section.icon" :size="19" /><span>{{ section.label }}</span>
            <span class="setting-summary">{{ summary(section.id) }}</span
            ><ChevronRight :size="16" class="muted" />
          </button>
        </nav>
        <div class="settings-brand">
          <span>Trade Realtime View</span><span class="helper">轻量、只读的菜单栏持仓监控</span>
        </div>
      </template>
      <component
        v-else
        :is="pageComponents[page]"
        :model="model"
        @confirm="emit('confirm', $event)"
      />
      <p v-if="model.formError" class="form-feedback error-feedback" role="alert">
        {{ model.formError }}
      </p>
      <p v-else-if="model.formSuccess" class="form-feedback" role="status">
        <Check :size="14" />{{ model.formSuccess }}
      </p>
    </div>
    <footer class="status-bar">
      <ShieldCheck :size="13" /><span>{{
        page === 'exchanges'
          ? '保存后将尝试获取账户数据'
          : page === 'ai'
            ? 'API Key 修改后需保存'
            : '普通设置更改后自动保存'
      }}</span>
    </footer>
  </section>
</template>
