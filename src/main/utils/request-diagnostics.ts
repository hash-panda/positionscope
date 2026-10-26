/** Only bounded transport facts may cross logging/error boundaries. Never inspect
 * message, body, headers, URL, config, stack, cause or arbitrary provider codes. */
export interface RequestDiagnostic {
  category: 'http' | 'timeout' | 'network' | 'cancelled' | 'invalid-response' | 'unknown';
  status?: number;
}

class AIRequestError extends Error {
  constructor(readonly diagnostic: RequestDiagnostic) {
    const status = diagnostic.status;
    const detail = status === 401 || status === 403 ? '请核对Key与模型权限'
      : status === 429 ? '请求受限，请稍后重试'
      : diagnostic.category === 'timeout' ? '请求超时，请检查网络或稍后重试'
      : diagnostic.category === 'network' ? '网络连接失败，请检查网络与代理'
      : diagnostic.category === 'cancelled' ? '请求已取消'
      : diagnostic.category === 'invalid-response' ? '响应格式无效，请重试或核对模型兼容性'
      : '请检查配置或稍后重试';
    super(`AI请求失败：${detail}${status ? `（HTTP ${status}）` : ''}。`);
    this.name = 'AIRequestError';
  }
}

export function requestDiagnostic(error: unknown): RequestDiagnostic {
  if (error instanceof AIRequestError) return { ...error.diagnostic };
  const value = error as { response?: { status?: unknown }; code?: unknown } | null;
  const status = value?.response?.status;
  if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) {
    return { category: 'http', status };
  }
  if (value?.code === 'ECONNABORTED' || value?.code === 'ETIMEDOUT') return { category: 'timeout' };
  if (value?.code === 'ERR_CANCELED') return { category: 'cancelled' };
  if (['ERR_NETWORK', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET'].includes(value?.code as string)) return { category: 'network' };
  if (error instanceof SyntaxError) return { category: 'invalid-response' };
  return { category: 'unknown' };
}

export function aiRequestError(error: unknown): Error {
  return new AIRequestError(requestDiagnostic(error));
}
