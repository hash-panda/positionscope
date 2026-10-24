# PositionScope 质量评审与迭代

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

## 当前首轮证据与缺口

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
