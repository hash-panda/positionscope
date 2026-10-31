/**
 * Anthropic Provider (Claude)
 *
 * Claude API适配器，支持Claude系列模型
 * 使用 axios 直接调用 API，避免 node-fetch 依赖问题
 */

import { AxiosInstance } from 'axios';
import { BaseAIProvider, ChatOptions } from '../base-provider';
import { ChatMessage, AIModelConfig } from '../../../types/ai';
import { logger } from '../../../utils/logger';
import { requestDiagnostic, aiRequestError } from '../../../utils/request-diagnostics';
import { createHttpClient, streamSSE } from '../../../utils/http-client';

export class AnthropicProvider extends BaseAIProvider {
  private client: AxiosInstance;
  private baseURL: string;

  // Model sampling capabilities differ. Omit implicit parameters so the API can
  // use its model default; preserve only deliberately configured overrides.
  private samplingOptions(options?: ChatOptions): { temperature?: number } {
    const temperature = options?.temperature ?? this.config.temperature ?? undefined;
    return temperature === undefined ? {} : { temperature };
  }

  constructor(config: AIModelConfig) {
    super(config);

    this.baseURL = config.baseURL || 'https://api.anthropic.com';

    // 创建 axios 客户端
    this.client = createHttpClient({
      baseURL: this.baseURL,
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });

    logger.log('[Anthropic] Initialized');
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

      const response = await this.client.post('/v1/messages', {
        model: this.config.model,
        system: systemMessage,
        messages: conversationMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        ...this.samplingOptions(options),
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 2000,
      });

      const content = response.data.content[0]?.type === 'text'
        ? response.data.content[0].text
        : '';

      logger.log(`[Anthropic] Response received, length: ${content.length}`);
      return content;
    } catch (error: any) {
      logger.error('[Anthropic] Chat request failed:', requestDiagnostic(error));
      throw aiRequestError(error);
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
      logger.error('[Anthropic] JSON request failed:', requestDiagnostic(error));
      throw aiRequestError(error);
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

      const stream = streamSSE(`${this.baseURL}/v1/messages`, {
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        data: {
          model: this.config.model,
          system: systemMessage,
          messages: conversationMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          stream: true,
          ...this.samplingOptions(),
          max_tokens: this.config.maxTokens ?? 2000,
        },
      });

      for await (const data of stream) {
        try {
          const event = JSON.parse(data);
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            onChunk(event.delta.text);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }

      logger.log('[Anthropic] Stream completed');
    } catch (error: any) {
      logger.error('[Anthropic] Stream failed:', requestDiagnostic(error));
      throw aiRequestError(error);
    }
  }
}
