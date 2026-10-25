# 2026-10-25 模型生命周期与显式选择

关联 #3。源码仍以claude-3-5-sonnet-20241022等旧值作为隐式默认；已有自定义model输入，但空值会回退旧值。现在仅保留已核对且用户正在使用的deepseek-flash默认alias，其他提供商必须填写当前可用、兼容现有接口且价格可接受的模型ID；显式选择原样保留，不静默切换型号或价格档位。未指定模型时在UI与主进程保存前校验，并阻止provider构造，不发起无效或意外费用请求。AI关闭仍可保存，不因未补模型而阻止关闭功能。

## 官方证据（检查2026-10-25）

| 来源及实际日期 | 影响 | 最小验证 |
| --- | --- | --- |
| [Anthropic退役表](https://platform.claude.com/docs/en/about-claude/model-deprecations)：Claude3.5 Sonnet两个ID在2025-10-28退役 | 默认claude-3-5-sonnet-20241022不能继续使用；不能未经用户选择升级到新价格档 | 无ID时保存不落盘/不构造请求；用户明确ID原样发送 |
| [Gemini生命周期](https://ai.google.dev/gemini-api/docs/deprecations)：2.5目前未宣布退役，但仅向过去活跃使用者继续提供 | 不声称2.5已经退役；新账户必须核对可用模型及兼容接口 | 同样要求显式ID，不自动替换已选型号 |
| [DeepSeek首页](https://api-docs.deepseek.com/)及[JSON模式](https://api-docs.deepseek.com/guides/json_mode/) | 当前deepseek-flash调用方式保持，继续现有JSON模式；无追新迁移 | 默认alias、显式覆盖、空/坏JSON与形状校验回归；真实调用未测 |
| [Anthropic结构化输出](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) | 支持output_config.format约束，属于后续schema/SDK基线评测候选 | 同一合成事实包比较格式失败/事实一致性/延迟/成本，验证更好再改；本轮未接入新SDK或宣称通过 |

没有提供商测试配置或付费调用范围，未调用模型，不宣称56项测试代表六厂商真实可用性。现有HTTP适配器仍需按用户选择的模型逐一核对参数；当前只是移除过期的隐式选择。JSON形状校验不能保证事实结论。未来生命周期变更继续通过官方文档核对，不靠模型名称推断能力。

本地类型、56项Node、生产构建与UI回归以本PR日志为准；新增回归覆盖显式ID/不替换/禁用、默认构造拒绝、HTTP mock发送同一型号、UI缺ID不保存及补齐后保存。用户Mac、真实模型质量/成本与真实账户仍未验证。
