/**
 * AI 模型类型定义
 *
 * 本文件定义了AI集成所需的所有类型和接口
 */

import type { RiskFacts } from '../services/ai/risk-facts';
import { Position, AccountInfo } from './exchange';

/**
 * 支持的AI模型提供商
 */
export enum AIProvider {
  OPENAI = 'openai',          // ChatGPT (GPT-3.5, GPT-4)
  ANTHROPIC = 'anthropic',     // Claude
  DEEPSEEK = 'deepseek',       // DeepSeek
  QWEN = 'qwen',               // 阿里千问
  GROK = 'grok',               // xAI Grok
  GEMINI = 'gemini',           // Google Gemini
}

/**
 * AI模型配置
 */
export interface AIModelConfig {
  provider: AIProvider;        // 提供商
  model: string;               // 模型名称（如 gpt-4-turbo, claude-3-opus）
  apiKey: string;              // API密钥
  baseURL?: string;            // 自定义API端点
  temperature?: number;        // 温度参数 (0-1)
  maxTokens?: number;          // 最大token数
}

/**
 * AI提供商的凭证配置
 */
export interface AICredentials {
  model?: string;
  provider: AIProvider;
  apiKey: string;
  baseURL?: string;
}

/**
 * AI设置
 */
export interface AISettings {
  enabled: boolean;                              // 是否启用AI功能
  defaultProvider: AIProvider;                   // 默认使用的AI提供商
  credentials: Record<AIProvider, AICredentials>; // 各提供商的凭证
  useCustomKeys: boolean;                        // 是否使用自定义API key
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

/**
 * 持仓健康度评分
 */
export interface HealthScore {
  facts: RiskFacts;
  market?: import('./market').MarketSnapshot;
  fundingScenarios?: import('./market').FundingScenario[];
  snapshotId: string;
  analyzedAt: string;
  provider: string;
  model: string;
  summary: string;               // 总结
  warnings: string[];            // 警告列表
  suggestions: string[];         // 建议列表
}

/**
 * 风险预警级别
 */
export enum RiskLevel {
  SAFE = 'safe',
  WARNING = 'warning',
  DANGER = 'danger',
  CRITICAL = 'critical',
}

/**
 * 风险预警
 */
export interface RiskAlert {
  id: string;
  level: RiskLevel;
  title: string;
  description: string;
  suggestion: string;
  positions?: string[];          // 相关持仓
  timestamp: number;
}

/**
 * 每日盈亏总结
 */
export interface DailySummary {
  date: Date;
  summary: string;               // AI生成的总结
  stats: {
    totalPnL: number;            // 总盈亏
    returnRate: number;          // 收益率
    winningTrades: number;       // 盈利交易数
    losingTrades: number;        // 亏损交易数
    winRate: number;             // 胜率
    avgWin: number;              // 平均盈利
    avgLoss: number;             // 平均亏损
  };
}

/**
 * AI分析请求
 */
export interface AnalysisRequest {
  positions: Position[];
  accountInfo: AccountInfo[];
  marketData?: any;              // 市场数据（可选）
}

/**
 * AI分析响应
 */
export interface AnalysisResponse {
  healthScore?: HealthScore;
  risks?: RiskAlert[];
  suggestions?: string[];
  timestamp: number;
}

/**
 * AI聊天上下文
 */
export interface ChatContext {
  positions: Position[];
  accountInfo: AccountInfo;
  recentTrades?: any[];
}

/**
 * 缓存的分析结果
 */
export interface CachedAnalysis {
  data: any;
  timestamp: number;
}

