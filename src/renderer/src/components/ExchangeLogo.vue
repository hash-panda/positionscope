<template>
  <div class="exchange-logo-wrapper" :class="sizeClass">
    <img
      :src="logoUrl"
      :alt="exchangeName"
      class="exchange-logo"
      :title="exchangeName"
    />
    <span class="exchange-tooltip">{{ exchangeName }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  exchange: 'binance' | 'bybit' | 'okx' | 'hyperliquid';
  size?: 'small' | 'medium' | 'large';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium'
});

const exchangeNames: Record<string, string> = {
  binance: '币安',
  bybit: 'Bybit',
  okx: 'OKX',
  hyperliquid: 'Hyperliquid',
};

const exchangeName = computed(() => exchangeNames[props.exchange] || props.exchange);

const logoUrl = computed(() => {
  // Vite会自动处理public目录中的文件
  return `/logos/${props.exchange}.svg`;
});

const sizeClass = computed(() => `size-${props.size}`);
</script>

<style scoped>
.exchange-logo-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.exchange-logo {
  display: block;
  object-fit: contain;
}

/* 尺寸变体 */
.size-small .exchange-logo {
  width: 16px;
  height: 16px;
}

.size-medium .exchange-logo {
  width: 20px;
  height: 20px;
}

.size-large .exchange-logo {
  width: 24px;
  height: 24px;
}

/* Tooltip 样式 */
.exchange-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.9);
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.exchange-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}

.exchange-logo-wrapper:hover .exchange-tooltip {
  opacity: 1;
}

/* 深色模式 tooltip */
:root.dark-mode .exchange-tooltip {
  background: rgba(255, 255, 255, 0.95);
  color: #1d1d1f;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

:root.dark-mode .exchange-tooltip::after {
  border-top-color: rgba(255, 255, 255, 0.95);
}
</style>
