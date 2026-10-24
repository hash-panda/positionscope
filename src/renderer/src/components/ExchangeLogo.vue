<script setup lang="ts">
import { computed } from 'vue';
import type { Exchange } from '../types';
import { exchanges } from '../types';
const props = withDefaults(
  defineProps<{ exchange: Exchange; size?: 'small' | 'medium' | 'large' }>(),
  { size: 'medium' }
);
const name = computed(
  () => exchanges.find((item) => item.id === props.exchange)?.name || props.exchange
);
const logo = computed(() => `${import.meta.env.BASE_URL}logos/${props.exchange}.svg`);
</script>

<template>
  <span class="exchange-logo" :class="size" role="img" :aria-label="name" :title="name"
    ><img :src="logo" alt=""
  /></span>
</template>

<style scoped>
.exchange-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
.exchange-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.exchange-logo.small {
  width: 16px;
  height: 16px;
}
.exchange-logo.large {
  width: 24px;
  height: 24px;
}
</style>
