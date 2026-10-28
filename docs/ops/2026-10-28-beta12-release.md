# beta.12发布与下载同步

2026-10-28，[PR #36](https://github.com/hash-panda/positionscope/pull/36)已合并为c4282567fe4c6bd8d18708d96d19288a775599b1；[PR CI 40617182241](https://github.com/hash-panda/positionscope/actions/runs/40617182241)与[主分支CI 40617337510](https://github.com/hash-panda/positionscope/actions/runs/40617337510)全部成功。实际68项Node、5项Python、类型、构建、UI/axe及Mac系统加密/图标回归有证据。本地UI因Chromium官方ZIP下载无效未完成，不与CI结果混淆。未访问用户Mac或真实账户/模型。

[v0.2.0-beta.12](https://github.com/hash-panda/positionscope/releases/tag/v0.2.0-beta.12)发布于北京时间09:56:10，tag与Release目标均为上述源码。[签名运行40617337569](https://github.com/hash-panda/positionscope/actions/runs/40617337569)的quality、arm64、x64与publish全部成功；app/DMG签名、公证、票据装订与Gatekeeper accepted，包内图标与源一致。沿用正常六项Apple Secrets，不撤销证书、不覆盖旧版本、不退回未签名发布。证书记录到期2027-11-23。

两份验证JSON与SHA256SUMS下载到本地，逐字节重算摘要及长度，与GitHub资产digest/size一致；四个二进制声明逐一核对验证JSON、SHA256SUMS与GitHub digest。验证记录中的版本/架构/app_id/macOS最低版本、系统加密合成回读与包内图标hash亦核对。没有在本地重算四个完整二进制或安装；不将发布签名、开发Electron合成测试当作签名包权限弹窗、用户Mac或真实账户验收。[公开清单](../releases/v0.2.0-beta.12/release.json)保存完整来源。

下载同步范围：官网首页/下载/版本索引指向beta.12，隐私文案明确本轮仅收口交易所聚合错误、Binance现货错误及四适配器代理主机出口；固定安装器更新双架构ZIP摘要。README、当前产品/质量/签名规范与首次安装说明同步；不修改历史发布清单，不导入旧预览版。risk-facts-v2、Binance USDT永续市场范围、只读边界、AI费用及模型选择不变。官网sitemap给内容变化页更新日期；风险公式本身未改，方法页的源码链接随发行提交更新；未变化的只读配置页保持10月25日。

本同步PR须检查7页精确canonical/sitemap、当前Release链接/清单、安装器语法与固定摘要、5项Python，以及既有PR CI；Mac任务使用新固定安装器实际下载beta.12 ZIP核对摘要、签名和Gatekeeper。UI/axe、Mac安装器与合并后最终CI结果回填[#7](https://github.com/hash-panda/positionscope/issues/7)，本文件不提前宣称同步PR已成功。纯文档/官网/安装脚本不触发重复签名。

Sites保留同一公开站点，先打开既有第9版源码（e0a8383e5d244d16341fa3cd2c1e6d5aab7a2917），当前16文件与仓库website逐字节一致。本次只同步验证后的16文件并打包推送，独立版本部署；最终源码SHA、保存版本与部署结果同样回填#7，不将GitHub源更新当作生产已部署。版式不变，没有新增浏览器视觉验收。

官网今日机器抓取403与缺Google/Bing属性报告仍未解决，不为发布绕过安全规则。新增核对[Binance只读账户V3](https://developers.binance.com/docs/derivatives/usds-margined-futures/account/rest-api/Account-Information-V3)、[Bybit持仓字段](https://bybit-exchange.github.io/docs/v5/position)未发现本轮必须改动口径的证据；OKX REST全文因抓取过大未读取，Agent Kit源码可读，未宣称完成所有官方字段复核。[Google AI搜索](https://developers.google.com/search/docs/appearance/ai-features)与[canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)今日核对无需要立即更改现有配置的新增证据；仍须以真实属性报告验证抓取，不承诺收录/引用。

完整日志/原生/真实接口/模型继续#3；Anthropic新模型采样参数兼容已记录独立验收，不静默切型号/费用；跨平台市场、账单和项目身份继续#23；搜索和增长继续#7。访问、激活、W1、收入与成本工时未知，不以下载或浮盈证明产品价值。今日整体评审见[每日记录](2026-10-28.md)。
