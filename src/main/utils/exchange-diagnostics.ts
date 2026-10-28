import { requestDiagnostic } from './request-diagnostics';

const accountFailures = {
  HYPERLIQUID_UNSUPPORTED_ACCOUNT: ['Hyperliquid 暂不支持此账户模式', 'Hyperliquid 暂仅支持标准账户（disabled）；统一、组合保证金及未知模式不生成汇总。应用不会更改账户模式。'],
  HYPERLIQUID_INCOMPLETE_ACCOUNT: ['Hyperliquid 账户数据不完整', 'Hyperliquid 余额或估值数据不完整，已停止汇总；请稍后重试。'],
  HYPERLIQUID_READ_FAILED: ['Hyperliquid 只读请求失败', 'Hyperliquid 只读请求失败，请检查网络后重试。'],
} as const;

/** Construct UI-safe diagnostics, never forward provider text, codes or objects.
 * Unknown failures include local mapping failures: do not label all as network. */
export function exchangeFailure(error: unknown): { errorCode: string; errorMessage: string; suggestion: string } {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(accountFailures, code)) {
    const [errorMessage, suggestion] = accountFailures[code as keyof typeof accountFailures];
    return { errorCode: code, errorMessage, suggestion };
  }
  const diagnostic = requestDiagnostic(error);
  const errorCode = diagnostic.status ? `HTTP_${diagnostic.status}` : diagnostic.category.toUpperCase().replace('-', '_');
  const suggestion = diagnostic.status === 401 ? 'API认证失败，请核对Key、Secret及只读查询权限；不要公开凭证。'
    : diagnostic.status === 403 ? '请求被拒绝，请核对IP白名单、只读权限及交易所访问限制。'
    : diagnostic.status === 429 ? 'API请求频率受限，请稍后重试。'
    : diagnostic.category === 'timeout' ? '请求超时，请检查网络、代理及交易所服务状态后重试。'
    : diagnostic.category === 'network' ? '网络连接失败，请检查网络、代理和防火墙后重试。'
    : diagnostic.category === 'cancelled' ? '请求已取消，请按需重试。'
    : '只读数据读取或校验失败，请核对账户与合约支持范围、数据完整性、网络及API配置后重试。';
  return { errorCode, errorMessage: `交易所只读请求未完成（${errorCode}）`, suggestion };
}
