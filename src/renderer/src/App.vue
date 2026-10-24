<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  ChevronRight,
  Eye,
  EyeOff,
  Inbox,
  KeyRound,
  MoreHorizontal,
  Power,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-vue-next';
import { useTradingApp } from './composables/useTradingApp';
import type { Exchange, NoticeInput, SettingsPage } from './types';
import { exchanges } from './types';
import { amount, direction, signed } from './utils/format';
import ConfirmDialog from './components/ConfirmDialog.vue';
import ExchangeLogo from './components/ExchangeLogo.vue';
import HealthPanel from './components/HealthPanel.vue';
import NotificationCenter from './components/NotificationCenter.vue';
import PositionList from './components/PositionList.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import ActivityPanel from './components/ActivityPanel.vue';

const notificationCenter = ref<InstanceType<typeof NotificationCenter>>();
const notificationsOpen = ref(false);
const unread = ref(0);
const app = reactive(
  useTradingApp((notice: NoticeInput) => notificationCenter.value?.addNotification(notice))
);
const settingsPage = ref<SettingsPage>('index');
const moreOpen = ref(false);
const menu = ref<HTMLElement>();
const moreButton = ref<HTMLButtonElement>();
const notificationButton = ref<HTMLButtonElement>();
const mainTitle = ref<HTMLElement>();
const confirmation = ref<'quit' | 'delete' | 'reset' | Exchange | null>(null);
const confirmError = ref('');
const confirmBusy = ref(false);
const staleExchanges = computed(() => app.exchangeErrors.map((item) => item.exchange));
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
      body: '将删除交易所凭证、AI 配置、持仓顺序和应用设置。此操作无法撤销。',
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
function openSettings(page: SettingsPage = 'index') {
  settingsPage.value = page;
  app.currentView = 'settings';
  moreOpen.value = false;
}
function askConfirmation(action: NonNullable<typeof confirmation.value>) {
  confirmError.value = '';
  confirmation.value = action;
  moreOpen.value = false;
}
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
async function analyze() {
  const result = await app.analyze();
  if (result === false) settingsPage.value = 'ai';
}
function connectionLabel(exchange: Exchange) {
  if (app.exchangeErrors.some((item) => item.exchange === exchange)) return '连接异常';
  return app.accounts.some((item) => item.exchange === exchange) && !app.error
    ? '已连接'
    : '等待同步';
}
function closeMenu(event: PointerEvent) {
  if (
    !menu.value?.contains(event.target as Node) &&
    !moreButton.value?.contains(event.target as Node)
  )
    moreOpen.value = false;
}
function handleEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || confirmation.value) return;
  if (moreOpen.value) {
    moreOpen.value = false;
    moreButton.value?.focus();
  } else if (notificationsOpen.value) notificationsOpen.value = false;
  else if (app.currentView === 'settings' && settingsPage.value !== 'index')
    settingsPage.value = 'index';
  else if (app.currentView !== 'overview') app.currentView = 'overview';
}
watch([() => app.currentView, settingsPage], async () => {
  await nextTick();
  document.querySelector<HTMLElement>('.screen h1')?.focus();
});
watch(notificationsOpen, async (open) => {
  if (!open) {
    await nextTick();
    notificationButton.value?.focus();
  }
});
onMounted(() => {
  document.addEventListener('pointerdown', closeMenu);
  document.addEventListener('keydown', handleEscape);
});
onUnmounted(() => {
  document.removeEventListener('pointerdown', closeMenu);
  document.removeEventListener('keydown', handleEscape);
});
</script>

<template>
  <div class="app" :class="{ 'light-mode': !app.preferences.dark }">
    <template v-if="!notificationsOpen">
      <SettingsPanel
        v-if="app.currentView === 'settings'"
        v-model:page="settingsPage"
        :model="app"
        @close="app.currentView = 'overview'"
        @confirm="askConfirmation"
      />
      <ActivityPanel v-else-if="app.currentView === 'activity'" :model="app" @close="app.currentView = 'overview'" />
      <HealthPanel
        v-else-if="app.currentView === 'health' && app.healthScore"
        :score="app.healthScore"
        :provider="app.analysisProvider"
        :time="app.analysisTime"
        :analyzing="app.analyzing"
        :hidden="app.preferences.hideAmounts"
        @close="app.currentView = 'overview'"
        @analyze="analyze"
      />
      <section v-else-if="app.currentView === 'sort'" class="screen" aria-labelledby="sort-title">
        <header class="screen-header">
          <button
            class="icon-button"
            aria-label="取消排序"
            :disabled="!!app.saving"
            @click="app.currentView = 'overview'"
          >
            <ArrowLeft :size="19" />
          </button>
          <h1 id="sort-title" tabindex="-1">调整顺序</h1>
          <button
            class="text-button subdued header-end"
            :disabled="!!app.saving"
            @click="app.currentView = 'overview'"
          >
            取消
          </button>
        </header>
        <div class="screen-body">
          <p class="page-intro">上下移动，决定持仓与菜单栏的展示顺序。</p>
          <PositionList
            :positions="app.sortedPositions"
            :hidden="app.preferences.hideAmounts"
            sorting
            @move="app.movePosition"
          />
          <p v-if="app.formError" class="form-feedback error-feedback" role="alert">
            {{ app.formError }}
          </p>
        </div>
        <footer class="sort-footer">
          <button class="button primary full-width" :disabled="!!app.saving" @click="app.saveOrder">
            {{ app.saving ? '正在保存…' : '保存顺序' }}
          </button>
        </footer>
      </section>
      <section v-else class="screen overview-screen" aria-labelledby="overview-title">
        <header class="screen-header overview-header">
          <div class="wordmark"><span class="brand-mark" aria-hidden="true">p.</span><div><h1 id="overview-title" ref="mainTitle" tabindex="-1">持仓盈亏</h1><span class="product-caption">PositionScope · 仓位镜</span></div></div>
          <div class="header-actions">
            <button
              ref="notificationButton"
              class="icon-button notification-button"
              :aria-label="`通知中心${unread ? `，${unread} 条未读` : ''}`"
              @click="notificationsOpen = true"
            >
              <Bell :size="18" /><span v-if="unread" class="notification-count">{{
                unread > 99 ? '99+' : unread
              }}</span>
            </button>
            <button class="icon-button" aria-label="设置" @click="openSettings()">
              <Settings :size="18" />
            </button>
            <div class="more-menu-wrapper">
              <button
                ref="moreButton"
                class="icon-button"
                aria-label="更多操作"
                aria-haspopup="true"
                :aria-expanded="moreOpen"
                @click="moreOpen = !moreOpen"
              >
                <MoreHorizontal :size="20" />
              </button>
              <div v-if="moreOpen" ref="menu" class="more-menu">
                <button @click="app.currentView = 'activity'; moreOpen = false"><SlidersHorizontal :size="15" />持仓动态 · 交易室</button>
                <button
                  :disabled="!app.hasCredentials || app.loading"
                  @click="
                    app.fetchData();
                    moreOpen = false;
                  "
                >
                  <RefreshCw :size="15" />刷新数据</button
                ><button
                  @click="
                    app.api?.minimizeWindow();
                    moreOpen = false;
                  "
                >
                  <X :size="15" />收起窗口</button
                ><button class="danger-text" @click="askConfirmation('quit')">
                  <Power :size="15" />退出应用
                </button>
              </div>
            </div>
          </div>
        </header>
        <main class="screen-body overview-body">
          <template v-if="!app.ready"
            ><div class="skeleton-overview" role="status" aria-label="正在加载账户">
              <div class="skeleton line short" />
              <div class="skeleton number" />
              <div class="skeleton line" />
              <div class="skeleton group" />
              <div class="skeleton group" /></div
          ></template>
          <template v-else>
            <div
              v-if="app.error || app.exchangeErrors.length"
              class="connection-warning"
              role="status"
            >
              <AlertTriangle :size="17" />
              <div>
                <strong>{{ app.exchangeErrors.length ? '部分交易所连接异常' : app.error }}</strong>
                <p>
                  {{
                    app.positions.length || app.accounts.length
                      ? '保留上次数据，请以连接恢复后的数据为准。'
                      : '请检查凭证或网络后重试。'
                  }}
                </p>
                <details v-if="app.exchangeErrors.length">
                  <summary>查看连接详情</summary>
                  <div v-for="item in app.exchangeErrors" :key="item.exchange" class="error-detail">
                    <strong>{{ item.exchange.toUpperCase() }} · {{ item.errorCode }}</strong>
                    <p>{{ item.suggestion }}</p>
                  </div>
                </details>
                <div class="inline-actions">
                  <button class="text-button" :disabled="app.loading" @click="app.retry">
                    {{ app.loading ? '正在连接…' : '重新连接' }}</button
                  ><button class="text-button subdued" @click="openSettings('exchanges')">
                    检查配置<ArrowUpRight :size="13" />
                  </button>
                </div>
              </div>
            </div>
            <div v-if="!app.hasCredentials" class="empty-state onboarding">
              <span class="empty-symbol"><KeyRound :size="28" /></span>
              <h2>连接你的第一个交易所</h2>
              <p>配置只读凭证，在菜单栏查看资产与持仓。</p>
              <div class="exchange-preview">
                <ExchangeLogo
                  v-for="exchange in exchanges"
                  :key="exchange.id"
                  :exchange="exchange.id"
                />
              </div>
              <button
                class="button primary"
                :disabled="!app.api"
                @click="openSettings('exchanges')"
              >
                配置交易所</button
              ><span class="helper">支持 Binance、Bybit、OKX、Hyperliquid</span>
            </div>
            <template v-else>
              <section class="asset-summary" aria-label="资产概览">
                <div class="asset-label">
                  <span>总资产</span
                  ><button
                    class="icon-button small"
                    :aria-label="app.preferences.hideAmounts ? '显示金额' : '隐藏金额'"
                    :aria-pressed="app.preferences.hideAmounts"
                    :disabled="!!app.saving"
                    @click="
                      app.preferences.hideAmounts = !app.preferences.hideAmounts;
                      app.savePreference('hideAmounts');
                    "
                  >
                    <EyeOff v-if="app.preferences.hideAmounts" :size="15" /><Eye
                      v-else
                      :size="15"
                    /></button
                  ><span v-if="app.stale" class="data-stale-label">含上次数据</span>
                </div>
                <div class="asset-total numeric">
                  {{ app.accounts.length ? app.mask(amount(app.totals.totalAssets)) : '暂无'
                  }}<span>USDT</span>
                </div>
                <div class="total-pnl-row">
                  <span class="muted">未实现盈亏</span
                  ><strong class="numeric" :class="direction(app.totalPnL)">{{
                    app.mask(signed(app.totalPnL))
                  }}</strong
                  ><span class="currency">USDT</span>
                </div>
                <dl class="asset-breakdown">
                  <div>
                    <dt>现货资产</dt>
                    <dd class="numeric">
                      {{ app.accounts.length ? app.mask(amount(app.totals.spot)) : '暂无' }}
                    </dd>
                  </div>
                  <div>
                    <dt>合约权益</dt>
                    <dd class="numeric">
                      {{ app.accounts.length ? app.mask(amount(app.totals.margin)) : '暂无' }}
                    </dd>
                  </div>
                  <div>
                    <dt>可用余额</dt>
                    <dd class="numeric">
                      {{ app.accounts.length ? app.mask(amount(app.totals.available)) : '暂无' }}
                    </dd>
                  </div>
                </dl>
              </section>
              <details class="account-disclosure"><summary><span>账户连接 <span class="count numeric">{{ app.configuredExchanges.length }}</span></span><span class="muted">{{ app.stale ? '连接需关注' : '查看明细' }} <ChevronRight :size="13" /></span></summary>              <div class="exchange-status-list" aria-label="交易所连接状态">
                <div
                  v-for="exchange in app.configuredExchanges"
                  :key="exchange.id"
                  class="exchange-status"
                >
                  <button class="exchange-name" @click="openSettings('exchanges')">
                    <ExchangeLogo :exchange="exchange.id" /><span>{{ exchange.name }}</span></button
                  ><span
                    class="connection-state"
                    :class="{ 'warning-text': staleExchanges.includes(exchange.id) }"
                    ><span
                      v-if="connectionLabel(exchange.id) === '已连接'"
                      class="connection-dot"
                    />{{ connectionLabel(exchange.id) }}</span
                  >
                  <details
                    v-if="
                      app.configuredExchanges.length > 1 &&
                      app.accounts.some((item) => item.exchange === exchange.id)
                    "
                    class="exchange-account-detail"
                  >
                    <summary aria-label="查看交易所资产"><ChevronRight :size="15" /></summary>
                    <dl
                      v-for="account in app.accounts.filter(
                        (item) => item.exchange === exchange.id
                      )"
                      :key="account.exchange"
                    >
                      <div>
                        <dt>{{ exchange.id === 'okx' ? '资金账户' : '现货资产' }}</dt>
                        <dd>
                          {{
                            app.mask(
                              amount(
                                exchange.id === 'okx'
                                  ? (account.fundingAccountUSDT ?? 0)
                                  : (account.spotTotalUSDT ?? 0)
                              )
                            )
                          }}
                        </dd>
                      </div>
                      <div>
                        <dt>{{ exchange.id === 'okx' ? '交易账户' : '合约权益' }}</dt>
                        <dd>
                          {{
                            app.mask(
                              amount(
                                exchange.id === 'okx'
                                  ? (account.tradingAccountUSDT ?? 0)
                                  : account.totalMarginBalance
                              )
                            )
                          }}
                        </dd>
                      </div>
                      <div>
                        <dt>未实现盈亏</dt>
                        <dd :class="direction(account.totalUnrealizedProfit)">
                          {{ app.mask(signed(account.totalUnrealizedProfit)) }}
                        </dd>
                      </div>
                    </dl>
                  </details>
                </div>
              </div>
</details>
              <button
                v-if="app.sortedPositions.length"
                class="button secondary full-width analysis-button"
                :disabled="app.analyzing || app.loading || app.stale"
                @click="analyze"
              >
                <Sparkles :size="16" />{{ app.analyzing ? '正在分析持仓…' : 'AI 持仓分析'
                }}<ChevronRight v-if="!app.analyzing" :size="14" class="header-end" />
              </button>              <div class="section-heading positions-heading">
                <h2>
                  持仓<span class="count numeric">{{ app.sortedPositions.length }}</span>
                </h2>
                <button
                  class="text-button"
                  :disabled="app.sortedPositions.length < 2"
                  @click="app.beginSort"
                >
                  <SlidersHorizontal :size="14" />调整顺序
                </button>
              </div>
              <PositionList
                v-if="app.sortedPositions.length"
                :positions="app.sortedPositions"
                :hidden="app.preferences.hideAmounts"
                :stale-exchanges="staleExchanges"
              />
              <div v-else class="empty-state compact">
                <Inbox :size="26" />
                <h2>{{ app.stale ? '持仓暂不可用' : '暂无持仓' }}</h2>
                <p>
                  {{ app.stale ? '连接恢复后会自动更新。' : '账户已连接，有持仓后会自动显示。' }}
                </p>
              </div>

            </template>
          </template>
        </main>
        <footer class="status-bar">
          <button
            class="icon-button small"
            aria-label="刷新数据"
            :disabled="!app.hasCredentials || app.loading || !app.ready"
            @click="app.fetchData"
          >
            <RefreshCw :size="14" :class="{ spinning: app.loading }" /></button
          ><span>{{
            app.loading
              ? '正在更新…'
              : app.stale
                ? '数据未完整更新'
                : app.lastUpdated
                  ? `更新于 ${app.lastUpdated.toLocaleTimeString('zh-CN', { hour12: false })}`
                  : '等待连接'
          }}</span
          ><span class="status-end">每 {{ app.preferences.refreshInterval }} 秒刷新</span>
        </footer>
      </section>
    </template>
    <NotificationCenter
      ref="notificationCenter"
      v-model:open="notificationsOpen"
      @unread-change="unread = $event"
    />
    <ConfirmDialog
      v-if="confirmation"
      :title="confirmationCopy.title"
      :confirm-label="confirmationCopy.button"
      :danger="confirmationCopy.danger"
      :busy="confirmBusy"
      @close="confirmation = null"
      @confirm="confirmAction"
      ><p>{{ confirmationCopy.body }}</p>
      <p v-if="confirmError" class="error-feedback" role="alert">
        {{ confirmError }}
      </p></ConfirmDialog
    >
  </div>
</template>
