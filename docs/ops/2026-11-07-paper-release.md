# 2026-11-07：0.2.4 → 0.2.6 模拟与复盘验收

## 实际完成

| 版本 | 用户可见变化 | 发布证据 |
| --- | --- | --- |
| 0.2.4 | 菜单栏价格加 `+数字/-数字`，无浮盈标签/单位，单一前置价格方向图标；设置分组与窗口最右滚动；每版Release只提取本版变动 | [Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.4)，[签名42384896495](https://github.com/hash-panda/positionscope/actions/runs/42384896495) |
| 0.2.5 | 1,000/10,000/自定义虚拟本金，周期历史保留，条件与风险检查、后续盘口模拟、手续费/滑点假设、资金费核对，滚动模型预算 | [Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.5)，[签名42387915900](https://github.com/hash-panda/positionscope/actions/runs/42387915900) |
| 0.2.6 | 定期冻结复盘、历史周期比较、有界候选与等本金前向对照；App/网站共享浅色工作台变量 | [Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.6)，[签名运行](https://github.com/hash-panda/positionscope/actions/runs/42389421613) |

0.2.6 来源 `50a8974012ac14d8441dda7e3420a2e3c67de118`，发布时间 `2026-11-07T16:15:21Z`。两架构四个DMG/ZIP与两份验证JSON、SHA256SUMS共七资产；三份文本实际下载重算摘要/长度，四个二进制API摘要与校验和、签名记录相互核对。签名、公证、装订、Gatekeeper、包内图标和隔离原生更新替换/重启均通过。没有在用户电脑安装，也未读取真实账户或调用真实模型。

## 实际验证与失败保留

- #79 最终功能CI [42388835708](https://github.com/hash-panda/positionscope/actions/runs/42388835708) 与 #81 版本CI [42389151034](https://github.com/hash-panda/positionscope/actions/runs/42389151034)：221 Node、25 Python、类型/构建、UI/axe及Mac检查通过。复盘截图来自合成数据，检查周期/历史、候选中止、隐私、窄窗与弹窗焦点。
- 扩充三笔历史fixture时曾有测试按钮定位不唯一，已限定首笔并重新跑完整CI；没有删掉验收项。
- 多次GitHub公共更新元数据读取返回HTTP403，相关运行没有被当作通过；版本CI重试后通过。未证明403的根因，不写成用户凭证问题。
- 官网PR #80首轮checks已通过四种结果、保留历史、键盘tab/弹窗焦点、桌面/手机无溢出、axe与减少动效；Mac联网检查曾失败。最终CI和实际部署以该PR最终记录为准。官网不能在此分支未合并时称为上线。

## 产品与数据边界

真实账户依旧只读。模拟只接公共GET与用户明确启用的模型；虚拟汇总复盘不发送真实持仓或凭证。模拟费用有假设，资金费有延迟，执行受可见盘口和应用在线状态限制，离线不补成交。新周期不删除旧记录；完整删除仍需主动操作。

候选先在相同虚拟本金上接收未来研究和报价，不回放旧胜单。七天、三十笔成对平仓、费用与观察完整、净值优势及采样回撤门槛固定在前；采用只改新决策。上述门槛是工程筛选规则，不是统计显著性、真实成交或未来盈利证明。

仍未验收：用户Mac原生交互、签名包钥匙串弹窗、真实账户/模型质量与实际账单、七天连续运行、大账本启动/写入性能。当前事件账本128MiB容量上限触发后停止写入并保留原历史，不自动删除；不能声称无限连续运行。见 [#3](https://github.com/hash-panda/positionscope/issues/3#issuecomment-6709513376)。

官网不接真实行情、账户或模型；交互使用固定合成案例，明确盈利/亏损/未成交/未知。没有访问、激活、留存、付费或收入实绩数据，全部未知。未外发推广或付费。

## 官网发布交接

PR #80 在已验证0.2.6记录上同步下载、安装器摘要、README、设计/运营/隐私/英文说明，合并后按现有Sites项目部署。实际版本号、部署ID、网址与线上HTTP/robots/sitemap/canonical核对由部署完成后的PR评论记录，不预写成功。
