# beta.11发布与下载同步

2026-10-26，继[#32](https://github.com/hash-panda/positionscope/pull/32)的AI/HTTP与主进程日志修复，已发布[v0.2.0-beta.11](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.11)，源码e2260a68828cb49f9badb9ab1f6360ec15c603de。发布时间2026-10-26 10:38:07北京时间，tag指向上述源码。[签名运行40259459498](https://github.com/hash-panda/positionscope/actions/runs/40259459498)的quality、arm64、x64、publish全部成功；沿用现有六项Apple Secrets和已验证工作流，不覆盖旧Release或发布未签名回退。

两架构app/DMG完成签名、公证、装订和Gatekeeper accepted，四个安装包与两份验证JSON、SHA256SUMS齐全。本地下载三份文本资产逐字节重算摘要，与GitHub资产digest一致；四个二进制声明同时与验证JSON、校验文件及GitHub digest核对。包内应用图标hash与源ICNS一致，验证记录中的Template、隔离系统加密回读为通过。未在本地下载并重算全部二进制，更未安装或读取用户Mac。可复核证据在[版本清单](../releases/v0.2.0-beta.11/release.json)。

代码PR的64项Node、5项Python、类型、构建、UI/axe与Mac基线已通过；[合并后质量运行40259459505](https://github.com/hash-panda/positionscope/actions/runs/40259459505)也通过。新增四组回归仅用合成标记，覆盖HTTP/SSE、六提供商错误返显、无效JSON和聊天日志；不调用真实账户/模型。不把本次有界修复当作交易所适配器、渲染器等全仓日志审计已完成。

本次同步准备：官网release.json/首页/下载/辅助索引指向beta.11，隐私说明限定已修复的日志范围；固定安装器更新双架构ZIP摘要，不读取或迁移旧预览版配置；README和产品/质量/签名规范保留未验证项，历史报告不回填。安装器Mac实际下载/验签与官网生产发布的最终状态见[#7最新验收评论](https://github.com/hash-panda/positionscope/issues/7)，源码更新不等于已生产部署。该同步不改二进制，不重复签名。

用户Mac原生UI/自动启动、签名安装包钥匙串权限弹窗、真实只读字段与模型质量仍未知；没有自动更新能力。完整日志审计继续#3，市场/资产身份缺口继续#23，搜索权限和403抓取问题继续#7。网站访问、激活、留存、付费/收入/成本/工时仍未知；不将验证下载视为用户，不对外群发或付费推广。证书到期2027-11-23，无需重配正常Apple凭证。
