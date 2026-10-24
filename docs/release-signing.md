# macOS 签名与发布

状态（2026-10-24）：工作流已实现，尚未实际使用 Apple 凭证签名/公证。仓库 Secrets 页面确认当前没有密钥。v0.2.0-beta.1 是未签名开发预览，不能用本文件证明它已经公证。

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
4. 首次成功后可在 [Variables](https://github.com/hash-panda/positionscope/settings/variables/actions) 建立 `APPLE_SIGNING_ENABLED=true`，以后 master 提交自动尝试发布。无版本变动的提交不会覆盖已有发布，应避免为文档改动触发重复构建。可删除变量关闭自动签名。

流水线要求构建提交属于 master；PR 不得到 Apple Secrets。签名 runner 使用临时钥匙串、最小 hardened runtime entitlement；验证 codesign 身份与团队，提交 notarytool，要求 Accepted，装订票据并验证 spctl，之后才上传和发布。DMG 单独签名、公证与装订。所有 action 固定提交 SHA；没有使用不受控第三方签名 action。日志不输出密钥、密码、私钥长度或密钥承载命令参数。临时钥匙串最后清除。

`python3 scripts/release-signed-mac.py --arch arm64 --check` 只验证输入存在与结构，不证明证书有效。Linux 单元测试不等于 macOS 签名验收；真实签名仍需 macOS runner 和六个 Secret。arm64 与 Intel 的安装、启动、菜单栏、网络代理、配置迁移及 Gatekeeper 在干净 Mac 上人工回归后才标记实机通过。当前未实现自动更新；Apple 签名也不会自动带来更新能力。

## 失败、恢复与撤回

任一架构失败则不发布。依据步骤名称检查原始 Apple 服务/证书权限，在自有安全环境排查，不把证书或完整敏感日志贴公开。部分构建产物不等于可发布版本。首次失败修复后重跑；已创建版本不可覆盖，修复用新版本。发布后发现严重问题，先在官网标明不可用并提供上一已验证版本，再发布修复；不要重用同一个版本号替换二进制。

来源：[Apple Developer ID](https://developer.apple.com/developer-id/)、[Apple 公证](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)、[Electron 签名](https://www.electronjs.org/docs/latest/tutorial/code-signing)。实现同时按本仓库安装的 electron-builder 24.13.3 源码核对配置，不能套用其他版本行为。
