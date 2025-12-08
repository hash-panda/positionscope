/**
 * Anthropic Provider (Claude)
 *
 * Claude API适配器，支持Claude系列模型
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider, ChatOptions } from '../base-provider';
import { ChatMessage, AIModelConfig } from '../../../types/ai';
import { logger } from '../../../utils/logger';

export class AnthropicProvider extends BaseAIProvider {
  private client: Anthropic;

  constructor(config: AIModelConfig) {
    super(config);

    // 初始化Anthropic客户端
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    logger.log(`[Anthropic] Initialized with model: ${config.model}`);
  }

  /**
   * 发送聊天请求
   */
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    try {
      logger.log(`[Anthropic] Sending chat request with ${messages.length} messages`);

      // Claude API需要分离system message
      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const response = await this.client.messages.create({
        model: this.config.model,
        system: systemMessage,
        messages: conversationMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 2000,
      });

      const content = response.content[0]?.type === 'text'
        ? response.content[0].text
        : '';

      logger.log(`[Anthropic] Response received, length: ${content.length}`);
      return content;
    } catch (error: any) {
      logger.error('[Anthropic] Chat request failed:', error.message);
      throw new Error(`Claude API Error: ${error.message}`);
    }
  }

  /**
   * 发送结构化请求（返回JSON）
   */
  async chatJSON<T = any>(messages: ChatMessage[], jsonSchema?: any): Promise<T> {
    try {
      logger.log(`[Anthropic] Sending JSON request`);

      // Claude没有原生JSON mode，需要在prompt中要求返回JSON
      const enhancedMessages = [...messages];
      const lastMessage = enhancedMessages[enhancedMessages.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        lastMessage.content += '\n\nPlease respond with valid JSON only, no other text.';
      }

      const response = await this.chat(enhancedMessages);

      // 提取JSON（处理可能的markdown代码块）
      let jsonText = response.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/, '').replace(/```$/, '').trim();
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(jsonText);
      logger.log('[Anthropic] JSON response parsed successfully');
      return parsed as T;
    } catch (error: any) {
      logger.error('[Anthropic] JSON request failed:', error.message);
      throw new Error(`Claude JSON Error: ${error.message}`);
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
      logger.log('[Anthropic] Starting stream');

      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const stream = await this.client.messages.create({
        model: this.config.model,
        system: systemMessage,
        messages: conversationMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        stream: true,
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 2000,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          onChunk(event.delta.text);
        }
      }

      logger.log('[Anthropic] Stream completed');
    } catch (error: any) {
      logger.error('[Anthropic] Stream failed:', error.message);
      throw new Error(`Claude Stream Error: ${error.message}`);
    }
  }
}
