# Hyperliquid 标准账户口径修订

2026-10-25，继续 Issue #3 的资产准确性工作，承接 PR #13。发布候选0.2.0-beta.3；此文件记录实现和验收边界，不提前声称发布或实机通过。

## 行为与范围

- 原 balances 数组被按对象键遍历，币种成了数字索引；hold 被当 free。改为 coin/token 标识，free=total-hold、locked=hold，保留负余额，零余额不参与估值，重复token或非法数值报固定错误。
- 通过 spotMetaAndAssetCtxs 的 token index、USDC交易对和对应context markPx做当前估值，不使用entryNtl历史成本。缺价格/不支持的报价/元数据冲突/非有限计算均停止汇总；余额/行情请求失败不再吞错为0。
- totalUnrealizedProfit 汇总同一clearinghouseState逐仓unrealizedPnl；wallet为equity-PnL推导，不是账单。maxWithdrawAmount用顶层withdrawable；availableBalance=max(0,accountValue-totalMarginUsed)，仅为未占用保证金估算。
- 持仓映射保留多空、cross/isolated、逐仓保证金和字符串杠杆；缺失/非法持仓数组不生成假空仓。标记价由positionValue/abs(szi)推导。
- 每次读取先查询userAbstraction，仅允许明确的disabled标准模式；unifiedAccount/portfolioMargin/dexAbstraction/default/未知/请求失败均不生成汇总。default的有效余额语义未独立验证，保守拒绝；不建议用户为使用本工具修改账户模式。没有模式变更、交易或转账请求。
- 仅默认永续DEX和现货，未计HIP-3其他DEX、质押、借贷。USDC按1:1 USDT等值假设，行情并非保证成交或保证锚定。UI和AI事实显示此边界。余额与行情为相邻请求，不是交易所原子快照；不声称完整金融审计。
- Hyperliquid不保存私钥，去掉日志中的钱包片段、代理URL、原始异常内容。该范围之外的日志/凭据存储审查仍待完成。

## 来源（复核2026-10-25）

- https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot ：balances为coin/token/hold/total数组；spot metadata/context定义。
- https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals ：逐仓PnL、marginSummary、顶层withdrawable；统一账户余额源提示。
- https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint ：userAbstraction枚举、市场与账户只读info请求。
- https://hyperliquid.gitbook.io/hyperliquid-docs/trading/account-abstraction-modes ：统一账户不可直接相加；个别DEX余额语义与标准模式不同。
- 官方Python SDK 2fdb18f9517675ea03695a0962bd19eece9c83f0 的 info.py 与 examples/user_abstraction.py：查询方式。只读源码，未运行其中包含写操作的示例。

## 验收

合成HTTP桩覆盖：盈亏正负/空列表、非USDC估值、负/零余额、未知token/报价/价格、重复token、非法数值/溢出、partial failure、顶层提现额、负权益、模式切换与恢复、不支持模式、只读请求白名单及错误脱敏。UI回归检查Hyperliquid提示和现有键盘/空错态。没有连接真实账户或模型，也未访问用户本机。

本地类型检查、28项Node测试、4项Python测试、生产构建、7页官网源码检查、git diff --check及完整UI/axe回归均通过。UI包含480×600、320px及新增Hyperliquid统计范围展开说明（18-hyperliquid-assumptions.png），无浏览器错误。签名发布结论以本PR评论、Actions和对应Release为准；安装包只有在两个架构签名/公证/装订/Gatekeeper验证全通过后发布。官网继续指向最后一个已验证Release，成功后才更新。

下一优先：系统安全存储/迁移/删除；用户本机只读对照与原生交互；统一账户应作为独立协议支持，不扩大本版声明。
