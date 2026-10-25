<script setup lang="ts">
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-vue-next';
import type { Position, Exchange } from '../types';
import { liquidationDistance } from '../../../main/utils/position-math';
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
const mode = (value: Position['marginType']) => ({cross:'全仓',isolated:'逐仓',portfolio:'组合保证金',unknown:'模式不可用'}[value] || '模式不可用');
const distance = (p: Position) => { const n = liquidationDistance(p); return n === null ? '不可用' : `${(n*100).toFixed(2)}%`; };

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
            ><span class="tag">{{ position.leverage ? `${position.leverage}×` : '杠杆不可用' }}</span>
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
            ><span class="tag leverage-tag">{{ position.leverage ? `${position.leverage}×` : '杠杆不可用' }}</span
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
          <div><dt>参考强平价</dt><dd class="numeric">{{ price(position.liquidationPrice) }}</dd></div>
          <div><dt>强平参考距离</dt><dd class="numeric">{{ distance(position) }}</dd></div>
          <div><dt>维持保证金 · {{ position.marginCurrency || '单位未知' }}</dt><dd class="numeric">{{ hidden ? '••••' : amount(position.maintenanceMargin) }}</dd></div>
          <div><dt>初始保证金 · {{ position.marginCurrency || '单位未知' }}</dt><dd class="numeric">{{ hidden ? '••••' : amount(position.initialMargin) }}</dd></div>
          <div v-if="position.usedMargin != null"><dt>已用保证金</dt><dd class="numeric">{{ hidden ? '••••' : amount(position.usedMargin) }}</dd></div>
          <div v-if="position.marginType === 'isolated'"><dt>逐仓抵押</dt><dd class="numeric">{{ hidden ? '••••' : amount(position.isolatedMargin) }}</dd></div>
        </dl>
          <p class="position-margin helper">{{ mode(position.marginType) }} · {{ hidden ? '••••' : Math.abs(Number(position.positionAmt)) }} {{ position.baseAsset || symbol(position.symbol) }}</p>
          <p v-if="position.rawQuantityUnit === 'contracts'" class="helper">原始张数 {{ hidden ? '••••' : amount(position.rawQuantity, 4) }} · 已按合约规格换算币数</p>
          <p class="helper">强平价是平台参考值，会随保证金与其他仓位变化；距离远不代表长期持有安全。</p>
          <p class="helper">{{ position.priceSource === 'position_value_derived' ? '标记价由名义价值/币数推导' : '交易所标记价' }} · 获取 {{ position.fetchedAt ? new Date(position.fetchedAt).toLocaleTimeString('zh-CN') : '时间不可用' }}</p>
        </details>
      </template>
    </li>
  </ol>
</template>
