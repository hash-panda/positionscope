# 2026-10-25 本轮实现与发布验收

最终版本[v0.2.0-beta.10](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.10)，源码d260475876b66b8764d5c520fec4a58f345539ee。[签名发布40188968613](https://github.com/hash-panda/positionscope/actions/runs/40188968613)的quality、arm64/x64、publish全部成功；tag指向该源码。7项资产齐全，两份JSON与校验文件本地重算摘要，4个二进制声明与GitHubdigest核对；没有在本地安装二进制。

## 已完成范围

- #21应用图标已进入ICNS/菜单栏Template和原生验证；#24官网与App共用tokens、图标，组件化Select/Switch/Slider/TextInput，修复Escape/异步焦点/标签清空；代理默认遮蔽。
- #25修正OKX合约单位/空仓、Bybit签名/分页/UNIFIED以及缺值不补零；补参考强平与保证金、独立交易所口径和条件情景。
- #26按需公共市场研究和AI背景/条件资金费，不自动交易；范围、时间、窗口、单位与缺口可见。
- #27移除退役的隐式模型默认；显式选择与价格由用户核对，关闭AI撤销Provider/缓存，主进程再检查启用状态。
- 官网/README/方法/隐私与模型说明按实际能力修订；多平台演示的现货拆分/可用余额显示不可用，避免把无法拆分字段伪造成已知值。安装器固定最终版本和双架构ZIP摘要，保留--direct解决本地失效代理；不读取/删除用户配置。

## 按100分标准记录证据，未验证不计虚构总分

| 权重 | 已核对 | 未验证或缺口 |
| --- | --- | --- |
| 数据25 | 合成单位/方向/分页/缺值/时间与模式；OKX规格和BybitHMAC mock | 真实字段/区域网络；缩放面额与同名资产的项目身份映射；部分市场未覆盖 |
| 风险25 | risk-facts-v2、逐平台权益、强平参考与情景/资金费复算、输出形状/缓存 | 真实模型事实一致性、长持有期/基本面/解锁/账户历史；形状校验不保证结论 |
| UI20 | 480×600与320px、键盘/空错态/隐私/组件弹层及UI/axe | 用户Mac窗口/菜单栏/钥匙串弹窗；实际理解与长期比较效率 |
| 隐私15 | safeStorage跨进程合成Mac CI、最小风险包、公开接口无账户凭证、关闭AI禁用 | 全仓日志审计和真实用户隐私验收 |
| 发布10 | 57项Node、5项Python、类型/构建、PR CI；双架构签名公证装订Gatekeeper、包内图标字节核对 | 用户Mac安装与原生启动/交互，不做旧预览版迁移 |
| 官网5 | 7页元数据/内链/robots/sitemap/canonical/图标tokens；已核对的下载摘要 | 搜索控制台/真实收录/访问/激活/留存/付费数据未知 |

## 官方调研与真实增长证据

原始来源、核对日期和最小验证分别在[risk-foundation](2026-10-25-risk-foundation.md)、[market-context](2026-10-25-market-context.md)、[model-lifecycle](2026-10-25-model-lifecycle.md)。无证据更好的SDK不替换稳定REST；没有用模型换代宣传收益或安全。没有真实账户/模型调用，所有项目测试均为合成或mock。

GitHub读取时Public、Stars=0/Forks=0；[指标快照](metrics/2026-10-25.json)的Release下载是请求计数，不是用户或收入。Search Console停在登录入口，未取得属性和效果报告；一次站点限定检索无返回，不能推断收录状态。Bing未验证。没有访问、激活、留存或收入数据，全部未知。外部品牌/社区入口与发布范围未提供，未群发、买Star、投广告或擅自收费。

## 尚需配合的具体边界

用户Mac需运行最终安装器并处理本机权限提示，再自行配置只读账户对照数量/方向/标记价/强平/时间；反馈只要脱敏报告，不上传Key或持仓。Search Console/Bing需有funagent.app属性权限的账号；外部宣发需明确品牌账号/渠道和范围；生产全市场数据需选择具合适授权/额度的方案与预算，不在聊天提供密钥。不要求重新配置已工作的Apple Secrets。

官网生产部署与最终安装器Mac CI以[#7的本轮验收评论](https://github.com/hash-panda/positionscope/issues/7)及同步PR检查为准；预览不等于生产，未通过的项目不记通过。

## 官网生产与安装器最终验收

同步PR [#28](https://github.com/hash-panda/positionscope/pull/28)已合并，其[质量运行40190191956](https://github.com/hash-panda/positionscope/actions/runs/40190191956)通过；Mac任务以失效代理负向对照及--verify-only --direct实际下载并验签beta.10，不能代替用户Mac安装。官网已在现有公开项目部署，浏览器确认[首页](https://positionscope.funagent.app/)与[下载页](https://positionscope.funagent.app/download/)显示beta.10，四个包/验证记录/CI链接准确；canonical为自有域名、加载的应用标识为128px、背景rgb(20,23,28)与共用tokens一致。生产截图为公开合成演示，不含用户账户数据。

下载/上手文案另明确四个平台的合约与账户范围，避免把Hyperliquid标准模式限制理解为所有平台限制。最后部署状态仍见#7验收评论；搜索收录、原生Mac、真实账户与模型验证继续保持未知。
