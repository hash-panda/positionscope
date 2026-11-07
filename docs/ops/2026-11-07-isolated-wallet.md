# 0.2.2：Binance 逐仓钱包余额校验修复

## 根因与范围

0.2.1/PR64 代码对 Binance `isolatedWallet` 使用 nonnegative，并把它存入 isolatedMargin。逐仓钱包余额与保证金要求不是同一字段；负的有限余额会在本地抛出 BINANCE_INVALID_POSITION，导致整份持仓读取失败。参考 [官方 Position Information V3](https://developers.binance.com/docs/derivatives/usds-margined-futures/trade/rest-api/Position-Information-V3)（2026-11-07核对），isolatedWallet 和 isolatedMargin 是两个独立字符串字段；positionInitialMargin / maintMargin 是保证金要求。公开文档未提供钱包余额非负约束。本次不推断负余额形成原因，不把正浮盈或低参考强平价当安全证明。

新增纯合成负钱包余额测试，修复前实际抛出 BINANCE_INVALID_POSITION / isolatedWallet；修复后通过。Binance 的 isolatedWallet、isolatedMargin 分开保存，接受有限带符号余额；缺失保留 null，非法格式仍拒绝；初始/维持保证金继续非负校验。其他交易所解析保持。

工作台持仓详情分别显示钱包余额和保证金余额，两者均遵循隐藏金额。现有私有持仓 AI 仍需要明确确认，本次没有增加自动请求或交易权限。

## 诊断与验证

本机诊断 v2 新增 --check-network（只读公开时间，无需凭证），自动预检和固定原因分类（超时、DNS、连接拒绝、TLS证书、HTTP、非JSON等），不输出异常原文/代理地址/响应/凭证；保留 TLS 校验、禁止重定向，不绕过地区限制。诊断脚本网络设置与 App 内代理设置独立。

本地189项Node、21项Python、类型/构建通过；包含服务适配器完整读取、缺失余额、错误格式及负保证金要求回归。新增UI合成场景核对两个余额独立显示和遮罩，实际结果以 PR CI 为准。开发环境此前 Demo 公共接口返回451，未使用真实凭证；真实用户账户数据未进入仓库、日志、CI或模型。公开测试均使用任意合成值。

版本0.2.2仅在确切head质量CI通过、合并main后使用既有双架构签名/公证/装订/Gatekeeper流程发布。发布与下载推广结果追加关联PR，不预写成功；安装后的真实账户恢复仍需用户确认。无需更换正常API凭证或Apple Secrets。
