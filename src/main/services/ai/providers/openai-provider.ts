/**
 * OpenAI Provider (GPT-3.5, GPT-4)
 *
 * OpenAI API适配器，支持ChatGPT系列模型
 * 使用 axios 直接调用 API，避免 node-fetch 依赖问题
 */

import { AxiosInstance } from 'axios';
import { BaseAIProvider, ChatOptions } from '../base-provider';
import { ChatMessage, AIModelConfig } from '../../../types/ai';
import { logger } from '../../../utils/logger';
import { createHttpClient, streamSSE } from '../../../utils/http-client';

export class OpenAIProvider extends BaseAIProvider {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(config: AIModelConfig) {
    super(config);

    this.baseURL = config.baseURL || 'https://api.openai.com/v1';

    // 创建 axios 客户端
    this.client = createHttpClient({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    logger.log(`[OpenAI] Initialized with model: ${config.model}`);
  }

  /**
   * 发送聊天请求
   */
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    try {
      logger.log(`[OpenAI] Sending chat request with ${messages.length} messages`);

      const response = await this.client.post('/chat/completions', {
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 2000,
        top_p: options?.topP ?? 1,
      });

      const content = response.data.choices[0]?.message?.content || '';
      logger.log(`[OpenAI] Response received, length: ${content.length}`);

      return content;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      logger.error('[OpenAI] Chat request failed:', errorMsg);
      throw new Error(`OpenAI API Error: ${errorMsg}`);
    }
  }

  /**
   * 发送结构化请求（返回JSON）
   */
  async chatJSON<T = any>(messages: ChatMessage[], jsonSchema?: any): Promise<T> {
    try {
      logger.log(`[OpenAI] Sending JSON request`);

      const response = await this.client.post('/chat/completions', {
        model: this.config.model,
        messages,
        response_format: { type: 'json_object' },
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 2000,
      });

      const content = response.data.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      logger.log('[OpenAI] JSON response parsed successfully');
      return parsed as T;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      logger.error('[OpenAI] JSON request failed:', errorMsg);
      throw new Error(`OpenAI JSON Error: ${errorMsg}`);
    }
  }

  /**
   * 流式聊天
   */
  async chatStream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    try {
      logger.log('[OpenAI] Starting stream');

      const stream = streamSSE(`${this.baseURL}/chat/completions`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        data: {
          model: this.config.model,
          messages,
          stream: true,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.maxTokens ?? 2000,
        },
      });

      for await (const data of stream) {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content || '';
          if (content) {
            onChunk(content);
          }
        } catch (e) {
          // 忽略解析错误（可能是不完整的数据）
        }
      }

      logger.log('[OpenAI] Stream completed');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      logger.error('[OpenAI] Stream failed:', errorMsg);
      throw new Error(`OpenAI Stream Error: ${errorMsg}`);
    }
  }
}
