import type { AISettings } from '../types/ai';
const providers = new Set(['openai','anthropic','deepseek','qwen','grok','gemini']);
/** Preserve explicit choices. Never silently migrate a model or its price tier. */
export function resolveAIModel(provider: string, requested?: string): string {
  if (!providers.has(provider)) throw new Error('AI提供商无效');
  if (requested != null && typeof requested !== 'string') throw new Error('模型ID必须是文本');
  const model = requested?.trim() || (provider === 'deepseek' ? 'deepseek-flash' : '');
  if (!model) throw new Error(`${provider}需要填写当前可用的模型ID，请核对兼容接口与价格后保存。`);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(model)) throw new Error('模型ID格式无效，请使用提供商文档中的ID。');
  return model;
}
export function validateAISettingsModels(settings: AISettings): void {
  // Users can always disable AI even if an old, unused draft lacks a model ID.
  if (!settings.enabled || !settings.useCustomKeys) return;
  for (const [provider, credential] of Object.entries(settings.credentials)) {
    if (credential?.apiKey?.trim()) resolveAIModel(provider, credential.model);
  }
}
