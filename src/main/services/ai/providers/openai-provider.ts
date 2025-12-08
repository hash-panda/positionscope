/**
 * OpenAI Provider (GPT-3.5, GPT-4)
 *
 * OpenAI API适配器，支持ChatGPT系列模型
 */

import OpenAI from 'openai';
import { BaseAIProvider, ChatOptions } from '../base-provider';
import { ChatMessage, AIModelConfig } from '../../../types/ai';
import { logger } from '../../../utils/logger';

export class OpenAIProvider extends BaseAIProvider {
  private client: OpenAI;

  constructor(config: AIModelConfig) {
    super(config);

    // 初始化OpenAI客户端
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL, // 支持自定义端点（如Azure OpenAI）
    });

    logger.log(`[OpenAI] Initialized with model: ${config.model}`);
  }

  /**
   * 发送聊天请求
   */
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    try {
      logger.log(`[OpenAI] Sending chat request with ${messages.length} messages`);

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages as any[],
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 2000,
        top_p: options?.topP ?? 1,
      });

      const content = response.choices[0]?.message?.content || '';
      logger.log(`[OpenAI] Response received, length: ${content.length}`);

      return content;
    } catch (error: any) {
      logger.error('[OpenAI] Chat request failed:', error.message);
      throw new Error(`OpenAI API Error: ${error.message}`);
    }
  }

  /**
   * 发送结构化请求（返回JSON）
   */
  async chatJSON<T = any>(messages: ChatMessage[], jsonSchema?: any): Promise<T> {
    try {
      logger.log(`[OpenAI] Sending JSON request`);

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages as any[],
        response_format: { type: 'json_object' },
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 2000,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      logger.log('[OpenAI] JSON response parsed successfully');
      return parsed as T;
    } catch (error: any) {
      logger.error('[OpenAI] JSON request failed:', error.message);
      throw new Error(`OpenAI JSON Error: ${error.message}`);
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

      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages as any[],
        stream: true,
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 2000,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          onChunk(content);
        }
      }

      logger.log('[OpenAI] Stream completed');
    } catch (error: any) {
      logger.error('[OpenAI] Stream failed:', error.message);
      throw new Error(`OpenAI Stream Error: ${error.message}`);
    }
  }
}
