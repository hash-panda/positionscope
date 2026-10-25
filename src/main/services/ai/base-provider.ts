import { resolveAIModel } from '../../utils/ai-model';
/**
 * AI Provider 基类
 *
 * 所有AI模型提供商都需要实现这个抽象类
 * 遵循策略模式，实现高内聚低耦合
 */

import { ChatMessage, AIModelConfig } from '../../types/ai';
import { logger } from '../../utils/logger';

/**
 * AI Provider 抽象基类
 */
export abstract class BaseAIProvider {
  protected config: AIModelConfig;

  constructor(config: AIModelConfig) {
    this.config = {...config, model:resolveAIModel(config.provider, config.model)};
    logger.log(`[AI Provider] Initialized: ${config.provider}`);
  }

  /**
   * 发送聊天请求（必须实现）
   *
   * @param messages - 聊天消息历史
   * @param options - 额外选项
   * @returns AI的响应内容
   */
  abstract chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<string>;

  /**
   * 发送结构化请求（返回JSON）
   *
   * @param messages - 聊天消息历史
   * @param jsonSchema - JSON schema（可选）
   * @returns 解析后的JSON对象
   */
  abstract chatJSON<T = any>(
    messages: ChatMessage[],
    jsonSchema?: any
  ): Promise<T>;

  /**
   * 流式聊天（可选实现）
   *
   * @param messages - 聊天消息历史
   * @param onChunk - 每次收到数据块时的回调
   */
  async chatStream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    // 默认实现：不支持流式
    const response = await this.chat(messages);
    onChunk(response);
  }

  /**
   * 获取模型名称
   */
  getModelName(): string {
    return this.config.model;
  }

  /**
   * 获取提供商名称
   */
  getProviderName(): string {
    return this.config.provider;
  }

  /**
   * 验证API密钥是否有效
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.chat([{ role: 'user', content: 'Hi' }]);
      return true;
    } catch (error) {
      logger.error(`[AI Provider] API key validation failed:`, error);
      return false;
    }
  }
}

/**
 * 聊天选项
 */
export interface ChatOptions {
  temperature?: number;    // 温度参数
  maxTokens?: number;      // 最大token数
  topP?: number;           // Top-p采样
  stream?: boolean;        // 是否流式输出
}
