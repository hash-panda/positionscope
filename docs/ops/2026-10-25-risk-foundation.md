# 2026-10-25 持仓风险基础修正

关联 #23。本轮先纠正适配器口径，再增加可核对的风险事实与情景；不读取维护者真实账户，不公开其粘贴的仓位或快照。

## 原始问题与实现

- OKX原实现把`pos`合约张数直接当币数，且未使用`posSide`处理正数空仓。现在读取公开合约规格，确认linear/USDT，按有符号张数×ctVal换算基础币数；不再重复乘ctMult。不支持或规格缺失则停止该平台结果，不猜单位。保留原始张数/合约ID/持仓ID。逐仓抵押来自margin，不再冒用imr。
- Bybit原GET以JSON签名却以query发送；现在签名和发送同一URLSearchParams编码串，包括分页游标。完整分页有重复/上限保护；仅接受明确UNIFIED账户状态与account/info保证金模式，不再使用已弃用tradeMode。逐仓模式所有账户级总额和比率均不可用，即便接口返回数字。UNIFIED不与SPOT重复相加，可用余额不再伪装成提现上限。
- Binance改用v3 positionRisk/account及symbolConfig/accountConfig，保留强平价、仓位初始保证金、维持保证金、模式、币种、来源时间。删除签名片段日志。现货失败或部分币种无价格时，总资产为不可用，不是零或已知部分。
- OKX交易账户USD权益与调整权益分别保留；资金账户缺估值时总资产不可用。Hyperliquid仅维持已支持的标准账户/默认DEX，增加参考强平价及推导标记价来源；marginUsed不是维持保证金，也不直接标为逐仓抵押。crossMaintenanceMarginUsed及crossMarginSummary只在cross范围展示。
- 全链路保留逐交易所账户，不再丢失成ALL汇总。risk-facts-v2含逐仓、各平台独立口径、获取/更新时间及动态缺口；未知数据不补零。强平距离以各平台自身标记价计算，零/空强平价不可用。
- 本地情景比较保持仓位/缩减25%/缩减50%后，所有标的同幅±5/10/20%的剩余价格盈亏。它不是已执行交易、策略回测或强平模拟，不计费用、资金费、平仓结算与路径影响。AI改为解释差异与条件，避免重复事实与免责声明，不默认强平价远就长期安全。
- 同币种同方向的不同持仓以平台持仓ID区分；移除旧预览版symbol-only排序兼容。

## 官方来源与最小验证

检查日期2026-10-25；这些是字段/接口规范核对，不声称全部都是今天新增的功能。

| 原始来源 | 对产品影响 | 最小验证 |
| --- | --- | --- |
| [OKX REST](https://app.okx.com/docs-v5/en/)：Positions/Public instruments | 张数、ctVal、posSide、linear/settleCcy；liqPx参考值 | 合成20张×.01=0.2币，空仓为负；拒绝inverse/缺规格；公开元数据不带账户headers |
| [Bybit签名](https://bybit-exchange.github.io/docs/v5/guide)、[账户](https://bybit-exchange.github.io/docs/v5/account/account-info)、[余额](https://bybit-exchange.github.io/docs/v5/account/wallet-balance)、[持仓](https://bybit-exchange.github.io/docs/v5/position) | GET签query，UNIFIED隔离模式不适用账户级字段，tradeMode弃用 | HMAC重算编码游标；逐仓即便返回数字也输出null；重复分页拒绝 |
| [Binance账户](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account)、[持仓](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) | v3与symbolConfig拆分；USD/USDT账户口径 | 合成方向、零MM、空liq与未知配置；缺现货价格不参与总资产 |
| [Hyperliquid Info](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals)、[强平](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/liquidations) | cross范围、动态参考价、marginUsed边界 | 标准账户原回归保留；逐仓/全仓强平参考与缺字段检查 |

## 实际验证与限制

本地类型检查、46项Node、5项Python、生产构建、7页官网结构检查通过。UI/axe包含480×600、320px及新增强平/保证金/独立账户输入/六行情景表；本地UI/axe已通过且无浏览器错误；CI另行核对。所有账户、行情与模型为合成fixture或mock，无真实交易所/模型调用。

PR/CI/签名Release通过前不宣称已发布，不更新官网或安装器指向候选包。原生Mac、真实账户字段对照、真实模型事实一致性仍未验证。结构校验只保证JSON形状，不能保证模型语言所有推断正确。

## 质量缺口与后续

按既有100分标准逐项记录，不填无法支撑的总分：数据25分项已有单位/方向/空值/分页回归，真实对照未知；风险25分项已有独立口径/动态缺口/情景，真实模型与市场历史未知；UI20分项已有小窗口/键盘/空错态回归，原生未知；隐私15分项已有加密与本轮最小事实包，完整日志审计未知；发布10分项以本次CI与签名记录为准，实机未知；官网5分项结构可核对，搜索收录/激活未知。

#23保持开放：下一阶段补公共市场背景/资金费/标的价格历史/研究观察表及来源时间。交易所SDK/Agent/MCP提供工具访问，不提供可验证盈利预测；不因其存在替换稳定REST，也不引入下单工具。全市场指标源须先核对生产许可和API方案；未接入时明确不具备全市场研究。新上市不等于早期价值。
