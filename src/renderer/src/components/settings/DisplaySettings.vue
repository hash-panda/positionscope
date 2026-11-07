<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Minus } from 'lucide-vue-next';
import ToggleRow from '../ToggleRow.vue';
import AppSelect from '../ui/AppSelect.vue';
import AppTextInput from '../ui/AppTextInput.vue';
import { menuValues, priceText } from '../../../../main/utils/menu-format';
import { validateWatchlistSymbols } from '../../../../main/utils/display-preferences';
import type { AppModel } from '../../composables/useTradingApp';

const props = defineProps<{ model: AppModel }>();
const previewValues = computed(() => props.model.sortedPositions[0] ? menuValues(props.model.sortedPositions[0]) : null);
const watchlistDraft = ref(props.model.preferences.watchlistSymbols.join(', '));
const watchlistError = ref('');
watch(() => props.model.preferences.watchlistSymbols, value => { watchlistDraft.value = value.join(', '); });
async function saveWatchlist() {
  watchlistError.value = '';
  try {
    const symbols = watchlistDraft.value.trim() ? watchlistDraft.value.split(/[,，\s]+/u).filter(Boolean).map(value => value.toUpperCase()) : [];
    props.model.preferences.watchlistSymbols = validateWatchlistSymbols(symbols);
    await props.model.savePreference('display');
  } catch (error) { watchlistError.value = error instanceof Error ? error.message : '观察币种无效'; }
}
</script>
<template>
  <div class="setting-group">
    <label class="setting-row"><span class="row-copy"><span class="row-label">菜单栏显示数量</span><span class="helper">按持仓顺序显示</span></span>
      <AppSelect v-model="model.preferences.maxDisplayCount" label="菜单栏显示数量" :options="[{ value: 1, label: '1 个' }, { value: 2, label: '2 个' }]" :disabled="!!model.saving" @change="model.savePreference('display')" />
    </label>
    <label class="setting-row"><span>刷新间隔</span><AppSelect v-model="model.preferences.refreshInterval" label="刷新间隔" :options="[3, 5, 10, 30, 60].map(value => ({ value, label: value === 60 ? '1 分钟' : `${value} 秒` }))" :disabled="!!model.saving" @change="model.savePreference('display')" /></label>
    <label class="setting-row"><span class="row-copy"><span class="row-label">涨跌配色</span><span class="helper">菜单栏与应用同步</span></span><AppSelect v-model="model.preferences.colorScheme" label="涨跌配色" :options="[{ value: 'green-up' as const, label: '绿涨红跌' }, { value: 'red-up' as const, label: '红涨绿跌' }]" :disabled="!!model.saving" @change="model.savePreference('display')" /></label>
    <ToggleRow v-model="model.preferences.hideAmounts" label="隐藏金额" description="金额与盈亏方向同时隐藏" :disabled="!!model.saving" @change="model.savePreference('hideAmounts')" />
  </div>
  <section class="settings-section">
    <h2>菜单栏预览</h2>
    <div class="menubar-preview" aria-label="菜单栏格式预览">
      <span aria-hidden="true"><Minus :size="16" /></span>
      <template v-if="previewValues"><span>{{ previewValues.symbol }}</span><span>{{ model.mask(priceText(Number(model.sortedPositions[0].markPrice))) }}</span></template>
      <span v-else class="muted">暂无持仓</span>
    </div>
    <p class="helper">显示币种与标记价（USDT）。箭头比较上次有效报价，彩色图标对应第一个币种；首笔、价格不变或数据过期时为中性。≥100 显示两位小数，低价币保留更多有效位。</p>
  </section>
  <section class="settings-section">
    <h2>观察币种</h2>
    <form class="watchlist-form" @submit.prevent="saveWatchlist">
      <label for="watchlist-symbols" class="helper">最多 8 个 USDT 永续合约，用逗号分隔</label>
      <AppTextInput id="watchlist-symbols" v-model="watchlistDraft" placeholder="BTCUSDT, ETHUSDT" :disabled="!!model.saving" :invalid="!!watchlistError" aria-describedby="watchlist-help" autocomplete="off" :spellcheck="false" maxlength="720" />
      <p id="watchlist-help" class="helper">保存时核对 Binance 当前合约；留空可关闭行情参考。</p>
      <p v-if="watchlistError" class="danger-text small-text" role="alert">{{ watchlistError }}</p>
      <button class="button secondary compact-button" :disabled="!!model.saving">保存观察币种</button>
    </form>
  </section>
</template>
<style scoped>
.watchlist-form { display: grid; gap: 8px; }
.watchlist-form .button { justify-self: start; }
.menubar-preview { flex-wrap: wrap; }
.menubar-preview > span:first-child { display: inline-flex; align-items: center; }
</style>
