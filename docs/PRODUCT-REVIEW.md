# 产品 Review 与下一步

## 当前已发布版本（2026-10-25，v0.2.0-beta.10）

本轮已合并PR [#24](https://github.com/hash-panda/positionscope/pull/24)、[#25](https://github.com/hash-panda/positionscope/pull/25)、[#26](https://github.com/hash-panda/positionscope/pull/26)、[#27](https://github.com/hash-panda/positionscope/pull/27)：应用图标/官网色板/组件控件统一；纠正OKX单位及方向、Bybit签名及账户口径；增加参考强平/保证金、独立平台事实、保持/缩减敞口情景和按需公共市场研究；模型ID显式选择，不静默升级费用。

[Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.10) 与[发布运行40188968613](https://github.com/hash-panda/positionscope/actions/runs/40188968613)已完成arm64/x64签名、公证、装订和Gatekeeper。两份验证JSON与校验文件本地重算摘要，四个二进制声明与GitHub资产digest一致，包内ICNS/Template字节与源一致。记录在[docs/releases/v0.2.0-beta.10](releases/v0.2.0-beta.10/release.json)。57项Node、5项Python、类型、构建与UI/axe已通过源码/PR验证；用户Mac安装、签名包钥匙串弹窗、真实账户与真实模型质量仍未验证。签名通过不代替这些验收。

市场范围仅Binance USDT永续合约，不是全市场；基本面、解锁、盘口与长期账户历史未接入。按平台资产代码匹配仍未完成面额/重名项目身份映射，真实字段对照仍重要。详见[风险基础](ops/2026-10-25-risk-foundation.md)、[市场研究](ops/2026-10-25-market-context.md)、[模型生命周期](ops/2026-10-25-model-lifecycle.md)。Apple现有Secrets和证书保持，不要求重新配置；证书到期2027-11-23。


## 前序实现记录（2026-10-25，beta.9）

PR #25补齐风险事实/独立口径并修正适配器；PR #24统一品牌与组件控件。候选beta.9增加按需公共市场研究和条件资金费场景，证据见[市场报告](ops/2026-10-25-market-context.md)。下载和发布状态以最新Release及docs/releases为准。原生/真实账户/模型质量与全市场基本面仍未验证。

## 历史状态（2026-10-25，v0.2.0-beta.5）

按维护者要求采用全新实现，不兼容或迁移此前预览版。PR [#17](https://github.com/hash-panda/positionscope/pull/17) 已合并：独立应用身份 `app.funagent.positionscope` 与 PositionScope 数据目录，Electron 45 异步 safeStorage 加密完整配置；失败保留原密文，串行原子提交，移除明文保存和旧凭据接口。首次使用需要重新配置只读账户。

本地33项Node、4项Python、类型、生产构建与480×600/320px UI/axe回归通过。[PR CI](https://github.com/hash-panda/positionscope/actions/runs/40163118641) 的Mac任务使用真实系统API及隔离合成profile，两次进程启动验证加密、解密回读、重置、定向移除和删除。该检查也在两个签名前runner通过。

[beta.5 Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.5) 的双架构DMG/ZIP已经[发布运行](https://github.com/hash-panda/positionscope/actions/runs/40163284199)通过签名、公证、装订与Gatekeeper。公开记录见 [docs/releases/v0.2.0-beta.5](releases/v0.2.0-beta.5/release.json)。两份验证JSON和校验文件已本地重算摘要，四个二进制哈希与GitHub资产digest核对；没有在本地安装二进制。

仍未验证：签名安装包的钥匙串权限弹窗、用户Mac原生UI/自动启动、真实账户和模型质量；全仓库日志脱敏亦未完成。Mac CI是开发Electron加合成凭据，不能代替这些验收。旧版迁移不再列入待办，不把签名通过当作全部隐私或金融准确性验证。

评审日期：2026-10-24。对象：PositionScope / 仓位镜，原 trade-realtime-view。此为源码、合成场景与官方市场资料评审；没有访问用户本机真实持仓，没有全资产金融审计，也没有真实付费验证。

## 定位与判断

优先服务同时使用多个交易所、在 Mac 工作且不想反复切屏的合约用户。核心承诺是快速看到仓位、变化与可复核的风险事实。原来只有一次性 AI 总结，缺少时间基线、交易所口径和结果核对，很难证明持续价值。改为：快照 → 完整性检查 → 变动事件 → 确定性计算 → 按需解释 → 用户复核。先验证“更快发现变化”，不以收益率证明产品价值。

保留 480×600 紧凑默认屏。可选交易室展示数据/计算/AI 阶段和卡通角色，允许暂停并尊重减少动态效果。角色移动是流程示意，不是实际任务追踪。资金流图需要独立的成交、手续费、资金费、充值提现和内部转账账单及去重规则；当前数量变化不构成资金流证据。未知数据留空，不画虚假资金路线。

## 发现与本轮处理

| 问题/证据 | 优先级 | 处理与验收 |
| --- | --- | --- |
| 设置写入异常被吞，界面可能报保存成功 | P0 | 原子写入、权限0600、失败回退并抛错；磁盘失败回归 |
| 仓位请求失败可被账户请求成功清掉 | P0 | 按操作分别保存错误；首次显示，连续失败再暂停重试；针对性测试 |
| 单快照无法说明持仓变化 | P1 | 会话内快照比对；价格变化不造事件、断线重建基线、最多40条、退出清除 |
| 原凭证为本机明文 | P0，已改进 | beta.5完成系统加密及Mac CI；不迁移旧配置；签名包权限弹窗和原生验收仍待完成 |
| 聚合权益不能表达各交易所强平风险 | P1 | 逐交易所权益、可用保证金、数据完整性与不支持口径；真实接口样本验收 |
| Hyperliquid 现货资产解析形态需核对 | P1 | 逐字段对照官方当前返回，记录零余额/负余额/未知币种，不把源码猜测当已确认金融结果 |
| 各仓不利5%不是同一市场路径 | P1 | 官网说明公式和限制；未来补按共同标的冲击、费用与资金费情景 |
| 签名、原生和真账户验证缺失 | P0 | 签名、公证、装订和Gatekeeper自动验证已通过；干净Mac原生UI和真实账户仍待验收 |

AI 已以程序计算事实为输入，输出格式校验、快照缓存键、模型/提供商/时间可追溯。但格式正确不等于解释正确。下一轮加入脱敏、人工标注的标准场景：多空对冲、集中度升高、权益为零、单所失败、费率变化、转账与减仓区分。每例验收：算式正确、缺口明确、事实与猜测分开、不捏造胜率/强平价、不发交易指令。只在真实调用、质量与成本对比后迁移 SDK。

## 官方方案调研与取舍

以下为2026-10-24检索到的官方资料；产品方向是本项目判断，厂商文档不能证明本项目已集成或更有效。

| 方案 | 能力/适用场景 | 本项目取舍 |
| --- | --- | --- |
| [Crypto Pro](https://cryptopro.app/) | 原生生态、隐私叙事、组合/提醒 | 不与泛价格看板拼功能量，聚焦合约仓位变化 |
| [CoinStats](https://help.coinstats.app/en/articles/1537032-what-is-coinstats-app)、[MCP](https://coinstats.app/mcp/) | 多资产组合/分析、面向Agent的工具 | 本机只读多交易所可验证事实是差异化假设，需访谈验证 |
| [Delta](https://delta.app/en/features)、[AI Analyst](https://delta.app/academy/post/ai-portfolio-analyst-whats-going-on) | 组合追踪与“What’s going on”解释 | 一次AI总结已是常见能力；优先解释变化来源与数据缺口 |
| [Binance Agent/MCP](https://www.binance.com/en/support/faq/detail/7a6e676e36fb455d96478932cb12d9f3) | 官方授权工具，市场/资金费/Agent账户等，权限和账户范围有边界 | 先验证公共市场与只读账户可用范围；不假设替代所有主账户接口 |
| [OKX Agent Trade Kit](https://www.okx.com/docs-v5/agent_en/)、[源码](https://github.com/okx/agent-trade-kit) | 本地MCP/CLI/skills，市场、账户、仓位等 | 本地适配候选；实现显式只读工具白名单，不仅靠工具名字筛选 |
| [Bybit trading-mcp](https://github.com/bybit-exchange/trading-mcp) | V5工具，也包含交易能力 | 先做行情、仓位、资金费的隔离试验，禁用写操作 |

这些工具把数据与动作暴露给模型，不自带准确预测保证。现有 REST 适配器继续工作；新增接口必须对照同一脱敏样本、精度、失败恢复、限频、权限、许可证和依赖成本后再替换。模型SDK统一接口、流式/结构化结果可减维护成本，但不为“更AI”而重构。

## 用户本机验证协议

签名版可用后，在自己的 Mac 用只读测试账户连接；先核对交易所页面与应用数量/方向/标记价/权益时间。利用自然发生的持仓变化，不要求为了测试发起交易。记录不含Key/真实金额的预期事件类型、刷新时间、延迟、错误和误报。断网重连必须无伪平仓；价格变化必须无加减仓事件；同币种双向和跨所不能串键。私有资料留本机，只有用户主动脱敏导出才用于公开回归。当前执行环境不能读取已安装Mac应用的数据。

## 当日签名发布进展

v0.2.0-beta.2 已通过双架构签名、公证、装订和 Gatekeeper 自动验证并发布。六个 Apple Secrets 已配置，自动签名门禁启用。证据见 docs/releases/v0.2.0-beta.2 与 docs/ops/2026-10-24-signing.md。此进展不覆盖真实账户、原生UI、升级迁移或凭证加密验证；这些仍是后续重点。

## 2026-10-25 后续修订与发布

PR #14 修正 Hyperliquid 标准账户余额、估值、提现字段和模式边界；PR #15 区分菜单栏异常与无持仓。v0.2.0-beta.4 已经发布运行 40157740551 完成双架构签名、公证、装订及 Gatekeeper 自动验证。28项Node、4项Python、类型、构建及UI/axe回归通过。证据在 docs/releases/v0.2.0-beta.4（相对仓库根目录）；两份验证JSON和校验文件已和GitHub资产摘要核对，不代表Mac原生UI或真实账户验证。

仅允许userAbstraction=disabled的标准模式，默认永续DEX加现货；其他模式明确不支持，不修改账户模式。缺余额或价格即报错，USDC/USDT按1:1估算；可用余额是未占用保证金估算，未含其他DEX、质押、借贷。该版本发布时，凭据安全存储、原生UI与真实账户对照尚未验收；最新状态见本文顶部。此前预览版迁移已取消。
