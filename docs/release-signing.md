# macOS 签名与发布

## 当前已发布版本（2026-11-07，0.2.3）

[PR #67](https://github.com/hash-panda/positionscope/pull/67)修复布局/持仓表与报价；[PR #68](https://github.com/hash-panda/positionscope/pull/68)实现应用内更新。来源 `ad551ffa75485c954097681e6b268ffc1e53fefe`，[发布运行](https://github.com/hash-panda/positionscope/actions/runs/42379238693)通过双架构原生更新/替换/重启演练，以及生产包签名、公证、装订、Gatekeeper 与图标校验。[Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.3)于 `2026-11-07T14:16:51Z` 发布，七资产见 [releases/v0.2.3](releases/v0.2.3/)。196 Node、21 Python、类型/构建和UI/axe均有CI证据；用户 Mac 权限弹窗、真实账户/模型验收仍独立。推广部署结果见[报告](ops/2026-11-07-in-app-updates.md)及其关联PR。

## 历史已发布版本（2026-11-07，0.2.2）

[PR #65](https://github.com/hash-panda/positionscope/pull/65) 修复逐仓钱包负余额校验及保证金字段映射，来源 `9f7fbac5b143f43067846e6c22971bfa6892549b`。[签名运行](https://github.com/hash-panda/positionscope/actions/runs/42371046637)双架构签名、公证、装订、Gatekeeper、包内图标核验通过；[Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.2)于 `2026-11-07T12:23:17Z` 发布，七资产核对结果位于 [releases/v0.2.2](releases/v0.2.2/)。189 Node、21 Python、类型/构建、UI/axe 与合成Mac通过。真实账户恢复、用户Mac权限弹窗与模型质量未替代验收；官网/安装器推广结果见[修复报告](ops/2026-11-07-isolated-wallet.md)所链接PR。

## 历史已发布版本（2026-11-07，0.2.1）

0.2.1 包括 Binance 速览与独立研究工作台、公共证据与按需 AI 查证、应用内条件提醒/冻结复盘、颜色偏好与主动更新检查。[版本 PR #61](https://github.com/hash-panda/positionscope/pull/61)与[装订重试 PR #62](https://github.com/hash-panda/positionscope/pull/62)已合并，发布 source 为 `fb4c6e0d660875a846dc078e73e672f866e11153`。[运行 42368451830](https://github.com/hash-panda/positionscope/actions/runs/42368451830)双架构签名、公证、装订、Gatekeeper及包内图标核验通过；[Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.1)于 `2026-11-07T11:38:20Z` 发布四个 DMG/ZIP、两个验证 JSON 和校验和。三个文本资产已下载重算摘要，四个二进制摘要与 GitHub 元数据交叉核对，记录位于 [docs/releases/v0.2.1](releases/v0.2.1/)。安装器固定摘要、官网七页与下载元数据另经推广 PR/CI 核验；线上部署结果记在[验收报告](ops/2026-11-07-numeric-release.md)所链接的推广 PR。

“检查更新”读取官方 GitHub 稳定版元数据并由用户打开 Release 页；不会自动下载或安装，也不以资产存在替代包签名核验。公共研究账本为本机 0600 JSON，账户/模型 Key 等配置仍单独使用 safeStorage 加密。原生 Mac、签名包钥匙串弹窗、真实账户/模型与收益能力仍未验收。

以下保留各版本发布时的历史记录；其中的“工作台设计提案”等描述仅指当时版本，不表示当前源码仍停留在提案阶段。

## 历史已发布版本（2026-11-07，v0.2.0-beta.16）

[PR #53](https://github.com/hash-panda/positionscope/pull/53) 修复币安汉字 USDT 合约被误拒、首次读取失败显示零盈亏/持仓数和暂停刷新提示。合约标识贯穿持仓、风险事实及公共行情，保持结算、长度、字符与元数据边界；本地诊断不透传原始响应，成功空仓仍显示零。102 项 Node、5 项 Python、类型/构建、UI/axe 与合成 Mac 见 [PR CI](https://github.com/hash-panda/positionscope/actions/runs/42360949679)及[主分支 CI](https://github.com/hash-panda/positionscope/actions/runs/42361140885)。[签名发布](https://github.com/hash-panda/positionscope/actions/runs/42361141010)双架构签名、公证、装订、Gatekeeper 与 publish 成功；[Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.16)和 docs/releases/v0.2.0-beta.16 七资产已核对，详见 docs/ops/2026-11-07-beta16-release.md。合成复现不代表已确认用户实际原因。新版 AI 工作台仍为设计提案；真实 Mac/账户/模型、签名包权限弹窗及完整日志/时效审计仍未验收。不重配正常 Apple 凭证，不迁移旧预览版。

## 前序发布记录（2026-11-04，v0.2.0-beta.15）

[PR #47](https://github.com/hash-panda/positionscope/pull/47)修复相同平台持仓ID在单向仓方向翻转时的快照事件漏记/误记，分别展示旧方向消失与新方向新增；仍拒绝同快照重复身份，不改变排序身份或金融公式。93项Node、5项Python、类型/构建、320px方向事件/UI/axe与合成Mac见[PR CI](https://github.com/hash-panda/positionscope/actions/runs/41753165841)及[主分支CI](https://github.com/hash-panda/positionscope/actions/runs/41753415002)。[签名发布](https://github.com/hash-panda/positionscope/actions/runs/41753415004)双架构签名、公证、装订、Gatekeeper及publish成功；下载见[Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.15)与docs/releases/v0.2.0-beta.15，核验见docs/ops/2026-11-04-beta15-release.md。快照差异不等于成交、转账或执行顺序；真实Mac/账户/模型、签名包权限弹窗及完整日志/时效审计仍未验收。正常Apple凭证不重配，不迁移旧预览版。

## 前序发布记录（2026-11-02，v0.2.0-beta.14）

[PR #43](https://github.com/hash-panda/positionscope/pull/43)修复资金费参考源/获取时间、结算时点校验与对应分析缓存失效；显式重析不复用过期资金费情景，有效情景不变仍缓存。85项Node、5项Python、类型/构建、UI/axe与合成Mac见[PR CI](https://github.com/hash-panda/positionscope/actions/runs/41374313218)及[主分支CI](https://github.com/hash-panda/positionscope/actions/runs/41374554953)。[签名发布](https://github.com/hash-panda/positionscope/actions/runs/41374554959)双架构签名、公证、装订、Gatekeeper及publish成功；下载见[Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.14)和docs/releases/v0.2.0-beta.14。核验与官网同步见docs/ops/2026-11-02-beta14-release.md。既有历史分析/全部行情时效、全仓日志、签名包权限弹窗和用户Mac/真实账户/模型仍未验收；不重配正常Apple凭证，不迁移旧预览版。

## 前序发布记录（2026-10-31，v0.2.0-beta.13）

[PR #40](https://github.com/hash-panda/positionscope/pull/40)移除Anthropic聊天/JSON/SSE的隐式温度0.7，普通配置使用模型/API默认采样；保留明确覆盖（含0），不改模型/API版本或token预算。78项Node、5项Python、类型/构建/UI/axe与Mac检查见PR实际CI；[签名发布](https://github.com/hash-panda/positionscope/actions/runs/41157062325)双架构签名、公证、装订、Gatekeeper和publish成功。下载见[Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.13)与docs/releases/v0.2.0-beta.13，同步证据见docs/ops/2026-10-31-beta13-release.md。显式不兼容参数仍可能被拒绝，不代表所有模型或真实语义质量已验收。全仓日志、签名包权限弹窗、用户Mac/真实账户/模型仍未验证；不重配正常Apple凭证，不迁移旧预览版。

## 前序发布记录（2026-10-28，v0.2.0-beta.12）

[PR #36](https://github.com/hash-panda/positionscope/pull/36)收口交易所聚合错误返显、Binance现货错误及四适配器代理主机日志。68项Node、5项Python、类型/构建/UI/axe与Mac基线通过[PR CI](https://github.com/hash-panda/positionscope/actions/runs/40617182241)和[主分支CI](https://github.com/hash-panda/positionscope/actions/runs/40617337510)。[签名发布40617337569](https://github.com/hash-panda/positionscope/actions/runs/40617337569)双架构签名、公证、装订、Gatekeeper与publish成功；产物见[Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.12)和docs/releases/v0.2.0-beta.12。具体摘要核对和下载同步证据见docs/ops/2026-10-28-beta12-release.md。全仓日志、签名包权限弹窗、用户Mac、真实账户与模型仍未验证；未知故障不等于网络问题。正常Apple凭证保持，不迁移旧预览版。

## 前序发布记录（2026-10-26，v0.2.0-beta.11）

[PR #32](https://github.com/hash-panda/positionscope/pull/32)收口AI HTTP/SSE、Provider与主进程错误日志，移除聊天前缀及原始响应/错误返显；64项Node、5项Python、类型/构建/UI/axe与Mac基线通过。签名发布[40259459498](https://github.com/hash-panda/positionscope/actions/runs/40259459498)双架构签名、公证、装订、Gatekeeper及publish均成功；[Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.11)七项资产摘要及验证记录已核对，见docs/releases/v0.2.0-beta.11。完整交易所/渲染器日志审计、签名包权限弹窗、用户Mac、真实账户与模型仍未验证；详见docs/ops/2026-10-26-ai-log-privacy.md。未变更正常Apple凭证，不做旧预览版迁移。


## 前序发布记录（2026-10-25，v0.2.0-beta.10）

本轮已合并PR [#24](https://github.com/hash-panda/positionscope/pull/24)、[#25](https://github.com/hash-panda/positionscope/pull/25)、[#26](https://github.com/hash-panda/positionscope/pull/26)、[#27](https://github.com/hash-panda/positionscope/pull/27)：应用图标/官网色板/组件控件统一；纠正OKX单位及方向、Bybit签名及账户口径；增加参考强平/保证金、独立平台事实、保持/缩减敞口情景和按需公共市场研究；模型ID显式选择，不静默升级费用。

[Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.10) 与[发布运行40188968613](https://github.com/hash-panda/positionscope/actions/runs/40188968613)已完成arm64/x64签名、公证、装订和Gatekeeper。两份验证JSON与校验文件本地重算摘要，四个二进制声明与GitHub资产digest一致，包内ICNS/Template字节与源一致。记录在[docs/releases/v0.2.0-beta.10](releases/v0.2.0-beta.10/release.json)。57项Node、5项Python、类型、构建与UI/axe已通过源码/PR验证；用户Mac安装、签名包钥匙串弹窗、真实账户与真实模型质量仍未验证。签名通过不代替这些验收。

市场范围仅Binance USDT永续合约，不是全市场；基本面、解锁、盘口与长期账户历史未接入。按平台资产代码匹配仍未完成面额/重名项目身份映射，真实字段对照仍重要。详见[风险基础](ops/2026-10-25-risk-foundation.md)、[市场研究](ops/2026-10-25-market-context.md)、[模型生命周期](ops/2026-10-25-model-lifecycle.md)。Apple现有Secrets和证书保持，不要求重新配置；证书到期2027-11-23。


## 历史状态（2026-10-25，v0.2.0-beta.5）

按维护者要求采用全新实现，不兼容或迁移此前预览版。PR [#17](https://github.com/hash-panda/positionscope/pull/17) 已合并：独立应用身份 `app.funagent.positionscope` 与 PositionScope 数据目录，Electron 45 异步 safeStorage 加密完整配置；失败保留原密文，串行原子提交，移除明文保存和旧凭据接口。首次使用需要重新配置只读账户。

本地33项Node、4项Python、类型、生产构建与480×600/320px UI/axe回归通过。[PR CI](https://github.com/hash-panda/positionscope/actions/runs/40163118641) 的Mac任务使用真实系统API及隔离合成profile，两次进程启动验证加密、解密回读、重置、定向移除和删除。该检查也在两个签名前runner通过。

[beta.5 Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.5) 的双架构DMG/ZIP已经[发布运行](https://github.com/hash-panda/positionscope/actions/runs/40163284199)通过签名、公证、装订与Gatekeeper。公开记录见 [docs/releases/v0.2.0-beta.5](releases/v0.2.0-beta.5/release.json)。两份验证JSON和校验文件已本地重算摘要，四个二进制哈希与GitHub资产digest核对；没有在本地安装二进制。

仍未验证：签名安装包的钥匙串权限弹窗、用户Mac原生UI/自动启动、真实账户和模型质量；全仓库日志脱敏亦未完成。Mac CI是开发Electron加合成凭据，不能代替这些验收。旧版迁移不再列入待办，不把签名通过当作全部隐私或金融准确性验证。



## 与 AIbubu 的对应

参考 [funAgent/ai-bubu 的 release.yml](https://github.com/funAgent/ai-bubu/blob/main/.github/workflows/release.yml)。沿用六个 Apple Secret 名称；AIbubu 是 Tauri，本项目是 Electron，因此重做构建、签名、公证、装订与验证步骤。Tauri 的 updater/minisign 私钥不是 Apple Developer ID，不复制到本项目。

在 [仓库 Actions Secrets](https://github.com/hash-panda/positionscope/settings/secrets/actions) 配置以下值。已有 GitHub Secret 不能读出或跨仓库复制，需从你自己保管的原始资料重新录入；不要放到 Issue、聊天或代码中。

| Secret | 内容 |
| --- | --- |
| APPLE_CERTIFICATE | 从钥匙串导出的含私钥 Developer ID Application .p12 的 base64 |
| APPLE_CERTIFICATE_PASSWORD | 导出 .p12 时设置的密码 |
| APPLE_SIGNING_IDENTITY | 完整的 `Developer ID Application: … (TEAMID)` 身份名 |
| APPLE_ID | Apple 开发者账号的 Apple ID |
| APPLE_PASSWORD | 此 Apple ID 的 App 专用密码，不是登录密码 |
| APPLE_TEAM_ID | 对应证书的团队 ID |

证书必须是 Developer ID Application（用于商店外分发），不是 Apple Development、Distribution 或 Developer ID Installer。账号持有者需要接受当前 Apple 协议。首次公证权限或证书问题以 Apple 返回为准。

## 运行

1. PR 的质量检查与独立审查通过后合并仓库当前默认分支。当前默认分支为 main，过渡期间工作流接收 main/master；签名前按 `github.event.repository.default_branch` 检查提交属于默认分支，不硬编码旧分支名。
2. 新发布从 **0.2.1** 开始，只允许纯数字 `x.y.z`，Git tag 可有 `v` 前缀，Release 明确 `prerelease=false`。阶段功能 PR 保留当前已发布版本，直到最终发布 PR 才更新 package.json 和 release-notes；下一版使用 0.2.4，阶段顺序见 [实施计划](IMPLEMENTATION-PLAN.md)。
3. 在 [Signed macOS release](https://github.com/hash-panda/positionscope/actions/workflows/signed-release.yml) 选择当前默认分支 → Run workflow。手动运行会检查密钥，不会降级成未签名发布。
4. 两架构成功后检查 ZIP/DMG、SHA256SUMS 和各自 verification.json，再修改官网的版本与安装状态。数字发布不代表真实账户、模型或用户Mac已验收，证据范围仍分别记录。
5. 已在 [Variables](https://github.com/hash-panda/positionscope/settings/variables/actions) 配置 `APPLE_SIGNING_ENABLED=true`，影响二进制的默认分支提交自动尝试发布；文档/官网改动不会触发签名。流水线**先查询当前版本是否已发布，再对不存在的新版本执行数字版本门禁**：已发布beta.16继续正常跳过，不重签/覆盖；不存在的beta/rc/build版本拒绝。查询失败不当作版本不存在，也不允许签名。正常Apple配置保持，无需重配。

流水线要求构建提交属于仓库当前默认分支；PR 不得到 Apple Secrets。签名 runner 使用临时钥匙串、最小 hardened runtime entitlement；验证 codesign 身份与团队，提交 notarytool，要求 Accepted，装订票据并验证 spctl，之后才上传和发布。DMG 单独签名、公证与装订。所有 action 固定提交 SHA；没有使用不受控第三方签名 action。日志不输出密钥、密码、私钥长度或密钥承载命令参数。临时钥匙串最后清除。

`python3 scripts/release-signed-mac.py --arch arm64 --check` 只验证输入存在与结构，不证明证书有效。Linux 单元测试不等于 macOS 签名验收；真实签名仍需 macOS runner 和六个 Secret。arm64 与 Intel 的安装、启动、菜单栏、网络代理、全新配置与钥匙串权限及 Gatekeeper 在干净 Mac 上人工回归后才标记实机通过。0.2.3 起支持用户主动下载、验证后重启更新；签名流程还须通过独立测试身份/合成 profile 的原生替换与重启演练。它不替代用户 Mac 的真实配置及权限验收。

## 失败、恢复与撤回

任一架构失败则不发布。依据步骤名称检查原始 Apple 服务/证书权限，在自有安全环境排查，不把证书或完整敏感日志贴公开。部分构建产物不等于可发布版本。首次失败修复后重跑；已创建版本不可覆盖，修复用新版本。发布后发现严重问题，先在官网标明不可用并提供上一已验证版本，再发布修复；不要重用同一个版本号替换二进制。

来源：[Apple Developer ID](https://developer.apple.com/developer-id/)、[Apple 公证](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)、[Electron 签名](https://www.electronjs.org/docs/latest/tutorial/code-signing)。实现同时按本仓库安装的 electron-builder 26.18.0 源码核对配置，不能套用其他版本行为。

## 当前证书核对记录

新证书到期：2027-11-23。公钥证书 SHA256：`0e4cc86f3c63f7331684cc9da927ca2068b20ff199260b928e918d1e97f5240c`。这仅标识已导入证书，不代替安装包签名/公证验证。私钥、PKCS#12、导出密码与 App 专用密码不提交到源码；原始材料仅用于安全配置 Secrets，不放入构建产物或报告。

Secret 中保留完整 Developer ID 身份，electron-builder 配置仅传不含类型前缀的名称选择器；原生签名验证仍检查完整身份与团队。构建失败输出仅显示经过凭证值脱敏的诊断；密钥承载的命令输出继续保留。

## 2026-10-25 后续修订与发布

PR #14 修正 Hyperliquid 标准账户余额、估值、提现字段和模式边界；PR #15 区分菜单栏异常与无持仓。v0.2.0-beta.4 已经发布运行 40157740551 完成双架构签名、公证、装订及 Gatekeeper 自动验证。28项Node、4项Python、类型、构建及UI/axe回归通过。证据在 docs/releases/v0.2.0-beta.4（相对仓库根目录）；两份验证JSON和校验文件已和GitHub资产摘要核对，不代表Mac原生UI或真实账户验证。

仅允许userAbstraction=disabled的标准模式，默认永续DEX加现货；其他模式明确不支持，不修改账户模式。缺余额或价格即报错，USDC/USDT按1:1估算；可用余额是未占用保证金估算，未含其他DEX、质押、借贷。该版本发布时的待验项目由顶部当前状态取代；此前预览版迁移已取消。
