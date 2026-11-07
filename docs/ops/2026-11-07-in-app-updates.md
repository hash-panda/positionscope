# 0.2.3：应用内更新与持仓/研究布局验收

日期：2026-11-07。只使用合成夹具、公开发布数据与隔离 CI；没有读取或发送用户实际持仓。

## 完成

- [PR #67](https://github.com/hash-panda/positionscope/pull/67)：研究矩阵适配列宽与长名称；完整持仓表取消侧栏，展示成本价格涨跌、参考强平、数量/名义价值和保证金/钱包余额；右上角退出，旧标题清理；菜单栏报价精度与同合约前次报价方向分开于盈亏/24h。
- [PR #68](https://github.com/hash-panda/positionscope/pull/68)：应用内检查、下载、摘要/签名验证、重启更新。状态在两个窗口共享，页面切换不重置下载；原生准备后下次退出也会安装。0.2.2 及更早版本需手动安装一次。
- 成本涨跌是价格比值，不是空头或杠杆收益率；字段缺失不补零，负逐仓余额继续保留。未知/隐私状态不泄漏金额方向，未新增下单、转账或模型自动调用。

## 实际验证

- 布局 [PR CI](https://github.com/hash-panda/positionscope/actions/runs/42374358595)：191 Node、21 Python、类型/构建、UI/axe 与原生 Mac基础验证通过。检查了合成实际渲染截图，包含矩阵/完整表和480×600浮窗；960×640长名称矩阵不横向溢出。
- 更新最终 [PR CI](https://github.com/hash-panda/positionscope/actions/runs/42375334690)：196 Node、21 Python、类型/构建、UI/axe 和原生基础验证通过。负面包/重定向/摘要/单任务/原生ready门槛/IPC 来源有回归；UI验证下载进度、导航保留、验证与重启入口。
- 首次发布运行 42375465425 在测试副本启动阶段超时，未产生新 Release；[PR #69](https://github.com/hash-panda/positionscope/pull/69)修复演练的 ASAR 入口与隔离 profile 初始化，并先经无 Apple 凭证的 Mac 启动检查。原生网络检查还发现 Electron 45 的 manual fetch 重定向被取消，已改为 ClientRequest 验证重定向事件；[最终 CI](https://github.com/hash-panda/positionscope/actions/runs/42377022675)全部通过，并真实下载公开 Release 验证 JSON 完成摘要校验。
- 第二次发布运行 42377166339 在测试副本启动前报 `Unable to find helper app`，未发布；[PR #70](https://github.com/hash-panda/positionscope/pull/70)按 Electron 45 源码保留原有 CFBundleName 与辅助进程命名关系，继续使用独立测试 bundle ID / profile。
- 第三次发布运行 42377842650 的 arm64 原生更新、公证全部通过，x64 在 ready 阶段耗尽原来的共享180秒期限，未发布；[PR #71](https://github.com/hash-panda/positionscope/pull/71)改为分阶段有限等待并记录实际替换/重启证据，保持成功门槛。
- 最终来源首次运行42379238693中双架构均通过原生替换/重启，x64随后在DMG公证票据校验时返回stapler 68；仅重试失败任务，第二次运行全部成功，未绕过装订或Gatekeeper门槛。
- [签名发布](https://github.com/hash-panda/positionscope/actions/runs/42379238693)实际通过 arm64/x64 原生更新演练。使用与生产身份不同的测试bundle及合成profile，真实签名副本从0.0.1替换为0.0.2并重启读回版本；元数据为合成夹具，不等于生产端完整互联网更新或用户配置/权限验收。
- 生产包完成签名、公证、装订、Gatekeeper及包内图标核验。[0.2.3 Release](https://github.com/hash-panda/positionscope/releases/tag/v0.2.3)于 `2026-11-07T14:16:51Z` 发布，source `ad551ffa75485c954097681e6b268ffc1e53fefe`。
- 七资产已核对：三个文本资产下载重算摘要与长度，四个二进制资产摘要与GitHub元数据、验证JSON、SHA256SUMS一致。记录见 [release.json](../releases/v0.2.3/release.json)。

最终合并来源的[主分支 CI](https://github.com/hash-panda/positionscope/actions/runs/42379238687)全部通过；[PR #71 CI](https://github.com/hash-panda/positionscope/actions/runs/42379127881)验证分阶段时限及原生启动。安装包公开时间为北京时间2026-11-07 22:16:51。

## 发布与边界

官网下载说明同步应用内更新与菜单栏报价语义；安装器固定0.2.3官方ZIP摘要。推广PR通过相关验证后部署，精确部署/线上路由核验记录附于推广PR评论。

仍未验证用户Mac真实权限弹窗、原生场景/自动启动、真实账户与模型质量；未连接用户账户。增长数据、本轮收入和盈利能力无新证据。没有重新配置Apple Secrets、旧预览版迁移或外部推广。

官方更新实现依据：[Electron autoUpdater](https://www.electronjs.org/docs/latest/api/auto-updater)、[Squirrel.Mac](https://github.com/Squirrel/Squirrel.Mac)，核对日期2026-11-07。实现边界见 [in-app-updates.md](../in-app-updates.md)。
