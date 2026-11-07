# PositionScope · 仓位镜

<img src="assets/brand/app-icon-128.png" width="64" height="64" alt="PositionScope 取景框与仓位刻度标识">

面向 Binance 的 macOS 只读持仓速览与 AI 研究工作台。菜单栏看持仓，独立窗口查事件、依据与反证，让判断留下可复核的记录。

官网：https://positionscope.funagent.app/ 。下载、签名和验证状态以实际 [Releases](https://github.com/hash-panda/positionscope/releases) 为准。

## 0.2.1 功能范围

- **两种窗口**：480×600 速览展示 Binance 持仓、盈亏和 BTC/ETH 等自选公开行情；1180×760 可调整研究工作台提供研究、持仓、复盘和设置。研究页左侧约 60% 为事件队列，右侧约 40% 常驻证据；矩阵使用同一候选集合。
- **公共事件与证据**：在交易的 Binance USDT 永续范围内，筛选相对 BTC 强弱、成交活跃和资金费偏离。500 万 USDT 的 24h 成交额门槛，最多 10 个优先标的加 2 个轮转观察；保留来源、单位、时间与缺口。已收盘价格、OI、结算资金费和可见盘口可复核，缺失深度不补成完整数据。
- **按需 AI 查证**：仅在点击后发送公共研究事实，最多两次模型请求，每次输出上限 1,200 tokens，总时限 75 秒；数字、支持/反证、条件引用要经过校验。证据不足时观察，费用与实际用量未知。定时观察不调用模型。
- **关注、条件提醒与冻结复盘**：关注和提醒分开。最新成交价/资金费阈值每 60 秒检查，连续新鲜样本越界后发送应用内提醒一次。进程退出或休眠不补触发。保存当时判断、失败和弃权；可主动登记 24 小时参考价格观察，保留缺失样本，费用、资金费、滑点和净收益未知。
- **显示与更新**：默认浅色、绿涨红跌，可反转。原生菜单为紧凑币种/盈亏文字与彩色状态图示，隐藏金额立即遮罩并取消盈亏色。设置 → 关于与更新可主动检查官方数字稳定版本，仅打开发布页，由用户下载安装。

新研究与凭证入口聚焦 Binance。历史其他交易所适配器保留在源码中，已有配置可删除；它们不属于新版工作台验收范围。无下单、自动交易或资金转移功能。

## 下载与使用

[0.2.2 签名版](https://github.com/hash-panda/positionscope/releases/tag/v0.2.2) 修复 Binance 负逐仓钱包余额导致持仓不可用的问题，并区分钱包与保证金余额。Apple Silicon / Intel 的 DMG、ZIP、校验和与验证记录均已发布；[双架构发布运行](https://github.com/hash-panda/positionscope/actions/runs/42371046637)完成签名、公证、装订和 Gatekeeper。需要 macOS 13.0+。详见[修复验收](docs/ops/2026-11-07-isolated-wallet.md)；真实用户安装与账户恢复仍需确认。后续版本继续使用纯数字编号。

在自己的 Mac 安装，可使用[本机安装与验证脚本](docs/install-and-verify-mac.md)。它先核对固定版本摘要、签名与 Gatekeeper，再把旧应用移到废纸篓并安装；不会读取或迁移旧预览版凭证，系统权限弹窗需本机处理。

打开菜单栏速览可直接查看无需账户密钥的公共参考行情。进入工作台 → 设置 → Binance 连接，仅保存 Binance 只读凭证；应用不会替你验证交易所 Key 的全部权限。关闭交易与提现权限。

在设置中保存模型提供商、Key 与明确模型 ID，再从研究事件右侧点击“AI 查证”。公共研究不会发送持仓或权益。独立的“AI 持仓分析”会发送计算后的逐仓风险事实、平台权益和公共背景，仍属敏感财务信息。两者都由用户主动发起，模型费用由提供商收取；不会静默升级型号。

## 数据、判断与隐私

名义价值为每笔 `abs(基础币数量) × 本平台标记价`；同币种多空的总名义价值用于集中度，不能把对冲当作分散。参考强平价为空或零时保持未知，强平距离远不能单独证明适合一直持有。5% 不利压力与保留/缩减敞口情景是机械假设，未计费用、资金费、滑点与路径强平，不是收益预测。

事件筛选是横截面线索，成交额活跃不等于相对自身历史放量，OI 增加不等于净资金流入，币种代码不等于已核实项目身份。参考价格观察是无杠杆价格毛变化，不是可执行交易、账户绩效或净收益。无足够历史与成本，不生成胜率、夏普或盈利结论；结构化输出和事实引用不能证明模型语言判断正确。

应用身份为 `app.funagent.positionscope`，使用独立 PositionScope 数据目录，不兼容或迁移旧预览版。账户/模型 Key 等配置通过 Electron 45 异步 `safeStorage` 使用系统钥匙串管理的密钥加密；不可用时保留原文件，不回退明文。公共研究账本为本机 `0600` 权限 JSON，原子保存，**不是加密文件**；也会体现用户关注/提醒偏好，不应公开。删除所有数据会清理配置和研究记录、通知两个窗口并拒绝旧响应回填。详见 [secure-storage.md](docs/secure-storage.md)。

真实 Mac 窗口/菜单栏/自动启动、签名包钥匙串权限弹窗、真实账户与模型语义仍需独立验收。签名通过不能证明盈利能力或全部使用场景通过。

## 开发与维护

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

本地验证：`pnpm typecheck`、`pnpm test`、`pnpm build`；安装 Chromium 后 `pnpm test:ui`。新版本仅使用纯数字 `x.y.z`，Issue → 独立 PR → 确切 head CI / 审查 → main → 验证签名发布；同版本安装包不覆盖。

- [设计规范](DESIGN.md)与[分阶段实施/验收计划](docs/IMPLEMENTATION-PLAN.md)
- [质量标准](docs/product-quality.md)与[产品 Review](docs/PRODUCT-REVIEW.md)
- [Apple 签名、公证与发布规范](docs/release-signing.md)
- [运营规范](docs/OPERATING-PLAN.md)与[SEO/GEO、社区实验](docs/GROWTH-PLAYBOOK.md)
- [真实验收 #3](https://github.com/hash-panda/positionscope/issues/3)、[数据研究 #23](https://github.com/hash-panda/positionscope/issues/23)

Electron + Vue 3 + TypeScript + Vite。原作者 Wang（hash-panda）；旧资料可从 Git 历史查看。独立产品，与 Binance 或其他交易所无官方关联；许可证沿用 MIT。欢迎提交已脱敏场景，可自愿 Star 或 Watch Releases；访问、激活、留存和收入没有真实数据时保持未知。
