/**
 * AI Service - 核心服务
 *
 * 负责管理所有AI Provider，提供统一的AI功能接口
 * 包括：持仓分析、风险评估、智能问答等
 */

import { BaseAIProvider } from './base-provider';
import { OpenAIProvider } from './providers/openai-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { DeepSeekProvider } from './providers/deepseek-provider';
import { QwenProvider, GrokProvider, GeminiProvider } from './providers/generic-provider';
import {
  AIProvider,
  AIModelConfig,
  AISettings,
  ChatMessage,
  HealthScore,
  RiskAlert,
  CachedAnalysis,
  AnalysisRequest,
} from '../../types/ai';
import { Position, AccountInfo } from '../../types/exchange';
import { logger } from '../../utils/logger';

/**
 * AI分析结果缓存
 */
class AIAnalysisCache {
  private cache = new Map<string, CachedAnalysis>();
  private readonly TTL = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 获取或执行分析
   */
  async getOrAnalyze<T>(
    key: string,
    analyzeFunc: () => Promise<T>
  ): Promise<T> {
    const cached = this.cache.get(key);

    // 检查缓存是否有效
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      logger.log(`[AI Cache] Hit: ${key}`);
      return cached.data as T;
    }

    logger.log(`[AI Cache] Miss: ${key}, executing analysis`);
    const data = await analyzeFunc();

    // 保存到缓存
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  /**
   * 清除缓存
   */
  clear() {
    this.cache.clear();
    logger.log('[AI Cache] Cleared');
  }
}

/**
 * AI服务主类
 */
export class AIService {
  private providers: Map<AIProvider, BaseAIProvider> = new Map();
  private defaultProvider: AIProvider = AIProvider.ANTHROPIC;
  private cache: AIAnalysisCache = new AIAnalysisCache();
  private conversationHistory: ChatMessage[] = [];

  constructor() {
    logger.log('[AI Service] Initialized');
  }

  /**
   * 设置AI配置
   */
  setConfig(settings: AISettings) {
    logger.log('[AI Service] Updating configuration');

    this.defaultProvider = settings.defaultProvider;

    // 清除旧的providers
    this.providers.clear();

    // 初始化各个provider
    for (const [providerName, credentials] of Object.entries(settings.credentials)) {
      if (credentials.apiKey) {
        try {
          const provider = this.createProvider({
            provider: providerName as AIProvider,
            apiKey: credentials.apiKey,
            baseURL: credentials.baseURL,
            model: this.getDefaultModel(providerName as AIProvider),
          });

          this.providers.set(providerName as AIProvider, provider);
          logger.log(`[AI Service] Provider registered: ${providerName}`);
        } catch (error: any) {
          logger.error(`[AI Service] Failed to initialize ${providerName}:`, error.message);
        }
      }
    }
  }

  /**
   * 创建Provider实例（工厂模式）
   */
  private createProvider(config: AIModelConfig): BaseAIProvider {
    switch (config.provider) {
      case AIProvider.OPENAI:
        return new OpenAIProvider(config);

      case AIProvider.ANTHROPIC:
        return new AnthropicProvider(config);

      case AIProvider.DEEPSEEK:
        return new DeepSeekProvider(config);

      case AIProvider.QWEN:
        return new QwenProvider(config);

      case AIProvider.GROK:
        return new GrokProvider(config);

      case AIProvider.GEMINI:
        return new GeminiProvider(config);

      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  /**
   * 获取默认模型名称
   */
  private getDefaultModel(provider: AIProvider): string {
    const defaultModels: Record<AIProvider, string> = {
      [AIProvider.OPENAI]: 'gpt-4-turbo',
      [AIProvider.ANTHROPIC]: 'claude-3-5-sonnet-20241022',
      [AIProvider.DEEPSEEK]: 'deepseek-chat',
      [AIProvider.QWEN]: 'qwen-turbo',
      [AIProvider.GROK]: 'grok-beta',
      [AIProvider.GEMINI]: 'gemini-pro',
    };

    return defaultModels[provider] || 'gpt-4-turbo';
  }

  /**
   * 获取当前可用的Provider
   */
  private getProvider(providerName?: AIProvider): BaseAIProvider {
    const targetProvider = providerName || this.defaultProvider;
    const provider = this.providers.get(targetProvider);

    if (!provider) {
      throw new Error(`AI Provider not initialized: ${targetProvider}`);
    }

    return provider;
  }

  /**
   * 分析持仓健康度
   */
  async analyzePortfolioHealth(
    positions: Position[],
    accountInfo: AccountInfo,
    providerName?: AIProvider
  ): Promise<HealthScore> {
    const cacheKey = `health-${JSON.stringify({ positions: positions.length, balance: accountInfo.totalMarginBalance })}`;

    return this.cache.getOrAnalyze(cacheKey, async () => {
      const provider = this.getProvider(providerName);
      const prompt = this.buildHealthAnalysisPrompt(positions, accountInfo);

      logger.log('[AI Service] Analyzing portfolio health');

      const response = await provider.chatJSON<HealthScore>([
        {
          role: 'user',
          content: prompt,
        },
      ]);

      logger.log('[AI Service] Health analysis completed');
      return response;
    });
  }

  /**
   * 构建健康度分析Prompt
   */
  private buildHealthAnalysisPrompt(positions: Position[], accountInfo: AccountInfo): string {
    return `你是一位专业的加密货币交易顾问。请分析以下持仓数据：

**账户信息**
- 总资产：${accountInfo.totalAssets || accountInfo.totalMarginBalance} USDT
- 合约账户：${accountInfo.totalMarginBalance} USDT
- 现货账户：${accountInfo.spotTotalUSDT || 0} USDT
- 未实现盈亏：${accountInfo.totalUnrealizedProfit} USDT
- 可用余额：${accountInfo.availableBalance} USDT

**持仓详情（共${positions.length}个）**
${positions.map((p, i) => `
${i + 1}. ${p.symbol}
   - 方向：${parseFloat(p.positionAmt) > 0 ? '做多' : '做空'}
   - 数量：${Math.abs(parseFloat(p.positionAmt))}
   - 杠杆：${p.leverage}x
   - 开仓价：${p.entryPrice} USDT
   - 当前价：${p.markPrice} USDT
   - 盈亏：${p.unRealizedProfit} USDT (${((parseFloat(p.unRealizedProfit) / (parseFloat(p.positionAmt) * parseFloat(p.entryPrice))) * 100).toFixed(2)}%)
`).join('\n')}

请从以下维度进行评分（0-100分）：
1. **分散度** (diversification)：持仓是否分散，避免过度集中在单一币种
2. **杠杆合理性** (leverage)：杠杆倍数是否合理，风险是否可控
3. **风险敞口** (riskExposure)：整体风险暴露程度
4. **盈亏比** (profitabilityRatio)：当前盈利情况

**返回格式（必须是有效的JSON）**：
{
  "overallScore": 85,
  "diversification": 90,
  "leverage": 80,
  "riskExposure": 85,
  "profitabilityRatio": 88,
  "summary": "整体风险可控，建议...",
  "warnings": ["警告1", "警告2"],
  "suggestions": ["建议1", "建议2"]
}`;
  }

  /**
   * 智能对话
   */
  async chat(
    message: string,
    context?: { positions: Position[]; accountInfo: AccountInfo },
    providerName?: AIProvider
  ): Promise<string> {
    const provider = this.getProvider(providerName);

    // 构建系统提示
    const systemPrompt = context
      ? this.buildChatSystemPrompt(context.positions, context.accountInfo)
      : '你是一位专业的加密货币交易助手。';

    // 添加用户消息
    this.conversationHistory.push({
      role: 'user',
      content: message,
    });

    logger.log(`[AI Service] Chat request: ${message.substring(0, 50)}...`);

    // 调用AI
    const response = await provider.chat([
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory,
    ]);

    // 保存AI响应
    this.conversationHistory.push({
      role: 'assistant',
      content: response,
    });

    logger.log('[AI Service] Chat response received');
    return response;
  }

  /**
   * 构建聊天系统提示
   */
  private buildChatSystemPrompt(positions: Position[], accountInfo: AccountInfo): string {
    return `你是一位专业且友好的加密货币交易助手。

**用户当前状态**：
- 总资产：${accountInfo.totalAssets || accountInfo.totalMarginBalance} USDT
- 未实现盈亏：${accountInfo.totalUnrealizedProfit} USDT
- 持仓数量：${positions.length}
- 主要持仓：${positions.slice(0, 3).map(p => `${p.symbol} (${p.leverage}x)`).join(', ')}

**你的任务**：
1. 回答用户关于持仓、盈亏、风险管理的问题
2. 给出专业但易懂的建议
3. 保持友好和鼓励的语气
4. 提醒：所有建议仅供参考，不构成投资建议

**注意事项**：
- 不要建议具体的买入或卖出价格
- 强调风险管理的重要性
- 根据用户的实际持仓情况给出个性化建议`;
  }

  /**
   * 清除对话历史
   */
  clearConversation() {
    this.conversationHistory = [];
    logger.log('[AI Service] Conversation history cleared');
  }

  /**
   * 清除分析缓存
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.providers.size > 0;
  }

  /**
   * 获取可用的Provider列表
   */
  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providers.keys());
  }
}

// 导出单例
export const aiService = new AIService();
