<script setup lang="ts">
import { computed } from 'vue';
import { CircleHelp } from 'lucide-vue-next';
import ToggleRow from '../ToggleRow.vue';
import AppSelect from '../ui/AppSelect.vue';
import { menuValues } from '../../../../main/utils/menu-format';
import type { AppModel } from '../../composables/useTradingApp';

const props = defineProps<{ model: AppModel }>();
const previewPosition = computed(() => props.model.sortedPositions[0]);
const previewValues = computed(() =>
  previewPosition.value ? menuValues(previewPosition.value) : null
);
</script>
<template>
  <div class="setting-group">
    <label class="setting-row"
      ><span class="row-copy"
        ><span class="row-label">菜单栏显示数量</span
        ><span class="helper">在菜单栏展示前 1–2 个持仓</span></span
      >
      <AppSelect
        v-model="model.preferences.maxDisplayCount"
        label="菜单栏显示数量"
        :options="[{ value: 1, label: '1 个' }, { value: 2, label: '2 个' }]"
        :disabled="!!model.saving"
        @change="model.savePreference('display')"
      />
    </label>
    <label class="setting-row"
      ><span>刷新间隔</span
      ><AppSelect
        v-model="model.preferences.refreshInterval"
        label="刷新间隔"
        :options="[3, 5, 10, 30, 60].map(value => ({ value, label: value === 60 ? '1 分钟' : `${value} 秒` }))"
        :disabled="!!model.saving"
        @change="model.savePreference('display')"
      /></label
    >
    <ToggleRow
      v-model="model.preferences.hideAmounts"
      label="隐藏金额"
      description="同步隐藏持仓与账户金额"
      :disabled="!!model.saving"
      @change="model.savePreference('hideAmounts')"
    />
  </div>
  <section class="settings-section">
    <h2>菜单栏预览</h2>
    <div class="menubar-preview" aria-label="菜单栏格式预览">
      <template v-if="previewValues"
        ><span>{{ previewValues.symbol }}</span
        ><span>{{ model.mask(previewValues.price) }}</span
        ><span>{{ model.mask(previewValues.pnlText) }}</span
        ><span>{{ model.mask(previewValues.percentText) }}</span></template
      ><span v-else class="muted">暂无持仓</span>
    </div>
    <p class="helper">预览展示当前第一个持仓，排序在主页调整。</p>
  </section>
  <p class="inline-note">
    <CircleHelp :size="15" /><span>价格涨跌幅按开仓价计算，未计入杠杆。</span>
  </p>
</template>
