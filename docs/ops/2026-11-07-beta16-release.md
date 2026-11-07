# 2026-11-07 beta.16 签名发布核验

[PR #53](https://github.com/hash-panda/positionscope/pull/53) 已合并为 `ad3dcf9ed033b7da622752bbb95357e8f1f17198`，修复内容与已确认边界见 [Binance 故障报告](2026-11-07-binance-recovery.md)。[Issue #52](https://github.com/hash-panda/positionscope/issues/52) 已关联关闭。新版 AI 工作台不在本发布中。

## 实际通过的验证

[PR CI 42360949679](https://github.com/hash-panda/positionscope/actions/runs/42360949679) 对应 `d6aa54f2447cbc76d5e92b69105428449eeec589`；[主分支 CI 42361140885](https://github.com/hash-panda/positionscope/actions/runs/42361140885) 对应上述合并提交。两次 checks、storage-macos、quality 全部成功。PR 日志核对 102/102 Node、5 项 Python、类型、生产构建、官网检查及 UI errors=[]/axe。新增浏览器断言实际通过：首次失败未知盈亏/数量、旧数据说明、明确暂停、重新连接与底部刷新恢复；成功空仓仍显示零。合成 Mac 检查包含系统存储跨进程回读、品牌资源及既有安装器；此时安装器仍固定上一发布 beta.15，不能将其计为 beta.16 安装验证。

[签名运行 42361141010](https://github.com/hash-panda/positionscope/actions/runs/42361141010) 的 quality、sign (arm64)、sign (x64)、publish 全部成功。[beta.16 Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.16) 实际发布于 `2026-11-07T09:53:55Z`，Git tag 和 Release target 均指向 `ad3dcf9ed033b7da622752bbb95357e8f1f17198`。没有修改正常 Apple Secrets、证书或工作流，没有未签名回退。

## 资产核验

七项资产名称、大小、下载地址和 GitHub SHA256 已记录在 [release.json](../releases/v0.2.0-beta.16/release.json)。本地实际下载两份 verification JSON 和 SHA256SUMS，重新计算三个文件的长度及摘要，与 GitHub API 一致；四个安装包摘要同时匹配 API、验证 JSON 和 checksum。没有在本地下载重算四个完整安装包。

双架构验证记录确认 `app.funagent.positionscope`、macOS 13、签名、公证、装订和 Gatekeeper accepted；包内 App 图标摘要匹配仓库图标，托盘资源匹配。系统加密和跨进程回读仅使用隔离合成 profile；记录中的 packaged_app_keychain_prompt_tested 和 native_ui_tested 均为 false。

官网、README 与安装器的新版本推广需独立内容 PR 和检查后完成；本报告不将已发布 Release 等同于官网已同步。用户 Mac 安装、原生窗口、自动启动、签名包钥匙串权限、真实账户与模型质量仍未验收。中文合约的合成复现不代表确认维护者实际故障原因或账户已恢复。不迁移旧预览版，不新增交易权限或真实持仓发送。

## 下载同步准备

已将 website/release.json、官网生成文案、README、安装说明、当前发布规范与双架构 ZIP 固定摘要更新为已验证 beta.16，旧发布证据保留。七页静态、9 项安装器/发布证据/canonical 回归、5 项 Python、Bash 语法和差异检查本地通过。官网下载页仅增加本轮中文合约和未知/暂停状态修复，不宣称新版 AI 工作台已上线。内容 PR 仍要求现有 CI 和 Mac 实际下载 beta.16 的安装器检查通过后合并；Sites 发布与线上资源核对由合并后的部署结果另记，不预填为成功。
