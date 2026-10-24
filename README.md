# PositionScope · 仓位镜

macOS 菜单栏中的多交易所持仓监控与按需 AI 风险解读。

官网：https://positionscope.funagent.app/ 。当前为开发预览；发布产物以 Releases 为准。

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

仅配置只读交易所凭证。当前使用本地设置文件，尚未接入系统钥匙串；不会验证交易所 Key 的权限。AI 分析会发送计算后的风险汇总至用户选择的模型提供商，调用费用由提供商收取。

本地验证：`pnpm typecheck`、`pnpm test`、`pnpm build`；安装 Chromium 后 `pnpm test:ui`。设计见 [DESIGN.md](DESIGN.md)，评审与迭代见 [docs/product-quality.md](docs/product-quality.md)。

支持 Binance、Bybit、OKX、Hyperliquid 的现有只读适配器；资产总额沿用各适配器口径。AI 只解释线性 USDT/USD 仓位快照，不产生交易指令；缺少历史与强平价等信息时不生成绩效或强平指标。

产品/安装包名称改为 PositionScope，macOS App ID 与旧用户数据目录保留，以便升级。Mac 原生行为、真实账户/模型连通性和签名公证尚未完成实测，未签名 ZIP 仅用于开发预览。


## 下载与使用

[开发预览 v0.2.0-beta.1](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.1) 提供 Apple Silicon、Intel 的 macOS ZIP 和 SHA256 校验文件。安装包尚未签名或公证，macOS 原生交互与真实只读账户仍需实测。

打开菜单栏窗口，进入设置 → API 配置，选择交易所并保存只读凭证；隐藏金额会同时作用于持仓与菜单栏。设置 → AI 分析中可配置提供商、Key 与模型 ID，点击「AI 持仓分析」才发送计算后的风险汇总。

## 分析方法

总名义价值为每笔 `abs(数量) × 标记价` 之和；集中度合并同币种的跨交易所多空仓，避免把对冲当分散。名义价值/合约权益是汇总口径，不能用于判断各交易所强平风险。各仓不利 5% 的压力情景不代表共同市场路径或损失概率，不计资金费、费用和滑点。

AI 不提供可验证的盈利预测或投资建议。缺少历史收益、波动率、相关性、维持保证金与强平价时，不生成胜率、夏普、VaR 或精确强平距离。输出格式校验不能证明模型语言结论正确。

## 持续维护

北京时间每天上午约 09:00，按 [质量标准](docs/product-quality.md) 评审准确性、分析依据、窗口体验、隐私与发布，调研官方产品/SDK 变化，并通过 Issue → PR → CI → 合并 → 预发布迭代。[待验证事项](https://github.com/hash-panda/positionscope/issues/3)。

## 项目

Electron + Vue 3 + TypeScript + Vite。原项目作者 Wang（hash-panda）；旧资料可从 Git 历史查看。独立产品，与交易所无官方关联。许可证沿用原项目声明的 MIT。
