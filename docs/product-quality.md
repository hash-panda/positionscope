# PositionScope 质量评审与迭代

## 当前已发布版本（2026-10-25，v0.2.0-beta.10）

本轮已合并PR [#24](https://github.com/hash-panda/positionscope/pull/24)、[#25](https://github.com/hash-panda/positionscope/pull/25)、[#26](https://github.com/hash-panda/positionscope/pull/26)、[#27](https://github.com/hash-panda/positionscope/pull/27)：应用图标/官网色板/组件控件统一；纠正OKX单位及方向、Bybit签名及账户口径；增加参考强平/保证金、独立平台事实、保持/缩减敞口情景和按需公共市场研究；模型ID显式选择，不静默升级费用。

[Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.10) 与[发布运行40188968613](https://github.com/hash-panda/positionscope/actions/runs/40188968613)已完成arm64/x64签名、公证、装订和Gatekeeper。两份验证JSON与校验文件本地重算摘要，四个二进制声明与GitHub资产digest一致，包内ICNS/Template字节与源一致。记录在[docs/releases/v0.2.0-beta.10](releases/v0.2.0-beta.10/release.json)。57项Node、5项Python、类型、构建与UI/axe已通过源码/PR验证；用户Mac安装、签名包钥匙串弹窗、真实账户与真实模型质量仍未验证。签名通过不代替这些验收。

市场范围仅Binance USDT永续合约，不是全市场；基本面、解锁、盘口与长期账户历史未接入。按平台资产代码匹配仍未完成面额/重名项目身份映射，真实字段对照仍重要。详见[风险基础](ops/2026-10-25-risk-foundation.md)、[市场研究](ops/2026-10-25-market-context.md)、[模型生命周期](ops/2026-10-25-model-lifecycle.md)。Apple现有Secrets和证书保持，不要求重新配置；证书到期2027-11-23。


## 公共市场迭代记录（2026-10-25，beta.9）

[市场证据](ops/2026-10-25-market-context.md)：按需读取有边界的公共市场，不把平台合约范围等同全市场；53项Node与UI/axe本地通过，真实账户/模型仍未知。

## 风险基础迭代记录（2026-10-25，beta.7）

详见[本轮证据与官方来源](ops/2026-10-25-risk-foundation.md)。修正OKX合约单位/空仓方向、Bybit GET签名与UNIFIED口径，补Binance v3/参考强平价/保证金/独立账户时间；未知总额不补零。risk-facts-v2增加条件情景，AI不再机械复述缺口。发布状态必须核对实际Release，以下历史beta.5状态不替代当前记录。

## 历史状态（2026-10-25，v0.2.0-beta.5）

按维护者要求采用全新实现，不兼容或迁移此前预览版。PR [#17](https://github.com/hash-panda/positionscope/pull/17) 已合并：独立应用身份 `app.funagent.positionscope` 与 PositionScope 数据目录，Electron 45 异步 safeStorage 加密完整配置；失败保留原密文，串行原子提交，移除明文保存和旧凭据接口。首次使用需要重新配置只读账户。

本地33项Node、4项Python、类型、生产构建与480×600/320px UI/axe回归通过。[PR CI](https://github.com/hash-panda/positionscope/actions/runs/40163118641) 的Mac任务使用真实系统API及隔离合成profile，两次进程启动验证加密、解密回读、重置、定向移除和删除。该检查也在两个签名前runner通过。

[beta.5 Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.5) 的双架构DMG/ZIP已经[发布运行](https://github.com/hash-panda/positionscope/actions/runs/40163284199)通过签名、公证、装订与Gatekeeper。公开记录见 [docs/releases/v0.2.0-beta.5](releases/v0.2.0-beta.5/release.json)。两份验证JSON和校验文件已本地重算摘要，四个二进制哈希与GitHub资产digest核对；没有在本地安装二进制。

仍未验证：签名安装包的钥匙串权限弹窗、用户Mac原生UI/自动启动、真实账户和模型质量；全仓库日志脱敏亦未完成。Mac CI是开发Electron加合成凭据，不能代替这些验收。旧版迁移不再列入待办，不把签名通过当作全部隐私或金融准确性验证。

产品名：PositionScope · 仓位镜。仓库：hash-panda/positionscope（Public），原名 trade-realtime-view。官网：https://positionscope.funagent.app/。官网来源位于 website/index.html，与 Sites 源同步时必须使用同一份内容。

## 100 分标准

每一项以可复核事实评分。无法运行或无证据的项目标记「未验证」，不默认给满分。分数衡量完成度，不代表金融风险或获奖品质。

| 维度 | 权重 | 验收证据 |
| --- | ---: | --- |
| 数据准确性、新鲜度 | 25 | 正负数量、精度、同币种跨交易所、部分失败、零权益、时间戳与口径 |
| 风险分析可靠性 | 25 | 可复算事实、假设与缺口、输出校验、缓存、模型版本、无虚构绩效 |
| 小窗口与交互 | 20 | 480×600 多持仓、320px、长金额、键盘、加载/空/错/隐私状态、数字对齐 |
| 隐私与凭证 | 15 | 最小发送内容、日志脱敏、只读权限说明、存储机制真实、删除边界 |
| 验证与发布 | 10 | 类型检查、逻辑回归、UI/可访问性、构建、Mac 实机、签名公证与校验和 |
| 官网与上手 | 5 | 可用链接、合成数据标识、安装状态、真实能力与限制 |

## 首轮历史证据与缺口（2026-10-24，非当前状态）

本轮本地类型检查、11 项逻辑测试、生产构建与 UI harness 通过。UI harness 使用合成账户，不访问交易所或模型。实际图见 test-results/ui（本地生成，不提交）。没有以自评断言设计达到任何奖项水准。

仍需验证：macOS 菜单栏/窗口/开机启动，真实只读 API 与模型调用，签名公证和升级路径。凭证仍为本地 JSON 文件；安全存储是下一优先项。原始适配器的全部资产口径未做金融审计。AI 输出的格式校验不能证明语言结论真实。

AI 计算适用于当前线性 USD/USDT 仓位形态；跨交易所权益比仅为汇总，不表明强平距离；同币种多空按总名义价值合并集中度。各仓各自不利 5% 的压力情景不是共同市场路径，不计费用/资金费/滑点。没有历史就不生成胜率、夏普、VaR、历史曲线；盈利不等于安全。

## 每日循环

北京时间每天上午约 09:00 的自动任务已建立。每次读取实际默认分支、开放 Issue/PR、上次报告和 CI；先去重，找最重要缺口。调研只依赖当前官方文档/源码/公告，区分已上线、预告与推断。每个候选写清触发场景、证据、最小修改和验收方法。每轮选择一个可完成的范围，独立 PR、实际验证、审查后合并，再发布。遇到连接/执行限制，输出阻塞并更新 Issue，不假装完成。

CI 在 PR 上执行类型、逻辑、构建、签名输入测试、官网检查及 UI 回归。新的签名工作流在 master 或手动触发，实际签名需六个 Apple Secrets；自动签名需 APPLE_SIGNING_ENABLED=true。双架构签名/公证/装订验证通过才发布，不再自动生成未签名预览。同版本已有 release 时不覆盖。详见 release-signing.md。

## 2026-10-24 官方调研与取舍

- TradingView watchlist 的按列比较与按需选择信息，适合借鉴到小窗口；不复制大屏工作台：https://www.tradingview.com/support/solutions/43000745825-mastering-the-tradingview-watchlists/
- AI SDK 提供 schema 输出与多提供商统一接口，可作为下一步替换手写 HTTP 的候选；本轮先修复当前链路并建立回归，避免在同一轮叠加框架迁移：https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
- Gemini 官方兼容接口：https://ai.google.dev/gemini-api/docs/openai 。本轮更正兼容端点，以 Bearer header 代替原 Key 查询参数；模型可自定义。模型列表：https://ai.google.dev/gemini-api/docs/models 。
- DeepSeek 官方 JSON 模式与当前模型列表：https://api-docs.deepseek.com/guides/json_mode/ 、https://api-docs.deepseek.com/ 。本轮默认模型按查询时官方首页的 deepseek-flash 更新；未做真实调用验证。

每次模型迁移必须重新检查当前官方模型 ID、支持参数、实际可用性与费用，不能只更新名字就声称更智能。

本轮静态公开准备检查覆盖默认分支全部 9 个历史提交的 patch 与当前源码，未匹配预设的 API Token / 私钥模式；这是静态模式检查，并非无凭证泄漏的绝对保证。本地工具权限文件从当前树移除，不重写历史。移除未被源码引用的 canvas、crypto-js、form-data、abort-controller，减少打包与原生依赖负担。

首轮合并与发布：PR #1 已合并，GitHub CI 质量检查及 macOS 双架构 ZIP 构建通过，v0.2.0-beta.1 预发布已创建。签名/公证与原生实机验证仍未完成。

## 后续签名验收（2026-10-24）

PR #10 修复 electron-builder 身份选择器，17 项 Node 与 4 项 Python 测试及 GitHub CI 通过。发布运行 40104806497 的 quality、arm64、x64、publish 全部成功，v0.2.0-beta.2 的四个安装包完成 Developer ID 签名、Apple 公证、票据装订和 Gatekeeper 自动检查。验证记录与 GitHub 七项资产摘要一致。自动签名已启用，已有版本跳过，纯文档/官网变更不触发签名。原生交互、真实账户和加密存储仍未完成。

## 2026-10-25 后续修订与发布

PR #14 修正 Hyperliquid 标准账户余额、估值、提现字段和模式边界；PR #15 区分菜单栏异常与无持仓。v0.2.0-beta.4 已经发布运行 40157740551 完成双架构签名、公证、装订及 Gatekeeper 自动验证。28项Node、4项Python、类型、构建及UI/axe回归通过。证据在 docs/releases/v0.2.0-beta.4（相对仓库根目录）；两份验证JSON和校验文件已和GitHub资产摘要核对，不代表Mac原生UI或真实账户验证。

仅允许userAbstraction=disabled的标准模式，默认永续DEX加现货；其他模式明确不支持，不修改账户模式。缺余额或价格即报错，USDC/USDT按1:1估算；可用余额是未占用保证金估算，未含其他DEX、质押、借贷。该版本发布时，凭据安全存储、原生UI与真实账户对照尚未验收；最新状态见本文顶部。此前预览版迁移已取消。
