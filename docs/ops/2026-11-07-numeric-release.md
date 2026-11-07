# 2026-11-07 · 0.2.1 发布与验收记录

本报告记录 2026-11-07 的 0.2.1 实现与发布验收。仓库公开且默认分支为 `main`；本轮版本 PR 已将 package 更新为纯数字 `0.2.1`，后续使用 `0.2.2` 等数字版本。源码验证、Apple 签名、下载推广与用户原生验收分别记录；没有实际证据的项目保持未知。[0.2.1](https://github.com/hash-panda/positionscope/releases/tag/v0.2.1) 已于 `2026-11-07T11:38:20Z` 发布，双架构完整签名门禁通过。官网和安装器的推广与线上核对分别记录在下表及推广 PR。

## 代码范围与依赖

| 阶段 | 已核对链接与状态 | 来源提交或当前 head |
| --- | --- | --- |
| 数字版本政策与设计 | [PR #55](https://github.com/hash-panda/positionscope/pull/55) 已合并 | `e62f2b9e208e3720ff495999c0f7285d239c94e6` |
| 冻结账本与提醒/前瞻观察模块 | [PR #56](https://github.com/hash-panda/positionscope/pull/56) 已合并 | `c99d86bc4ec5a77cfafa31e0c0170344e64b7c4a` |
| 公共研究引擎 | [PR #57](https://github.com/hash-panda/positionscope/pull/57) 已合并 | `aef13888d103832a17173d7a2c4d979c7c279dd9` |
| 偏好与主动更新检查 | [PR #58](https://github.com/hash-panda/positionscope/pull/58) 已合并 | `2040a9142d9077983003dc0145947cb848fd2498` |
| 有预算的公共市场 AI 查证 | [PR #59](https://github.com/hash-panda/positionscope/pull/59) 已合并；[CI](https://github.com/hash-panda/positionscope/actions/runs/42366119736) 通过 | `eaefdf7f4965d4e5da07fdc4aa0098a00956ef9a` |
| 速览、工作台与主进程接线 | [PR #60](https://github.com/hash-panda/positionscope/pull/60) 已合并；[CI](https://github.com/hash-panda/positionscope/actions/runs/42367072522) 全部通过 | `54bcd65fc9f213e0ff5f7ecaa33e93ee615bfb17` |

本次发布的新能力限 Binance 只读研究。新凭证入口仅提供 Binance；源码保留历史其他适配器与可删除的已有配置，不将它们计入本轮新工作台验收，也不恢复旧预览版身份或配置迁移。

## 实际实现的交互和数据边界

- 480×600 速览保留持仓、盈亏、权益与 BTC/ETH/自选公开行情；独立 1180×760 工作台可调整，最小 960×640。研究页左约 60% 事件队列、右约 40% 常驻证据；矩阵复用列表候选，数字保留单位、图例与时间。研究、持仓、复盘、设置独立导航，不以大型 K 线或装饰动画代替依据。
- 原生菜单精简为币种/未实现盈亏，图标按盈亏变色；默认绿涨红跌，可反转。隐藏金额先遮原生菜单再等待保存/网络，并使图示中性；跨窗口设置与删除事件同步。24h 参考行情在速览显示，未声称原生菜单已添加独立行情轮播或逐字彩色文本。
- 公共引擎筛选在交易的 Binance USDT 永续，500 万 USDT 24h 成交额门槛，最多 10 个优先标的及 2 个轮转观察。只读固定 GET、最多 3 个并发、限流冷却和源时间过期检查。深研每标的最多五个固定端点；资料包含小时收盘价、未平仓量、结算资金费及普通可见盘口，缺口保持未知。成交额排名不等于历史放量，OI 变化不等于净资金流，资金费参考未按结算周期归一化。
- AI 由用户主动启动，最多两次模型请求、每次 1,200 输出 tokens、18,000 输入字符和 75 秒总预算。同一时刻仅一次查证；超时后未结束的请求继续占位，防止新增付费并发。发送字段仅含公共事实；数值引用、支持/反证和条件ID校验失败不生成结论。费用/实际用量未知，存在有效事实ID不证明反证语义正确。
- 关注与提醒分开；当前 UI/运行入口支持最新成交价和资金费阈值。进程运行且联网时每 60 秒检查，首次样本建基线、连续新鲜样本跨越触发一次，通知进入两个窗口的应用内通知中心。不是操作系统推送，不补发退出/休眠期间的触发。活动提醒和价格观察共用最多 32 个币种预算，不调用 AI，也不读私有账户。
- 当时的公共判断、弃权和失败冻结保存，后续观察追加。自愿登记的 24 小时价格观察使用登记后的下一新鲜成交价作参考；缺失起点或到期报价保留为不完整样本，不用更晚价格补写。它不代表可执行成交、杠杆合约收益或净收益；手续费、资金费和滑点未知。
- “关于 → 检查更新”只查询固定官方 GitHub 公开接口，核对纯数字稳定版与七项必需资产的名称/来源/可用元数据后提供官方 Release 页。它不下载/安装包，资产存在也不等于本机完成签名校验。

## 验收矩阵

下表区分源码/合成验证与真实使用。已有开发记录可在各 PR 复核；没有本次确切 head 的 CI 结果时写待确认，不把检查脚本存在当作通过。

| 范围 | 已有可复核证据 | 仍需确认 |
| --- | --- | --- |
| 数据/时效/预算 | #57 记录 15 项合成引擎测试；重复、无效/旧值、10+2、并发、冷却、代理切换旧请求不得覆盖新样本 | 真实公共接口时效、账户字段对照；全市场/基本面不在范围 |
| 账本/条件/价格观察 | #56 记录 16 项合成测试；原子保存失败回退、冻结判断、一次触发、乱序/离线、删失、并发32币种上限 | 实际用户连续运行样本与语义理解；净收益、有效样本量未知 |
| AI 输出与隐私 | #59 当前说明记录总计 167 项 Node，其中 22 项 AI 合成测试；资金费原始比率、BTC差值百分点、数字引用、旧模型结果失效 | 真实模型质量、实际成本/时延、盈利能力未知 |
| 主进程与双窗口 | `tests/main-workspace.test.cjs` 八项主进程集成测试已通过；模拟 Electron/存储/账户/模型/公共边界验证窗口、sender/mainFrame、立即遮罩、双窗删除、定时器只读与迟到结果 | 合成 Electron 不等于用户 Mac 视觉/系统权限 |
| UI/偏好/可访问性 | 类型/构建、182 项 Node、14 项 Python 已通过（含 #62 装订重试测试）；`verify-research-ui.cjs` 与 `verify-workspace-settings.cjs` 覆盖新界面和设置；旧逻辑测试保留 | [#60 CI](https://github.com/hash-panda/positionscope/actions/runs/42367072522) 已通过浅/暗、金额遮罩、颜色反转、键盘、提醒/单位和空错旧态；17项界面文件，实际截图已审查；不代表原生Mac |
| 凭证与本地存储 | 既有独立身份 `app.funagent.positionscope` 与异步 `safeStorage`；公共研究单独采用 `0600` JSON 原子替换；字段投影不把账户/Key写入研究账本 | 签名安装包真实钥匙串权限弹窗与全仓日志/IPC审计仍未完成 |
| 发布与安装 | 现有已通过的 arm64/x64 签名、公证、装订、Gatekeeper 工作流继续复用；新版本政策为纯 `0.2.1`、`prerelease=false` | 0.2.1 来源、签名及七资产已核对，见下表；安装器随推广 PR 在 Mac CI 下载新 ZIP 后核验；用户本机安装仍未知 |
| 官网与增长 | 准备推广 0.2.1 下载与公开能力文案；beta.16历史证据保留 | 线上部署与 URL 核对结果以推广 PR 验证评论为准；访问、激活、留存、收入、SEO/GEO效果未知 |

这些证据不足以给真实可用性或盈利能力计算可信总分；不虚报 100 分评审。账户和模型 Key 等配置使用系统加密；**研究账本不是加密文件**，保存公共研究及用户选定规则，仍可能体现个人关注偏好，应只保留在本机。两者存储口径不能混称“所有数据加密”。独立审查发现并修复删除后旧关注/提醒写回，以及等待公共行情的旧持仓分析在删除/重配后继续进入模型的竞态；新增测试先复现两项失败，再通过修复。测试没有发送真实持仓、连接真实账户或产生付费模型请求。

## 0.2.1 发布门槛与实际证据

1. #55–#60 已依次完成确切 head CI、审查并合并 main。#60 最终 head `0f1e47cf1ee80694d4fd1a2528b41d1e0d3edd24`，CI `42367072522` 通过；发布版本另经 #61、装订边界修复另经 #62，均通过 CI 并合并。
2. 最终版本 PR #61 将 package 改为 0.2.1；#62 不变版本，只补有界票据装订重试。保留已发布 beta.16 不覆盖；正式来源提交、PR 和检查链接见下表。
3. 仅使用现有签名流程；arm64/x64 均须签名、公证、装订、Gatekeeper与包内图标核验通过。任何失败均不发布，不退回未签名。
4. 核对四个 DMG/ZIP、两个 verification JSON 与 SHA256SUMS 的名称/长度/摘要/来源。将实际证据保存到 `docs/releases/v0.2.1/` 后，独立推广安装器固定摘要、README、官网七页和 release.json。
5. 官网只在实际 Release 成功且资产核对后更新，并重新查首页/下载页/robots/sitemap/canonical/版本链接；发布和线上推广分别记录，不能互相代替。

| 证据项 | 当前状态 |
| --- | --- |
| 最终发布 PR / source commit | [版本 #61](https://github.com/hash-panda/positionscope/pull/61) 与[装订重试 #62](https://github.com/hash-panda/positionscope/pull/62)，`fb4c6e0d660875a846dc078e73e672f866e11153` |
| 最终质量 CI / 新签名运行 | [版本 PR CI](https://github.com/hash-panda/positionscope/actions/runs/42367293542) 与[装订 PR CI](https://github.com/hash-panda/positionscope/actions/runs/42368305616) 全通过；[签名 42368451830](https://github.com/hash-panda/positionscope/actions/runs/42368451830) 的 quality、arm64、x64、publish 全成功 |
| 0.2.1 Release URL / published_at | [v0.2.1](https://github.com/hash-panda/positionscope/releases/tag/v0.2.1)，`2026-11-07T11:38:20Z`，`prerelease=false` |
| 七项资产与发布证据 | [release.json](../releases/v0.2.1/release.json)；三文本资产下载并重算 SHA256，四安装包记录与 GitHub asset digest 一致；包内图标摘要与源码一致 |
| 官网/安装器推广 PR、部署与线上核对 | 本推广 PR 更新官网七页、release.json、README、安装说明与安装器 ZIP 摘要；确切 CI、合并和生产部署结果见该 PR 后续验证评论，未观察的上线结果不预填 |

## 发布过程的失败记录

签名运行 `42367423679` 首次尝试：arm64 应用公证 Accepted 后，票据装订返回68；x64 应用签名/公证/装订与Gatekeeper已过，DMG阶段装订返回68，publish跳过。没有发布半套安装包，没有更改正常凭证。同一source第二次尝试亦在上述两处返回68，publish再次跳过。[#62](https://github.com/hash-panda/positionscope/pull/62) 增加仅68的最多三次装订尝试（间隔15/30秒），其他失败、validate与Gatekeeper继续阻止发布；14项Python合成验证、完整CI与独立审查通过，#62已合并；新运行42368451830已完整通过：arm64 在应用装订阶段实际触发两次有界重试后成功，x64 全部通过；双架构最终验证及 publish 成功。以最终attempt实际结果验收，错误码不足以确定具体服务/网络根因。Apple说明装订依赖票据下载，见[官方自定义公证流程](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)。

## 后续 0.2.2 候选

优先积累可复核前瞻样本及失败/弃权/删失，再评估独立基准、净成本和研究结论质量；没有实际成本与样本不能制作盈利率。随后以公开授权评估集验证模型语义、反证和实际费用/时延，保持明确模型ID，不为追新替换稳定SDK。原生 Mac 权限弹窗、菜单栏/多屏/自动启动、窗口尺寸记忆与离线恢复依据真实验收决定修正；系统通知、其他交易所、长期历史、基本面/解锁另行排期。

继续复用 [#3](https://github.com/hash-panda/positionscope/issues/3)、[#23](https://github.com/hash-panda/positionscope/issues/23) 记录真实验收与数据范围，搜索/品牌渠道阻塞留在 [#7](https://github.com/hash-panda/positionscope/issues/7)。不新增外部宣发、付费或交易权限。下一版本候选不是发布日期或收益承诺。
