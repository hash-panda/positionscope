/**
 * Generic OpenAI-Compatible Provider
 *
 * 通用HTTP Provider，适用于所有兼容OpenAI API格式的服务
 * 包括：千问(Qwen)、Grok、Gemini等
 */

import axios, { AxiosInstance } from 'axios';
import { BaseAIProvider, ChatOptions } from '../base-provider';
import { ChatMessage, AIModelConfig } from '../../../types/ai';
import { logger } from '../../../utils/logger';

/**
 * 通用AI Provider
 * 适用于任何实现OpenAI chat completions格式的API
 */
export class GenericProvider extends BaseAIProvider {
  private client: AxiosInstance;

  constructor(config: AIModelConfig) {
    super(config);

    // 创建HTTP客户端
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });

    logger.log(`[Generic] Initialized for ${config.provider} with model: ${config.model}`);
  }

  /**
   * 发送聊天请求
   */
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    try {
      logger.log(`[Generic/${this.config.provider}] Sending chat request`);

      const response = await this.client.post('/chat/completions', {
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 2000,
        top_p: options?.topP ?? 1,
        stream: false,
      });

      const content = response.data.choices?.[0]?.message?.content || '';
      logger.log(`[Generic/${this.config.provider}] Response received`);

      return content;
    } catch (error: any) {
      logger.error(`[Generic/${this.config.provider}] Chat failed:`, error.message);
      throw new Error(`${this.config.provider} API Error: ${error.message}`);
    }
  }

  /**
   * 发送结构化请求（返回JSON）
   */
  async chatJSON<T = any>(messages: ChatMessage[], jsonSchema?: any): Promise<T> {
    try {
      logger.log(`[Generic/${this.config.provider}] Sending JSON request`);

      // 在消息中要求返回JSON格式
      const enhancedMessages = [...messages];
      const lastMessage = enhancedMessages[enhancedMessages.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        lastMessage.content += '\n\nPlease respond with valid JSON only.';
      }

      const response = await this.chat(enhancedMessages);

      // 尝试解析JSON
      let jsonText = response.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/, '').replace(/```$/, '').trim();
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(jsonText);
      logger.log(`[Generic/${this.config.provider}] JSON parsed successfully`);
      return parsed as T;
    } catch (error: any) {
      logger.error(`[Generic/${this.config.provider}] JSON request failed:`, error.message);
      throw new Error(`${this.config.provider} JSON Error: ${error.message}`);
    }
  }
}

/**
 * 千问(Qwen) Provider
 */
export class QwenProvider extends GenericProvider {
  constructor(config: AIModelConfig) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: config.model || 'qwen-turbo',
    });
  }
}

/**
 * Grok Provider
 */
export class GrokProvider extends GenericProvider {
  constructor(config: AIModelConfig) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://api.x.ai/v1',
      model: config.model || 'grok-beta',
    });
  }
}

/**
 * Gemini Provider
 */
export class GeminiProvider extends GenericProvider {
  constructor(config: AIModelConfig) {
    super({...config, baseURL:config.baseURL || 'https://generativelanguage.googleapis.com/v1beta/openai', model:config.model || 'gemini-2.5-flash'});
  }
}
