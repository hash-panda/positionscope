import { createHash } from 'crypto';
import { Position, AccountInfo } from '../../types/exchange';
import { numeric, optionalNumber, nonnegative, liquidationDistance, positionNotional, sumKnown } from '../../utils/position-math';

export interface RiskFacts {
  version: 'risk-facts-v2';
  positionCount: number; grossNotional: number; netNotional: number;
  marginEquity: number | null; grossToEquity: number | null;
  largestAsset: string; largestAssetShare: number; longNotional: number; shortNotional: number;
  adverseMove5Percent: number; adverseMoveToEquity: number | null;
  positions: {exchange: string; symbol: string; side: string; quantity: number; mark: number;
    notional: number; marginMode: string; liquidationPrice: number | null; liquidationDistance: number | null;
    initialMargin: number | null; maintenanceMargin: number | null; currency: string;
    fetchedAt: number | null; sourceUpdatedAt: number | null; priceSource: string}[];
  accounts: {exchange: string; equity: number | null; riskEquity: number | null; scope: string; currency: string;
    mode: string; initialMargin: number | null; maintenanceMargin: number | null;
    nativeRatio: NonNullable<AccountInfo['marginFacts']>['nativeRatio'] | null; fetchedAt: number | null; notes: string[]}[];
  scenarios: {retainedShare: number; priceMove: number; pricePnl: number}[];
  limitations: string[];
}
export function buildRiskFacts(positions: Position[], accounts: AccountInfo[]): RiskFacts {
  if (!Array.isArray(positions) || !positions.length || positions.length > 500) throw new Error('分析需要1–500个有效持仓');
  if (!Array.isArray(accounts) || !accounts.length || accounts.length > 4) throw new Error('逐交易所账户数据缺失');
  const exchanges = new Set<string>();
  for (const account of accounts) {
    if (!['binance','bybit','okx','hyperliquid'].includes(account.exchange) || exchanges.has(account.exchange)) throw new Error('账户来源无效或重复');
    exchanges.add(account.exchange);
  }
  const assets = new Map<string, number>();
  let longNotional = 0, shortNotional = 0;
  const details = positions.map(p => {
    if (!p || !exchanges.has(p.exchange) || typeof p.symbol !== 'string' || !/^[a-zA-Z0-9._:/-]{1,60}$/.test(p.symbol)) throw new Error('持仓来源或交易对无效');
    const quantity = numeric(p.positionAmt), mark = numeric(p.markPrice);
    if (numeric(p.entryPrice) <= 0) throw new Error('开仓价无效');
    numeric(p.unRealizedProfit);
    if (p.leverage != null && numeric(p.leverage) <= 0) throw new Error('杠杆无效');
    const notional = positionNotional(p);
    if (quantity > 0) longNotional += notional; else shortNotional += notional;
    const asset = p.baseAsset || p.symbol.toUpperCase().replace(/[-_/]?(USDT|USDC|USD)([-_/]?(SWAP|PERP))?$/, '');
    if (!/^[a-zA-Z0-9._:/-]{1,60}$/.test(asset)) throw new Error('基础资产格式无效');
    assets.set(asset, (assets.get(asset) || 0) + notional);
    const liq = nonnegative(p.liquidationPrice);
    return {exchange: p.exchange, symbol: p.symbol, side: quantity > 0 ? 'long' : 'short', quantity, mark, notional,
      marginMode: p.marginType, liquidationPrice: liq && liq > 0 ? liq : null, liquidationDistance: liquidationDistance(p),
      initialMargin: nonnegative(p.initialMargin), maintenanceMargin: nonnegative(p.maintenanceMargin),
      currency: p.marginCurrency || p.settlementAsset || 'unknown', fetchedAt: optionalNumber(p.fetchedAt),
      sourceUpdatedAt: optionalNumber(p.sourceUpdatedAt), priceSource: p.priceSource || 'unknown'};
  });
  const accountFacts = accounts.map(a => ({exchange: a.exchange, equity: optionalNumber(a.totalMarginBalance),
    riskEquity: optionalNumber(a.marginFacts?.equity), scope: a.marginFacts?.scope || 'unverified', currency: a.marginFacts?.currency || 'unknown', mode: a.marginFacts?.mode || 'unknown',
    initialMargin: nonnegative(a.marginFacts?.initialMargin), maintenanceMargin: nonnegative(a.marginFacts?.maintenanceMargin),
    nativeRatio: a.marginFacts?.nativeRatio || null, fetchedAt: optionalNumber(a.fetchedAt), notes: a.valuationNotes || []}));
  const marginEquity = sumKnown(accountFacts.map(a => a.equity));
  const grossNotional = longNotional + shortNotional, netNotional = longNotional - shortNotional;
  if (!Number.isFinite(grossNotional) || grossNotional <= 0) throw new Error('总名义价值无效');
  const largest = [...assets].sort((a,b) => b[1]-a[1])[0];
  const ratio = marginEquity !== null && marginEquity > 0 ? grossNotional / marginEquity : null;
  if (ratio !== null && !Number.isFinite(ratio)) throw new Error('权益比值超出可计算范围');
  return {version: 'risk-facts-v2', positionCount: positions.length, grossNotional, netNotional, marginEquity,
    grossToEquity: ratio, largestAsset: largest[0], largestAssetShare: largest[1]/grossNotional,
    longNotional, shortNotional, adverseMove5Percent: grossNotional*.05, adverseMoveToEquity: ratio === null ? null : ratio*.05,
    positions: details, accounts: accountFacts,
    // Same percentage change for every underlying, holding quantities fixed. Not a forecast or liquidation simulation.
    scenarios: [1,.75,.5].flatMap(retainedShare => [-.2,-.1,-.05,.05,.1,.2].map(priceMove => ({retainedShare, priceMove, pricePnl: netNotional*retainedShare*priceMove}))),
    limitations: [
      '仅覆盖已连接账户的线性合约，USD/USDT/USDC按1:1估算；不含现货净敞口、期权、反向合约及未连接市场。',
      '各交易所保证金不可互抵；账户权益范围可能含共享抵押，汇总比值不是强平风险。',
      '强平距离仅按当前标记价与平台参考强平价计算，全仓受其他仓位、资金费和抵押变化影响；无强平价不等于没有强平风险。',
      '情景假设所有基础资产同幅涨跌、数量不变或按比例缩减；不计平仓盈亏结算、资金费、手续费、滑点、抵押变动或中途强平，不能推算新的强平价。各仓各自不利5%是另一个机械情景。',
      '无账户历史及投资期限，不能计算胜率、夏普、VaR或判断长期持有收益；缺少基本面、解锁与全市场数据，不能筛选早期价值。',
      ...(details.some(p => p.liquidationPrice === null) ? ['部分持仓未提供有效强平价，相关距离不可计算。'] : []),
      ...(details.some(p => p.maintenanceMargin === null) ? ['部分持仓未提供可用维持保证金，不能还原精确强平触发条件。'] : []),
      ...(marginEquity === null ? ['部分账户权益不适用或缺失，汇总权益比不可计算。'] : marginEquity <= 0 ? ['权益非正，权益比不可计算。'] : []),
      ...(positions.some(p => p.exchange === 'hyperliquid') ? ['Hyperliquid仅支持标准账户默认永续DEX，不含其他DEX、质押、借贷或统一账户。'] : []),
    ]};
}
export function analysisCacheKey(positions: Position[], accounts: AccountInfo[], provider: string, model: string, market?: import('../../types/market').MarketSnapshot): string {
  return createHash('sha256').update(JSON.stringify({positions, accounts, provider, model, market, version:'risk-facts-v2'})).digest('hex');
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
