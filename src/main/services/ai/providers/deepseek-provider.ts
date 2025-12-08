/**
 * DeepSeek Provider
 *
 * DeepSeek API适配器，兼容OpenAI接口格式
 */

import { OpenAIProvider } from './openai-provider';
import { AIModelConfig } from '../../../types/ai';
import { logger } from '../../../utils/logger';

/**
 * DeepSeek Provider
 * DeepSeek使用OpenAI兼容的API，所以继承OpenAIProvider
 */
export class DeepSeekProvider extends OpenAIProvider {
  constructor(config: AIModelConfig) {
    // DeepSeek API endpoint
    const deepseekConfig = {
      ...config,
      baseURL: config.baseURL || 'https://api.deepseek.com/v1',
      model: config.model || 'deepseek-chat',
    };

    super(deepseekConfig);
    logger.log(`[DeepSeek] Initialized with model: ${deepseekConfig.model}`);
  }
}
