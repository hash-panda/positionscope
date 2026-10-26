# PositionScope · 仓位镜

<img src="assets/brand/app-icon-128.png" width="64" height="64" alt="PositionScope 取景框与仓位刻度标识">

macOS 菜单栏中的多交易所持仓监控与按需 AI 风险解读。

官网：https://positionscope.funagent.app/ 。当前为签名、公证的 Beta；发布产物以 Releases 为准。

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

仅配置只读交易所凭证。当前源码使用 macOS 系统钥匙串管理的异步加密配置（Electron 45）；不会验证交易所 Key 的权限。AI 分析会发送计算后的逐仓风险事实、平台权益与公共市场背景至用户选择的模型提供商，调用费用由提供商收取。

本地验证：`pnpm typecheck`、`pnpm test`、`pnpm build`；安装 Chromium 后 `pnpm test:ui`。设计见 [DESIGN.md](DESIGN.md)，评审与迭代见 [docs/product-quality.md](docs/product-quality.md)。

支持 Binance、Bybit、OKX、Hyperliquid 的现有只读适配器；资产总额沿用各适配器口径。AI 只解释线性 USDT/USD 仓位快照，不产生交易指令；缺少历史与强平价等信息时不生成绩效或强平指标。

当前源码使用独立应用标识 app.funagent.positionscope 与 PositionScope 数据目录，不兼容此前预览版，需要重新配置只读账户。当前 Beta 已通过 macOS 双架构签名、公证、票据装订与 Gatekeeper 自动检查；原生交互和真实账户/模型连通性仍需实测。


## 下载与使用

[签名 Beta v0.2.0-beta.11](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.11) 提供 Apple Silicon、Intel 的 DMG/ZIP、SHA256 和公证验证记录。四个安装包均通过签名、公证和 Gatekeeper 自动验证；真实只读账户与原生交互仍需试用核对。

在自己的Mac替换旧应用，可使用[本机安装与验证脚本](docs/install-and-verify-mac.md)。它先核对固定版本的摘要、签名和Gatekeeper，再把旧应用移到废纸篓并安装新版；不会读取或删除旧凭证配置。系统权限弹窗仍需在本机处理。

打开菜单栏窗口，进入设置 → API 配置，选择交易所并保存只读凭证；隐藏金额会同时作用于持仓与菜单栏。设置 → AI 分析中可配置提供商、Key 与模型 ID，点击「AI 持仓分析」才发送计算后的逐仓风险事实、平台权益及公共市场背景。

## 分析方法

总名义价值为每笔 `abs(数量) × 标记价` 之和；集中度合并同币种的跨交易所多空仓，避免把对冲当分散。名义价值/监控权益是汇总口径，不能用于判断各交易所强平风险。各仓不利 5% 的压力情景不代表共同市场路径或损失概率，不计资金费、费用和滑点。

AI 不提供可验证的盈利预测或投资建议。缺少历史收益、波动率、相关性、维持保证金与强平价时，不生成胜率、夏普、VaR 或精确强平距离。输出格式校验不能证明模型语言结论正确。

参考强平价、距离、初始/维持保证金与每交易所权益按各自口径展示；空/零/未知数据不补成安全值。比较保持/缩减25%/缩减50%剩余敞口的同幅价格冲击，不能线性外推新的强平价。

更多操作 → 公共市场 · 研究观察：按需查询Binance USDT永续范围的市场宽度、活跃/近期上市、资金费、OI与已收盘小时价格统计；不需要行情密钥，不发送仓位数量/权益。它不是全市场或早期价值筛选，也没有下单功能。AI按需附带公开市场背景与条件资金费；除DeepSeek已核对alias外，其他提供商需填写兼容现有接口的模型ID并核对价格，不会静默升级。

## 持续维护

北京时间每天上午约 09:00，按 [质量标准](docs/product-quality.md) 评审准确性、分析依据、窗口体验、隐私与发布，调研官方产品/SDK 变化，并通过 Issue → PR → CI → 合并 → 预发布迭代。[待验证事项](https://github.com/hash-panda/positionscope/issues/3)。

## 项目

Electron + Vue 3 + TypeScript + Vite。原项目作者 Wang（hash-panda）；旧资料可从 Git 历史查看。独立产品，与交易所无官方关联。许可证沿用原项目声明的 MIT。

## 持续迭代与运营

当前签名 Beta 已包含会话内持仓变动、可选交易室和保存/接口错误修正。发布状态与验证记录以官网和 Release 为准。

- [产品 Review 与官方方案调研](docs/PRODUCT-REVIEW.md)
- [产品、周/月/年运营与商业验证规范](docs/OPERATING-PLAN.md)
- [SEO/GEO 与社区实验](docs/GROWTH-PLAYBOOK.md)
- [Apple 签名、公证与发布配置](docs/release-signing.md)
- [第0期报告](docs/ops/2026-10-24.md)

欢迎提交已脱敏的使用场景；如果项目有帮助，可以自愿 Star 或 Watch Releases。

Hyperliquid 当前暂仅支持已确认的标准账户（disabled）：默认永续 DEX 与现货。其他模式停止汇总；USDC 按 1:1 USDT 等值估算，不含其他 DEX、质押与借贷。异常数据在菜单栏显示“数据异常”，不表示无持仓。

加密配置与恢复机制见 [secure-storage.md](docs/secure-storage.md)。系统密钥不可用时保留原加密文件，不使用明文回退。当前签名beta.11已包含该实现；Mac CI使用真实系统API验证加密回读，签名安装包权限弹窗和原生场景仍待实机验收。
