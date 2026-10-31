# beta.13发布与下载同步

2026-10-31，[PR #40](https://github.com/hash-panda/positionscope/pull/40)合并为e40b60cf55ca54aaa421d845460707c8dd99c023。[PR CI 41156940683](https://github.com/hash-panda/positionscope/actions/runs/41156940683)与[主分支质量41157062419](https://github.com/hash-panda/positionscope/actions/runs/41157062419)全部成功，78项Node、5项Python、类型/构建、7页/UI/axe和Mac基线有证据。本地亦通过78Node、类型/构建/5Python/站点；首轮依赖未完成的typecheck不计通过，未做本地浏览器或用户Mac验收。

[beta.13 Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.13)发布于北京时间09:54:36，Release目标及tag均指向上述源码。[签名运行41157062325](https://github.com/hash-panda/positionscope/actions/runs/41157062325)quality、arm64、x64、publish全部success。两架构app/DMG签名、公证、装订和Gatekeeper accepted；包内图标与源一致。沿用正常Apple Secrets及已验收流程，不覆盖beta.12、不回退未签名；证书记录到期2027-11-23。

本地实际下载两份验证JSON及SHA256SUMS，重算长度/摘要与GitHub资产size/digest一致；四个二进制的摘要声明逐一与验证JSON、checksum、API digest匹配。版本、架构、app_id、最低macOS13.0、系统加密合成回读及图标源hash核对。未在本地重算四个完整二进制或安装；系统API合成Mac检查不等于签名包权限弹窗或用户Mac/真实账户验收。[公开清单](../releases/v0.2.0-beta.13/release.json)保存证据。

修复范围是Anthropic默认chat/JSON/SSE不再隐式发送temperature=0.7；明确温度仍保留，型号/API版本与token上限未改，显式不兼容参数仍可能报错。使用模型默认采样可能改变输出和实际消耗，不能保证质量、输出token或费用相同；未做真实模型调用或语义评测，不宣称支持所有新型号。六例合成评测基线只是后续人工评测工具。其他提供商、金融口径及只读权限不变。

本次下载同步：官网/索引/README/当前规范指向已验证beta.13；下载页增加准确的采样说明；固定安装器更新双架构ZIP摘要。历史清单保留，不做旧预览版迁移。sitemap对版本/源码链接改变页更新10月31日，未改隐私页保留10月28日，只读配置页保留10月25日。源码发布说明由候选更新为已签名；Release创建时正文中的候选字样是构建时说明，实际状态以签名运行、Release标题和验证记录为准。

本同步PR须通过7页/离线证据门禁、安装器语法/摘要、Python及既有CI；Mac任务将实际下载新版ZIP验签，不能提前称已通过。最终PR/CI、Sites保存版本/源码SHA/归档/部署结果回填[#7](https://github.com/hash-panda/positionscope/issues/7)。源码更新不等于生产已部署；版式不改，未额外做浏览器视觉验收。纯网站/文档/安装脚本不触发重复签名。

本轮打开同一公开Sites第10版源码4d8d2d6fdec276da54ed5872b0a96fcc982f63cd，16个文件与仓库website逐字节一致；新版本继续推送同一源仓库、使用核对后的16文件和身份manifest打包。机器抓取403、Google/Bing属性报告和增长缺口仍保持，不绕过策略或擅自外发/付费。

用户Mac、权限弹窗、真实接口/模型及全仓日志继续#3，跨所市场/历史/账单/基本面与项目身份继续#23；没有访问、激活、留存或收入证据，仍标未知。今日官方来源及100分框架详见[每日评审](2026-10-31.md)。
