import { createHash } from 'crypto';
import { Position, AccountInfo } from '../../types/exchange';

export interface RiskFacts {
  version: 'risk-facts-v1';
  positionCount: number;
  grossNotional: number;
  netNotional: number;
  marginEquity: number;
  grossToEquity: number | null;
  largestAsset: string;
  largestAssetShare: number;
  longNotional: number;
  shortNotional: number;
  adverseMove5Percent: number;
  adverseMoveToEquity: number | null;
  limitations: string[];
}
const finite = (value: unknown, label: string) => {
  if (value === '' || value == null || typeof value === 'boolean') throw new Error(`${label} 缺失`);
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${label} 不是有效数值`);
  return n;
};
export function buildRiskFacts(positions: Position[], account: AccountInfo): RiskFacts {
  if (!Array.isArray(positions) || positions.length === 0 || positions.length > 500) {
    throw new Error('分析需要 1–500 个有效持仓');
  }
  const marginEquity = finite(account?.totalMarginBalance, '合约权益');
  const assets = new Map<string, number>();
  let longNotional = 0, shortNotional = 0;
  for (const p of positions) {
    if (!p || typeof p.symbol !== 'string' || !/^[a-zA-Z0-9._:/-]{1,60}$/.test(p.symbol)) throw new Error('交易对格式无效');
    const qty = finite(p.positionAmt, '持仓数量');
    const mark = finite(p.markPrice, '标记价');
    const entry = finite(p.entryPrice, '开仓价');
    finite(p.unRealizedProfit, '未实现盈亏');
    const leverage = finite(p.leverage, '杠杆');
    if (!qty || mark <= 0 || entry <= 0 || leverage <= 0) throw new Error('持仓价格、数量或杠杆无效');
    const value = Math.abs(qty) * mark;
    if (!Number.isFinite(value)) throw new Error('名义价值超出可计算范围');
    if (qty > 0) longNotional += value; else shortNotional += value;
    // Combine the same underlying asset across exchanges and both directions.
    const asset = p.symbol.toUpperCase().replace(/[-_/]?(USDT|USDC|USD)([-_/]?(SWAP|PERP))?$/, '');
    assets.set(asset, (assets.get(asset) || 0) + value);
  }
  const grossNotional = longNotional + shortNotional;
  if (!Number.isFinite(grossNotional) || grossNotional <= 0) throw new Error('总名义价值无效');
  const largest = [...assets].sort((a,b) => b[1]-a[1])[0];
  const ratio = marginEquity > 0 ? grossNotional / marginEquity : null;
  if (ratio !== null && !Number.isFinite(ratio)) throw new Error('权益比值超出可计算范围');
  return {
    version:'risk-facts-v1', positionCount:positions.length, grossNotional,
    netNotional:longNotional-shortNotional, marginEquity, grossToEquity:ratio,
    largestAsset:largest[0], largestAssetShare:largest[1]/grossNotional,
    longNotional,shortNotional,adverseMove5Percent:grossNotional*.05,
    adverseMoveToEquity:ratio === null ? null : ratio*.05,
    limitations:[
      ...(positions.some(p => p.exchange === 'hyperliquid') ? ['Hyperliquid 仅覆盖标准账户的默认永续 DEX，USDC 与 USDT 按 1:1 等值估算；不覆盖其他 DEX、质押、借贷或统一账户。'] : []),
      '仅为线性 USDT/USD 计价仓位快照；未覆盖现货净敞口、期权和反向合约。',
      '不同交易所的保证金不能互相抵扣；汇总名义价值/权益不代表各交易所强平风险。',
      '5% 不利变化按每笔仓位各自不利方向计算，是机械压力情景；不代表共同市场路径或损失概率，未计费用、资金费和滑点。',
      '缺少历史收益、波动率、相关性、强平价与维持保证金，无法计算胜率、夏普、VaR 或精确强平距离。',
      ...(marginEquity <= 0 ? ['合约权益非正，权益比例不可计算，需优先核对账户数据。'] : []),
    ],
  };
}
export function analysisCacheKey(positions: Position[], account: AccountInfo, provider: string, model: string): string {
  return createHash('sha256').update(JSON.stringify({ positions, account, provider, model, version:'risk-facts-v1' })).digest('hex');
}
export interface AnalysisNarrative { summary: string; warnings: string[]; suggestions: string[] }
export function validateNarrative(value: unknown): AnalysisNarrative {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('分析结果必须是对象');
  const data = value as Record<string, unknown>;
  if (typeof data.summary !== 'string' || !data.summary.trim() || data.summary.length > 3000) throw new Error('分析摘要无效');
  for (const key of ['warnings','suggestions']) {
    if (!Array.isArray(data[key]) || data[key].length > 12 || data[key].some((s:unknown) => typeof s !== 'string' || !s.trim() || s.length > 1000)) throw new Error('分析列表格式无效');
  }
  return {summary:data.summary,warnings:data.warnings as string[],suggestions:data.suggestions as string[]};
}
