# 2026-10-26 每日评审：canonical与站点地图防回归

默认分支起点1efafdfb8521a83a1a2e8c59237a48e2563bd4ec。开放#3/#7/#23，无开放PR；最近8次CI均成功。最新签名Release仍为v0.2.0-beta.10，7项资产及GitHub摘要与docs/releases一致；不重复签名或更换正常Apple凭证，证书到期2027-11-23，当前未到提前告警窗口。

## 本轮改进（复用#7）

源码scripts/verify-site.cjs此前只断言canonical标签存在；相同标签即便指向其他域名、首页或带fragment也能通过。现在每页要求head中仅一个canonical、精确匹配自有HTTPS域名和页面路径，排除评论/脚本伪装及不适用的语言/媒体属性。sitemap要求与实际HTML路由集合完全相等，不允许漏页、多页、重复或其他域名。三个负向回归组覆盖上述失效场景；这是现有CI的真实检查增强，不是搜索排名或收录提升证明。

没有修改任何website文件、桌面源码、安装器、版本或构建依赖；无需二进制发布或重新部署网站。相关PR/最终CI见#7本轮评论。现有beta.10四个签名安装包继续使用。

## 100分标准：有证据项与未验证项

| 权重 | 今日证据 | 剩余缺口 |
| --- | --- | --- |
| 数据25 | 现有单位/方向/空值/分页/时间测试本地通过 | 真实只读字段/网络、跨平台资产身份仍未验证 |
| 风险25 | 事实/情景/资金费/缓存/JSON形状合成回归通过 | 真实模型一致性、历史/基本面/解锁/盘口与全市场数据未验证 |
| UI20 | 本轮未改UI；完整UI/axe由本PR既有CI核对 | 用户Mac、实际理解与长期比较效率未知 |
| 隐私15 | 本轮仅静态站点检查，不读取财务数据或密钥 | 完整日志审计未完成；http-client.ts仍有原始错误响应日志，需单独清点，不能宣称无泄漏 |
| 发布10 | 本地60项Node、5项Python、类型、构建及7页检查通过；beta.10已签名记录保留 | 本轮CI以PR为准；用户安装/钥匙串/原生交互仍未验证 |
| 官网5 | 7页精确canonical/sitemap集合与负向回归通过；已读取公开仓库/Release计数 | 今日机器HTTP探针均403/error1010；Google/Bing实际抓取/索引/访问效果未知 |

不编造总分。机器HTTP探针对首页、下载、robots、sitemap、release.json均返回403和error code:1010；检索工具亦无法读取该站。未修改UA/代理或绕过托管安全策略。昨天浏览器可读的记录不能当作今天抓取成功；本轮未验证Googlebot或站点全体不可用。Search Console/Bing需有funagent.app属性权限的账号，当前没有可读报表。

## 2026-10-26 官方来源核对

| 原始来源 | 对产品影响 | 最小验证/本轮判断 |
| --- | --- | --- |
| https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls | canonical与sitemap信号应一致；canonical应位于head、使用明确URL | 已实现精确路由/集合与故障回归；不承诺Google一定采纳 |
| https://developers.binance.com/en/docs/sdks-tools/connectors/javascript | 官方模块化Node SDK可作为签名/连接/类型维护候选 | 当前无等价基线证明迁移收益，不替换稳定REST |
| https://bybit-exchange.github.io/docs/v5/guide 、https://github.com/bybit-exchange/trading-mcp 、https://github.com/okx/agent-trade-kit | SDK/MCP访问仍须守只读/地域/账户模式边界，不能当作盈利模型 | 本次核对未识别必须立即迁移的实质变化；未接入任何写工具 |
| https://api-docs.deepseek.com/guides/json_mode/ 、https://platform.claude.com/docs/en/about-claude/model-deprecations | JSON合法不等于事实正确，显式模型ID/生命周期约束继续保留 | 不更改昨日已修复的默认选择，不进行真实/付费调用 |
| https://www.tradingview.com/support/solutions/43000745825-mastering-the-tradingview-watchlists/ | 可比较列、排序与按需详情仍是有效参考 | 没有足以取代当前小窗口方案的新证据；不凑竞品热点 |

以上是今日核对日期，不把现存文档伪称今天新发布。未验证全网无变化。

## 增长与阻塞

公开仓库读取时Stars=0/Forks=0。beta.10二进制请求计数：arm64 ZIP=5，其余3个=0，包含CI请求，不能当作用户/付费证据。访问/激活/留存/收入未知；外部品牌渠道仍无具体授权，不群发或付费。当前机器抓取403需结合搜索控制台或托管层证据进一步定位；无相应权限不擅自放宽安全设置。真实Mac/账户/模型与日志审计继续#3；跨平台、基本面和全市场数据继续#23；仓位数量变化仍不等于成交/转账。
