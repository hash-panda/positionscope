# 0.2.4：菜单栏、设置与当版发布说明

2026-11-07。维护者要求菜单栏盈亏不加“浮盈”或单位，本版已实现。

- [PR #73](https://github.com/hash-panda/positionscope/pull/73)：币价后附全部持仓带正负号的总未实现盈亏；只保留前置彩色方向图标。隐藏金额同步遮罩。设置右侧全宽滚动、分组图标和预览；发布工作流严格抽取当前数字版本章节，缺失/重复/空白章节拒绝发布。
- [CI 42384097335](https://github.com/hash-panda/positionscope/actions/runs/42384097335)通过197项Node、25项Python、类型/构建/UI/axe、Mac原生存储与更新检查；已复核实际合成设置页截图。960/1180宽度检查滚动区右边缘与视口一致。没有连接用户账户或模型。
- [PR #74](https://github.com/hash-panda/positionscope/pull/74)发布0.2.4，PR CI 42384534718通过。来源 `2da29dda326a51f4d1b273cdd6f75bfce9b54824`；[签名发布42384896495](https://github.com/hash-panda/positionscope/actions/runs/42384896495)通过arm64/x64真实原生合成更新演练、生产包签名、公证、装订、Gatekeeper和图标校验。
- [Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.4)于2026-11-07T15:19:18Z（北京时间23:19:18）发布。7资产齐全：3文本下载重算长度/摘要，4二进制摘要与GitHub API、verification JSON、SHA256SUMS一致。见[发布记录](../releases/v0.2.4/release.json)。Release正文已实际核对仅含0.2.4内容。
- 官网及安装器推广以本PR通过CI和实际部署为准。部署ID和线上检查随后附PR评论，不把本地生成算作上线。

模拟周期基础另由[PR #75](https://github.com/hash-panda/positionscope/pull/75)合并，未包含在0.2.4包中。后续工作台、自动调用预算与复盘仍独立推进；官网不提前宣传已上线。用户Mac真实权限/配置、账户/模型质量仍未验证；不把模拟或签名通过当盈利证据。
