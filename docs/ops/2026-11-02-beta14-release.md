# beta.14发布与下载同步

2026-11-02，[PR #43](https://github.com/hash-panda/positionscope/pull/43)合并为11ddeeeb98f5177b290202c7eb7df96dd196123d；[PR CI 41374313218](https://github.com/hash-panda/positionscope/actions/runs/41374313218)与[主分支质量41374554953](https://github.com/hash-panda/positionscope/actions/runs/41374554953)三个检查全部成功。实际85项Node/通过85/失败0、5项Python、类型/构建、7页/UI errors=[]及axe、隔离合成Mac基线通过。本地类型/85Node/生产构建/5Python/站点/diff也通过，未在本地运行浏览器或Mac。

[beta.14 Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.14)发布于北京时间09:56:51，Release target及实际tag均指向上述源码。[签名运行41374554959](https://github.com/hash-panda/positionscope/actions/runs/41374554959)quality、arm64、x64、publish全部success。两个架构均通过原已验收流程的app/DMG签名、Apple公证、装订和Gatekeeper；不使用未签名回退，不覆盖旧Release。正常Apple Secrets保持，证书记录到期2027-11-23，不撤销或重复配置。

修复资金费条件估算的源/本地时间与结算有效性，并把计算情景纳入分析缓存身份；同快照在过期/结算后显式重析不会复用仍含旧资金费的解释。不增加后台模型调用、自动重试或交易权限；显式重析失效后可能发生正常模型费用。方向与比例公式保持。已展示历史分析、全部市场字段/在途模型延迟和其他缓存时效不属于已完成审计；真实模型语义仍未知。

七项资产完整后，本地实际下载两份验证JSON和SHA256SUMS，重算三项大小/sha256与API匹配；四个二进制摘要声明与验证记录/校验文件/API digest逐项一致。核对版本、架构、应用身份、最低macOS13、系统加密合成回读和包内图标源hash。没有在本地重算或安装四个二进制；不能把合成Mac系统API测试当签名包权限弹窗。网络曾出现代理CONNECT超时，随后原下载成功；GitHub连接器获取了备用arm64产物引用，未用于本地二进制验算，不以此声称额外验证。记录保存在docs/releases/v0.2.0-beta.14。最终PR/官网部署另记，不提前报通过。同步源码包含官网/README/安装说明/规范和固定安装器摘要，历史清单保留。下载页与方法页说明过期资金费情景；sitemap仅对实际变更页面更新日期，只读配置页保留10月25日，隐私页保留10月28日。纯官网/文档/安装脚本不触发重复签名。

网站仍沿用同一公开Sites、自有域名、应用图标与色板。打开第11版源码18a682955fa59073a6e5d92f325b92a2db8b28d4，16个文件与仓库website逐字节一致。生产源推送/保存/部署会使用同一项目与身份manifest；源码同步与生产抓取证据分开，本轮未做额外网页视觉验收。机器超时/403及缺少Search Console/Bing报告仍#7，不绕过策略，不声称全球宕机或搜索收录。

09:58公开API快照见[metrics](metrics/2026-11-02-daily.json)：Stars/Forks/Watch均0，新beta.14七项资产计数均0，这是当时累计请求观察，不是用户数或付费证据，后续核验/CI会改变计数。访问、确认激活、W1、付费/收入、渠道成本/支持工时仍未知。无外部品牌渠道或商户预算，未外发/付费/刷量。

用户Mac安装/权限弹窗/自动启动、真实账户和模型、全仓日志继续#3；跨平台/盘口/长期账单/基本面/解锁/身份映射继续#23；不迁移旧预览版，不读取本机或发送真实持仓。今日100分框架及官方来源见[每日评审](2026-11-02-daily.md)。

## 同步验证

本地7页canonical/metadata/内链/robots/sitemap/离线发布证据、9项安装器/发布证据/canonical回归、5项Python、安装器shell语法和diff通过。沿用原网页布局/图标/色板，不新增浏览器视觉验收。独立同步PR需既有质量/UI/axe及Mac真实下载新版ZIP验签通过后合并，再发布同一Sites；最终链接/源码/版本和状态回填#7，不以源码更新代替生产部署。
