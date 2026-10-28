# macOS 签名与发布

## 当前已发布版本（2026-10-28，v0.2.0-beta.12）

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

1. PR 的质量检查通过后合并 master。每个发布版本更新 package.json 和 release-notes，已有 Release 不覆盖。
2. 在 [Signed macOS release](https://github.com/hash-panda/positionscope/actions/workflows/signed-release.yml) 选择 master → Run workflow。手动运行会检查密钥，不会降级成未签名发布。
3. 两架构成功后检查 ZIP/DMG、SHA256SUMS 和各自 verification.json，再修改官网的版本与安装状态。
4. 已在 [Variables](https://github.com/hash-panda/positionscope/settings/variables/actions) 配置 `APPLE_SIGNING_ENABLED=true`，以后影响二进制的 master 提交自动尝试发布；文档/官网改动不会触发签名。流水线先查询当前版本的 Release，已有版本直接跳过，不覆盖产物。新的二进制需先更新 package.json 版本。可删除变量关闭自动签名。

流水线要求构建提交属于 master；PR 不得到 Apple Secrets。签名 runner 使用临时钥匙串、最小 hardened runtime entitlement；验证 codesign 身份与团队，提交 notarytool，要求 Accepted，装订票据并验证 spctl，之后才上传和发布。DMG 单独签名、公证与装订。所有 action 固定提交 SHA；没有使用不受控第三方签名 action。日志不输出密钥、密码、私钥长度或密钥承载命令参数。临时钥匙串最后清除。

`python3 scripts/release-signed-mac.py --arch arm64 --check` 只验证输入存在与结构，不证明证书有效。Linux 单元测试不等于 macOS 签名验收；真实签名仍需 macOS runner 和六个 Secret。arm64 与 Intel 的安装、启动、菜单栏、网络代理、全新配置与钥匙串权限及 Gatekeeper 在干净 Mac 上人工回归后才标记实机通过。当前未实现自动更新；Apple 签名也不会自动带来更新能力。

## 失败、恢复与撤回

任一架构失败则不发布。依据步骤名称检查原始 Apple 服务/证书权限，在自有安全环境排查，不把证书或完整敏感日志贴公开。部分构建产物不等于可发布版本。首次失败修复后重跑；已创建版本不可覆盖，修复用新版本。发布后发现严重问题，先在官网标明不可用并提供上一已验证版本，再发布修复；不要重用同一个版本号替换二进制。

来源：[Apple Developer ID](https://developer.apple.com/developer-id/)、[Apple 公证](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)、[Electron 签名](https://www.electronjs.org/docs/latest/tutorial/code-signing)。实现同时按本仓库安装的 electron-builder 26.18.0 源码核对配置，不能套用其他版本行为。

## 当前证书核对记录

新证书到期：2027-11-23。公钥证书 SHA256：`0e4cc86f3c63f7331684cc9da927ca2068b20ff199260b928e918d1e97f5240c`。这仅标识已导入证书，不代替安装包签名/公证验证。私钥、PKCS#12、导出密码与 App 专用密码不提交到源码；原始材料仅用于安全配置 Secrets，不放入构建产物或报告。

Secret 中保留完整 Developer ID 身份，electron-builder 配置仅传不含类型前缀的名称选择器；原生签名验证仍检查完整身份与团队。构建失败输出仅显示经过凭证值脱敏的诊断；密钥承载的命令输出继续保留。

## 2026-10-25 后续修订与发布

PR #14 修正 Hyperliquid 标准账户余额、估值、提现字段和模式边界；PR #15 区分菜单栏异常与无持仓。v0.2.0-beta.4 已经发布运行 40157740551 完成双架构签名、公证、装订及 Gatekeeper 自动验证。28项Node、4项Python、类型、构建及UI/axe回归通过。证据在 docs/releases/v0.2.0-beta.4（相对仓库根目录）；两份验证JSON和校验文件已和GitHub资产摘要核对，不代表Mac原生UI或真实账户验证。

仅允许userAbstraction=disabled的标准模式，默认永续DEX加现货；其他模式明确不支持，不修改账户模式。缺余额或价格即报错，USDC/USDT按1:1估算；可用余额是未占用保证金估算，未含其他DEX、质押、借贷。该版本发布时的待验项目由顶部当前状态取代；此前预览版迁移已取消。
