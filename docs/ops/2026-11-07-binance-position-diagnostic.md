# 0.2.1 持仓校验报错调查

2026-11-07 收到 BINANCE_INVALID_POSITION 反馈。该码由本地解析器产生，不是 Binance 原始错误码。公开行情成功不能证明私有持仓有效。现有错误合并了数量、方向、价格、保证金和时间格式问题；没有真实响应，不能确认具体触发字段，也不能宣称已经修复用户账户。

## 官方契约核对

核对 [Position Information V3](https://developers.binance.com/docs/derivatives/usds-margined-futures/trade/rest-api/Position-Information-V3)：GET /fapi/v3/positionRisk，包含 positionAmt、positionSide、entryPrice、markPrice、unRealizedProfit、marginAsset、isolatedWallet、positionInitialMargin、maintMargin、updateTime。仅返回有持仓或挂单的合约，零数量挂单行需先排除。配置从 symbolConfig 获取，未假设 V3 持仓含 V2 leverage/marginType。官方公开 ADA 样例在当前解析规则下通过；这不代表所有合法账户变体已覆盖。

[官方测试教程](https://www.binance.com/en/support/faq/detail/ab78f9a1b8824cf0a106b4229c76496d)（页面更新2025-10-06）要求登录 Futures Demo Trading 后创建自己的 Key，没有共享万能测试 Key。[官方环境说明](https://developers.binance.com/docs/derivatives/usds-margined-futures/general-info)使用 https://demo-fapi.binance.com。此次实际只读访问 /fapi/v1/time 得 HTTP 451，响应明确地区限制。没有绕过限制，没有测试凭证或私有接口成功记录。

## 本次交付

- 仅增强固定字段名诊断，不输出币种、数量、金额、响应原文、Key、Secret或签名，不改变现有接受/拒绝规则。
- 官方公开样例、逐字段非法输入、方向/价格/负保证金、零仓过滤、缺失可选字段与隐私回归。
- 本机 Python3 诊断脚本 scripts/diagnose-binance.py：默认 Demo；--production 明确选择正式环境。仅 GET positionRisk；交互终端隐藏输入凭证，禁止重定向；不保存响应，只打印聚合字段状态。该脚本辅助定位，不替代 App 解析/真实模型/完整账户验收。
- 本地 187 Node、17 Python、类型检查、构建通过。PR CI 与后续结果见关联 PR；未发布 0.2.2，不将诊断增强当成用户问题已修复。

## 需要本机协助

在可正常访问币安的本机下载并审阅 scripts/diagnose-binance.py，运行 `python3 diagnose-binance.py --production`；使用仅开放读取权限的专用 Key。Key/Secret 仅在本机隐藏提示中输入，不发送聊天。只回传末尾 JSON 字段状态（无币种/金额/凭证）。若使用 Demo 账户则不加 --production，但空 Demo 账户不能复现正式账户持仓结构。

取得异常字段后先建立对应合成回归，再按官方语义修正、CI、合并和既有签名门禁发布 0.2.2。尚未取得数据时不放宽验证或把未知补零，不承诺下一版覆盖全部账户。
