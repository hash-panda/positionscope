# 交易所 Logo 使用指南

## 概述

应用使用 SVG 格式的交易所 logo 来标识不同的交易所，配合 tooltip 提示交易所名称。

## Logo 文件位置

所有 logo 文件存放在：
```
src/renderer/public/logos/
├── binance.svg       # 币安
├── bybit.svg         # Bybit
├── okx.svg           # OKX
└── hyperliquid.svg   # Hyperliquid
```

## ExchangeLogo 组件

### 使用方法

```vue
<template>
  <ExchangeLogo :exchange="'binance'" size="medium" />
</template>

<script setup>
import ExchangeLogo from './components/ExchangeLogo.vue';
</script>
```

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| exchange | 'binance' \| 'bybit' \| 'okx' \| 'hyperliquid' | - | 交易所类型（必填） |
| size | 'small' \| 'medium' \| 'large' | 'medium' | Logo 尺寸 |

### 尺寸规格

- **small**: 16x16px - 用于持仓卡片
- **medium**: 20x20px - 用于资产卡片
- **large**: 24x24px - 用于其他大型展示

### Tooltip 功能

鼠标悬停在 logo 上时，会显示交易所的中文名称：
- binance → "币安"
- bybit → "Bybit"
- okx → "OKX"
- hyperliquid → "Hyperliquid"

## 添加新交易所 Logo

### 步骤 1: 准备 SVG 文件

在 `src/renderer/public/logos/` 目录下添加新的 SVG 文件，命名格式：`[交易所名].svg`

**SVG 要求：**
- 正方形比例（如 240x240）
- 矢量图形
- 文件大小 < 5KB
- 包含交易所品牌颜色

### 步骤 2: 更新 TypeScript 类型

编辑 `src/renderer/src/components/ExchangeLogo.vue`：

```typescript
interface Props {
  exchange: 'binance' | 'bybit' | 'okx' | 'hyperliquid' | '新交易所';
  size?: 'small' | 'medium' | 'large';
}
```

### 步骤 3: 添加中文名称映射

```typescript
const exchangeNames: Record<string, string> = {
  binance: '币安',
  bybit: 'Bybit',
  okx: 'OKX',
  hyperliquid: 'Hyperliquid',
  新交易所ID: '新交易所中文名',
};
```

### 步骤 4: 更新交易所类型枚举

编辑 `src/main/types/exchange.ts` 和 `src/renderer/src/App.vue`：

```typescript
export enum ExchangeType {
  BINANCE = 'binance',
  BYBIT = 'bybit',
  OKX = 'okx',
  HYPERLIQUID = 'hyperliquid',
  NEW_EXCHANGE = 'new_exchange',  // 新增
}
```

### 步骤 5: 测试

```bash
npm run build
npm run dev
```

## SVG Logo 设计建议

### 品牌颜色

使用交易所的官方品牌颜色：
- 币安：`#F3BA2F`（黄色）
- Bybit：`#F7A600`（橙色）
- OKX：`#000000`（黑色）
- Hyperliquid：`#00D4AA`（青色）

### 设计原则

1. **简洁明了** - Logo 应该在小尺寸下清晰可辨
2. **高对比度** - 确保在深色和浅色模式下都清晰
3. **矢量格式** - 使用 SVG 确保任意缩放都清晰
4. **优化文件** - 移除不必要的元数据，减小文件体积

### 工具推荐

- **在线 SVG 编辑器**: [Boxy SVG](https://boxy-svg.com)
- **SVG 优化**: [SVGOMG](https://jakearchibald.github.io/svgomg/)
- **Logo 提取**: 从官方网站下载 SVG 格式的 logo

## Tooltip 样式定制

Tooltip 样式在 `ExchangeLogo.vue` 中定义：

```css
.exchange-tooltip {
  background: rgba(0, 0, 0, 0.9);
  color: #ffffff;
  font-size: 12px;
  border-radius: 6px;
  /* ... */
}
```

**深色模式自动适配**：
```css
:root.dark-mode .exchange-tooltip {
  background: rgba(255, 255, 255, 0.95);
  color: #1d1d1f;
}
```

## 性能优化

### 1. SVG 文件优化

使用 SVGOMG 优化 SVG 文件：
- 移除编辑器元数据
- 精简路径
- 移除无用属性
- 压缩数值

### 2. 懒加载

大型应用可以考虑懒加载 logo：
```vue
<img :src="logoUrl" loading="lazy" />
```

### 3. 缓存

浏览器会自动缓存 SVG 文件，无需额外配置。

## 故障排除

### Logo 不显示

1. 检查文件路径是否正确
2. 确认 SVG 文件在 `public/logos/` 目录下
3. 检查文件命名是否与 `exchange` prop 匹配
4. 运行 `npm run build` 确保文件被复制

### Tooltip 不显示

1. 检查 CSS 样式是否正确加载
2. 确认 `:hover` 伪类生效
3. 检查 z-index 是否被其他元素遮挡

### 样式问题

1. 清除浏览器缓存
2. 检查 CSS 变量是否正确定义
3. 使用浏览器开发工具检查元素

## 示例代码

### 完整示例

```vue
<template>
  <div class="exchange-list">
    <div
      v-for="exchange in exchanges"
      :key="exchange"
      class="exchange-item"
    >
      <ExchangeLogo :exchange="exchange" size="medium" />
      <span class="exchange-name">{{ getExchangeName(exchange) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import ExchangeLogo from './components/ExchangeLogo.vue';

const exchanges = ['binance', 'bybit', 'okx', 'hyperliquid'];

const getExchangeName = (exchange: string) => {
  const names = {
    binance: '币安',
    bybit: 'Bybit',
    okx: 'OKX',
    hyperliquid: 'Hyperliquid',
  };
  return names[exchange] || exchange;
};
</script>

<style scoped>
.exchange-list {
  display: flex;
  gap: 16px;
}

.exchange-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
```

## 参考资源

- [SVG 教程](https://developer.mozilla.org/zh-CN/docs/Web/SVG)
- [Vue 组件设计](https://cn.vuejs.org/guide/components/basics.html)
- [CSS Tooltip 技巧](https://css-tricks.com/css-only-tooltips/)
