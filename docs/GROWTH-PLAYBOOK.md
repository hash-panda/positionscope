# 搜索、内容与社区运营

## SEO/GEO 基础

官网同源7页：产品、下载、只读配置、风险计算方法、隐私、路线、英文简介。独立title/description/canonical、首页/英文互指hreflang、Open Graph/Twitter、真实SoftwareApplication JSON-LD、robots与sitemap已纳入源码检查。每页一个h1、清晰内链和能力边界。llms.txt是辅助说明提案，不是Google/模型排名开关，不声称其被采用。

依据 [Google AI功能指南](https://developers.google.com/search/docs/appearance/ai-features) 与 [AI优化指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)：先保证可抓取、内容清晰、有依据和正常SEO。参考成熟开源 [jekyll-seo-tag](https://github.com/jekyll/jekyll-seo-tag) 的canonical/社交/JSON-LD组织方式；不为静态站引入Jekyll依赖，不复制其受许可约束的实现。本项目采用自己的零依赖页面生成与验证脚本。

登录Search Console后：添加URL-prefix `https://positionscope.funagent.app/`（或使用已有funagent.app域名属性）；用该账号实际给出的HTML/DNS验证，不编造verification值；提交 `https://positionscope.funagent.app/sitemap.xml`；用URL检查查看首页、下载页和方法页。Bing做同样流程。提交不等于收录，收录不等于排名。没有账号/报告权限时只标待配置。每周记录已索引URL、排除原因、展示/点击、查询和地区；没有数据标未知。若托管返回noindex头或重定向不正确，先解决再推广。

GEO每月人工抽样5个固定问题（Mac菜单栏多所持仓、只读配置、集中度算法、资金费解释、隐私）和中英文对应版本，记录引擎/模型/日期/是否联网/问题原文/引用网址，保留允许的证据。先建立基线，避免用单次回答声称份额。纠正官网错误与信息缺口，不操纵提示或编造评价。

## 内容与渠道实验

一篇内容对应一个真实问题，必须能复算或操作：第一批已做只读配置和集中度说明；方法页已补持仓数量与成交区别、条件资金费/强平距离/价格历史口径；继续用真实反馈决定下一篇内容。合成数据明确标记，截图遮蔽敏感信息。每次发布先核对当前可下载版本与签名状态。

首周先在自有GitHub README/Release/Issue和官网提供试用入口，自愿Star/Watch，不给予虚假奖励。签名可用后，选择一个用户提供的品牌社交账号与一个允许产品反馈的社区，发布一次演示+限制+问题邀请；不同时铺量。为各渠道链接加utm_source/medium/campaign，但当前没有访问统计，不能声称已追踪转化。用自愿反馈的来源字段做最小验证。

每次实验记录：目标人群、假设、内容/URL、渠道规则、投入工时/现金、发布时间、7天后的实际点击（可得时）、确认激活和有用反馈。50次可确认相关访问仍无接入意愿，优先访谈/改文案；有接入但留不住优先改产品；小样本无访问不能推断产品无价值。没有访问数据时不使用这个门槛。

## 可直接使用的发布素材（尚未向社交渠道发布）

中文：我们在做 PositionScope · 仓位镜，一个开源的 Mac 菜单栏持仓工具。目标是少切几次屏，把多交易所仓位和变化看清楚；风险数字本地计算，AI按需解释。当前已发布签名、公证的 Beta 版，配置已使用系统钥匙串管理的密钥加密，签名安装包的权限弹窗、原生场景与真实账户仍待核对，欢迎用只读测试账户反馈。希望寻找有多所持仓场景的Mac用户，反馈你最难发现的变化。官网 https://positionscope.funagent.app/ ，源码 https://github.com/hash-panda/positionscope 。欢迎自愿Star或Watch，反馈无需提供Key或真实金额。

English: PositionScope is an open-source Mac menu-bar position monitor. We are testing whether read-only multi-exchange snapshots and reproducible risk facts help users spot changes faster. A signed and notarized beta is now available; settings use macOS Keychain-managed encryption; packaged-app permission prompts, native UI and real-account validation are still pending. We welcome feedback from Mac users with multi-exchange workflows. No API keys or account balances are needed for feedback. https://positionscope.funagent.app/en/

建立群时优先提供公开规则、隐私提醒与反馈模板，用户主动加入；没有具体账号前不创建无人维护的邀请入口。收集问题进入Issue并合并重复项，公开周报回链到真实修复。

## 2026-10-25 真实可见度证据

GitHub公开API读取时仓库为Public，Stars=0、Forks=0；这不是激活或收入数据。当前Search Console打开到登录入口，没有可读属性/效果报表；本次一次站点限定搜索无返回，不能据此断言未收录。Bing报表未验证。网站访问、激活、留存、收入仍未知，不填0；外部品牌/社区渠道尚无具体授权入口，未代发或付费。相关源与时点保留在ops报告和metrics快照。
