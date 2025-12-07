# 添加新交易所指南

本指南介绍如何在应用中添加新的交易所支持（如 Bybit、OKX、Hyperliquid 等）。

## 架构概览

应用采用可扩展的多交易所架构：

```
src/main/
├── types/
│   └── exchange.ts          # 交易所接口和类型定义
├── services/
│   ├── binance.ts           # 币安实现
│   ├── exchangeManager.ts   # 交易所管理器
│   └── [新交易所].ts        # 新交易所实现
```

## 步骤 1: 在 types/exchange.ts 中添加交易所类型

```typescript
export enum ExchangeType {
  BINANCE = 'binance',
  BYBIT = 'bybit',      // 添加新交易所
  OKX = 'okx',
  HYPERLIQUID = 'hyperliquid',
}

export const ExchangeNames: Record<ExchangeType, string> = {
  [ExchangeType.BINANCE]: '币安',
  [ExchangeType.BYBIT]: 'Bybit',  // 添加显示名称
  // ...
};

export const ExchangeColors: Record<ExchangeType, string> = {
  [ExchangeType.BINANCE]: '#F3BA2F',
  [ExchangeType.BYBIT]: '#F7A600',  // 添加品牌颜色
  // ...
};
```

## 步骤 2: 实现交易所服务类

创建 `src/main/services/[交易所名].ts`，实现 `IExchangeService` 接口：

```typescript
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import {
  IExchangeService,
  ExchangeType,
  ExchangeCredentials,
  Position,
  AccountInfo,
  SpotBalance,
} from '../types/exchange';

export class BybitService implements IExchangeService {
  private apiKey: string = '';
  private apiSecret: string = '';
  private client: AxiosInstance;
  private readonly exchangeType = ExchangeType.BYBIT;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.bybit.com',
      timeout: 30000,
    });
  }

  getExchangeType(): ExchangeType {
    return this.exchangeType;
  }

  setCredentials(credentials: ExchangeCredentials): void {
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;
    // 设置代理等...
  }

  hasCredentials(): boolean {
    return !!this.apiKey && !!this.apiSecret;
  }

  async getFuturesPositions(): Promise<Position[]> {
    // 实现获取持仓逻辑
    // 1. 调用交易所 API
    // 2. 转换为统一的 Position 格式
    // 3. 添加 exchange: this.exchangeType
    return [];
  }

  async getFuturesAccountInfo(): Promise<AccountInfo> {
    // 实现获取账户信息逻辑
    // 返回包含 exchange: this.exchangeType 的 AccountInfo
    return {
      exchange: this.exchangeType,
      totalWalletBalance: 0,
      totalUnrealizedProfit: 0,
      totalMarginBalance: 0,
      availableBalance: 0,
      maxWithdrawAmount: 0,
    };
  }

  async getSpotBalances(): Promise<SpotBalance[]> {
    // 实现获取现货余额逻辑
    return [];
  }
}
```

## 步骤 3: 在 ExchangeManager 中注册

编辑 `src/main/services/exchangeManager.ts`：

```typescript
import { BybitService } from './bybit';  // 导入新服务

export class ExchangeManager {
  constructor() {
    this.exchanges.set(ExchangeType.BINANCE, new BinanceService());
    this.exchanges.set(ExchangeType.BYBIT, new BybitService());  // 注册新服务
    // ...
  }
}
```

## 步骤 4: 更新 UI（可选）

如果需要在设置面板中添加交易所配置，编辑 `src/renderer/src/App.vue`。

交易所徽章会自动显示，颜色基于 `ExchangeColors` 配置。

## 步骤 5: 测试

```bash
# 构建
npm run build

# 开发模式测试
npm run dev
```

## API 签名示例

### CEX（中心化交易所）

大多数 CEX 使用 HMAC-SHA256 签名：

```typescript
private sign(params: Record<string, any>): string {
  const queryString = Object.keys(params)
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto
    .createHmac('sha256', this.apiSecret)
    .update(queryString)
    .digest('hex');
}
```

### DEX（去中心化交易所）

去中心化交易所通常需要：
- 私钥而非 API Key
- 钱包地址
- 签名交易消息

```typescript
// 示例：Hyperliquid
private async signAction(action: any): Promise<string> {
  // 使用 ethers.js 或类似库签名
  const wallet = new ethers.Wallet(this.privateKey);
  const message = JSON.stringify(action);
  return await wallet.signMessage(message);
}
```

## 注意事项

1. **错误处理**: 使用 try-catch 包装所有 API 调用
2. **日志**: 使用 `logger` 记录关键操作
3. **类型安全**: 确保返回统一的数据格式
4. **代理支持**: 支持通过代理访问 API
5. **速率限制**: 注意交易所 API 速率限制

## 数据格式转换

确保将交易所特定的数据格式转换为应用统一格式：

```typescript
// Bybit API 响应示例
{
  "symbol": "BTCUSDT",
  "size": "0.1",  // Bybit 字段
  ...
}

// 转换为统一格式
{
  exchange: ExchangeType.BYBIT,
  symbol: "BTCUSDT",
  positionAmt: "0.1",  // 统一字段名
  ...
}
```

## 参考实现

查看 `src/main/services/binance.ts` 作为完整的实现参考。

## 需要帮助？

如有问题，请查看：
- 交易所官方 API 文档
- 现有的 Binance 实现
- TypeScript 接口定义
