<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import { amount, signed } from '../../utils/format';
import type { AppModel } from '../../composables/useTradingApp';

defineProps<{ model: AppModel }>();
</script>
<template>
  <section class="settings-section first">
    <h2>主题</h2>
    <div class="theme-options">
      <button
        v-for="dark in [true, false]"
        :key="String(dark)"
        :class="['theme-option', { selected: model.preferences.dark === dark }]"
        :aria-pressed="model.preferences.dark === dark"
        :disabled="!!model.saving"
        @click="
          model.preferences.dark = dark;
          model.savePreference('dark');
        "
      >
        <span :class="['theme-swatch', dark ? 'dark-swatch' : 'light-swatch']"
          ><span class="swatch-title" /><span /><span /><Check
            v-if="model.preferences.dark === dark"
            :size="15"
            class="theme-check" /></span
        ><span>{{ dark ? '深色' : '浅色' }}</span>
      </button>
    </div>
  </section>
  <div class="opacity-control">
    <label for="opacity">窗口透明度</label
    ><output for="opacity" class="numeric"
      >{{ Math.round(model.preferences.windowOpacity * 100) }}%</output
    >
    <input
      id="opacity"
      v-model.number="model.preferences.windowOpacity"
      type="range"
      min="0.3"
      max="1"
      step="0.05"
      :disabled="!!model.saving"
      @change="model.savePreference('windowOpacity')"
    />
    <span class="helper">30%</span><span class="helper align-right">100%</span>
  </div>
  <section class="settings-section">
    <h2>界面预览</h2>
    <div class="appearance-preview">
      <span class="muted">总资产</span
      ><strong class="numeric"
        >{{ model.mask(amount(model.totals.totalAssets)) }} <small>USDT</small></strong
      ><span class="numeric" :class="model.totalPnL >= 0 ? 'positive' : 'negative'">{{
        model.mask(signed(model.totalPnL))
      }}</span>
    </div>
  </section>
</template>
