# beta.15发布与官网下载同步

[PR #47](https://github.com/hash-panda/positionscope/pull/47)合并为737067284c2ebae9b2a37acbec0fe0edefc357e5。[PR CI 41753165841](https://github.com/hash-panda/positionscope/actions/runs/41753165841)与[主分支41753415002](https://github.com/hash-panda/positionscope/actions/runs/41753415002)全部成功：实际93项Node/通过93/失败0、5Python、类型/构建、7页静态、UI errors=[]/axe与合成Mac基线。UI新增320px稳定ID等量反向的真实renderer交互，断言旧多方向1→0与新空方向0→1两条可见记录；不是单独mock事件数组。本地同锁文件复用已安装依赖，通过类型/93Node/构建/5Python/静态；本地未运行Chromium或Mac。

本轮仅修复事件索引：排序/平台身份保持，事件身份含方向，单快照重复平台身份继续拒绝。等量/不等量双向变化、同向增量/只改价格、对冲/跨所隔离均有合成回归；不代表真实账户已验收。它描述相邻成功快照，不证明成交、资金转移、真实平开仓或执行顺序，不还原采样间路径；缺口重建基线规则保持。金额/风险/资金费/权限/数据发送路径均不变。

[既有签名流程41753415004](https://github.com/hash-panda/positionscope/actions/runs/41753415004)只有双架构签名、公证、装订、Gatekeeper和publish全部通过后才算新Release已发布；七项资产、tag/target/源码及验证记录/摘要核对通过后才同步下载。最终运行、发布时间与核验另追加，不提前计通过。正常Apple Secrets保持，证书记录2027-11-23到期，不撤销/重配；未签名不能作为回退。

下载同步将更新官网/README/安装说明/当前规范和双架构ZIP固定摘要，旧公开清单保留；源站内容与应用图标/色板/布局沿用同一套。方法页解释方向快照，sitemap对变更页更新11月4日，未改的只读配置/隐私页保留10月25日/28日。纯网站/文档/安装器不触发重复签名。

打开同一公开Sites第12版，源6c840c6d2d89eadd32221f256b452980edb80489；16个文件与仓库website逐字节一致，身份manifest保留。新源码推送/保存/实际部署须完成后回填#7，不把本地源码当部署成功；本轮不额外声称网页视觉验收。

用户Mac安装/钥匙串权限弹窗/原生窗口/自动启动、真实账户/模型及完整日志/时效审计仍未验收；合成Mac系统API、签名公证与CI下载验签分开。独立应用身份与系统加密保持，不做旧预览版迁移。官方依据、六项证据与起点官网/增长快照见[今日评审](2026-11-04.md)。Search Console/Bing属性/Live URL及真实增长仍未知，未外发/付费/刷量。

## 已完成的发布证据与下载同步门禁

签名运行41753415004的quality、sign(x64)、sign(arm64)、publish全部success，head为737067284c2ebae9b2a37acbec0fe0edefc357e5。[Release beta.15](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.15)实际published_at为2026-11-04T01:27:14Z（北京时间09:27:14）；Git tag与release target均为同一源码。七项公开资产（四安装包、两验证JSON、SHA256SUMS）名称/架构/长度/摘要全部收录于[清单](../releases/v0.2.0-beta.15/release.json)。

本地重新下载并计算两验证JSON和checksum三个文本资产的SHA256/长度，匹配GitHub API；四二进制摘要声明同时匹配API、验证JSON与checksum，未在本地下载重算完整安装包、安装或运行Mac App。两架构记录显示app.funagent.positionscope、macOS 13、签名/公证/装订/Gatekeeper通过，打包App及托盘图标匹配；系统加密/跨进程回读仅为隔离合成profile，packaged_app_keychain_prompt_tested与native_ui_tested均false。

下载同步本地已通过7页静态/当前发布清单、9项安装器/发布证据/canonical回归、5项Python、安装器bash语法及diff检查。新安装器固定beta.15双架构ZIP摘要。独立PR仍须既有checks/storage-macos/quality全绿，特别是Mac --verify-only实际下载beta.15并检查摘要/签名/Gatekeeper；PR #47的Mac安装器检查对应旧beta.14，不混算为本项。纯内容同步不触发新的签名发布。

本报告提交时，网站部署尚未计为完成；待下载同步PR通过并合并，才把逐字节匹配的16个静态文件推送同一Sites源仓、保存并部署到同一公开域名。实际PR/CI/source SHA/保存版本/部署ID与六公开资源核验结果将追加到[#7](https://github.com/hash-panda/positionscope/issues/7)，避免预填未来结果。起点09:11的JSON仍明确对应beta.14，不冒充部署后结果。不会据内容发布推断搜索收录、用户增长、账户验收或收入。
