<script setup lang="ts">
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-vue-next';
import type { Position, Exchange } from '../types';
import { positionKey } from '../../../main/utils/position-order';
import { amount, direction, price, priceChange, signed, symbol } from '../utils/format';
import ExchangeLogo from './ExchangeLogo.vue';
defineProps<{
  positions: Position[];
  sorting?: boolean;
  hidden: boolean;
  staleExchanges?: Exchange[];
}>();
defineEmits<{ move: [index: number, offset: number] }>();
</script>

<template>
  <ol
    class="position-list"
    :class="{ 'sorting-list': sorting }"
    :aria-label="sorting ? '调整持仓顺序' : '持仓列表'"
  >
    <li
      v-for="(position, index) in positions"
      :key="positionKey(position)"
      class="position-item"
      :class="{ 'stale-position': staleExchanges?.includes(position.exchange) }"
      :data-position="positionKey(position)"
    >
      <template v-if="sorting">
        <span class="position-number numeric">{{ String(index + 1).padStart(2, '0') }}</span>
        <ExchangeLogo :exchange="position.exchange" />
        <div class="sort-copy">
          <strong
            >{{
              position.exchange === 'binance'
                ? 'Binance'
                : position.exchange === 'okx'
                  ? 'OKX'
                  : position.exchange === 'bybit'
                    ? 'Bybit'
                    : 'Hyperliquid'
            }}
            · {{ symbol(position.symbol) }}</strong
          >
          <div class="position-tags">
            <span class="tag" :class="Number(position.positionAmt) > 0 ? 'positive' : 'negative'">{{
              Number(position.positionAmt) > 0 ? '做多' : '做空'
            }}</span
            ><span class="tag">{{ position.leverage }}×</span>
          </div>
        </div>
        <div class="sort-actions">
          <button
            class="icon-button outlined"
            :aria-label="`上移 ${position.exchange} ${symbol(position.symbol)}`"
            :disabled="index === 0"
            @click="$emit('move', index, -1)"
          >
            <ArrowUp :size="17" /></button
          ><button
            class="icon-button outlined"
            :aria-label="`下移 ${position.exchange} ${symbol(position.symbol)}`"
            :disabled="index === positions.length - 1"
            @click="$emit('move', index, 1)"
          >
            <ArrowDown :size="17" />
          </button>
        </div>
      </template>
      <template v-else>
        <div class="position-top">
          <div class="position-identity">
            <ExchangeLogo :exchange="position.exchange" /><strong>{{
              symbol(position.symbol)
            }}</strong
            ><span class="tag leverage-tag">{{ position.leverage }}×</span
            ><span
              class="tag"
              :class="Number(position.positionAmt) > 0 ? 'positive' : 'negative'"
              >{{ Number(position.positionAmt) > 0 ? '多' : '空' }}</span
            >
          </div>
          <div class="position-pnl numeric" :class="direction(position.unRealizedProfit)">
            {{ hidden ? '••••••' : signed(position.unRealizedProfit) }}<small>USDT</small>
          </div>
        </div>
        <div class="position-secondary">
          <span class="muted small-text"
            >{{
              position.exchange === 'binance'
                ? 'Binance'
                : position.exchange === 'okx'
                  ? 'OKX'
                  : position.exchange === 'bybit'
                    ? 'Bybit'
                    : 'Hyperliquid'
            }}<span v-if="staleExchanges?.includes(position.exchange)" class="warning-text">
              · 上次数据</span
            ></span
          >
          <span class="price-change"
            ><span class="muted">{{
              Number(position.positionAmt) > 0 ? '价格涨跌幅' : '方向涨跌幅'
            }}</span
            ><span
              class="numeric"
              :class="
                direction(
                  (Number(position.markPrice) - Number(position.entryPrice)) *
                    (Number(position.positionAmt) < 0 ? -1 : 1)
                )
              "
              >{{ hidden ? '••••' : priceChange(position) }}</span
            ></span
          >
        </div>
        <details class="position-details">
          <summary><span>价格与仓位详情</span><ChevronDown :size="13" /></summary>
        <dl class="position-prices">
          <div>
            <dt>开仓价</dt>
            <dd class="numeric">{{ price(position.entryPrice) }}</dd>
          </div>
          <div>
            <dt>标记价</dt>
            <dd class="numeric">{{ price(position.markPrice) }}</dd>
          </div>
          <div>
            <dt>名义价值 <span>USDT</span></dt>
            <dd class="numeric">
              {{
                hidden
                  ? '••••••'
                  : amount(Math.abs(Number(position.positionAmt)) * Number(position.markPrice))
              }}
            </dd>
          </div>
        </dl>
          <p class="position-margin helper">{{ position.marginType === 'isolated' ? '逐仓' : '全仓' }} · {{ hidden ? '••••' : Math.abs(Number(position.positionAmt)) }} {{ symbol(position.symbol) }}</p>
        </details>
      </template>
    </li>
  </ol>
</template>
