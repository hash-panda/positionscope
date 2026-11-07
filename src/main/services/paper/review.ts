import type { PaperCycle, PaperPolicy } from '../../types/paper';
import { decimal as d, format as f } from './decimal';
export type ReviewChoice = 'keep' | 'reduce-allocation' | 'shorter-hold' | 'tighter-stop' | 'further-target';
export const REVIEW_CHOICES: ReviewChoice[] = ['keep','reduce-allocation','shorter-hold','tighter-stop','further-target'];
export const TRIAL_RULES = Object.freeze({ version:'forward-paired-v1', minimumDays:7, minimumPairedTrades:30, minimumAdvantageBps:50, maximumDrawdownBps:500 });
export function reviewFacts(cycle: PaperCycle) {
  const closed=cycle.trades.filter(t=>t.exit), sum=(key:'grossPnl'|'fees'|'funding')=>closed.reduce((n,t)=>n+d(t[key]),0n);
  const gross=sum('grossPnl'),fees=sum('fees'),funding=sum('funding'),net=gross-fees+funding;
  let peak=d(cycle.capital),drawdownBps=0n;
  for(const point of cycle.curve){if(point.equity===null)continue;const value=d(point.equity);if(value>peak)peak=value;if(peak>0n){const dd=(peak-value)*10000n/peak;if(dd>drawdownBps)drawdownBps=dd;}}
  return {closedTrades:closed.length,openTrades:cycle.trades.length-closed.length,capital:cycle.capital,grossPnl:f(gross),fees:f(fees),funding:f(funding),knownClosedNetPnl:f(net),
    fundingComplete:closed.every(t=>t.fundingThrough>=t.exit!.quoteAt),sampledDrawdownBps:Number(drawdownBps),gaps:cycle.gaps.length,
    rejected:cycle.decisions.filter(p=>['rejected','cancelled','expired'].includes(p.status)).length,abstentions:cycle.decisions.filter(p=>p.status==='abstained').length};
}
export type PaperReviewFacts = ReturnType<typeof reviewFacts>;
export function candidatePolicy(base: PaperPolicy, choice: ReviewChoice, version: string): PaperPolicy {
  const next={...base,version};
  if(choice==='reduce-allocation')next.allocationBps=Math.max(500,base.allocationBps-500);
  if(choice==='shorter-hold')next.maxHoldMinutes=Math.max(5,Math.floor(base.maxHoldMinutes/2));
  if(choice==='tighter-stop')next.stopBps=Math.max(50,Math.floor(base.stopBps*.8));
  if(choice==='further-target')next.targetBps=Math.min(1000,base.targetBps+100);
  return next;
}
export function validateReviewChoice(raw: unknown): {choice:ReviewChoice;support:string[];counter:string[]} {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid review');const value=raw as Record<string,unknown>;
  if(Object.keys(value).sort().join(',')!=='choice,counter,support'||!REVIEW_CHOICES.includes(value.choice as ReviewChoice))throw Error('Invalid review');
  const allowed=new Set(['closedTrades','openTrades','grossPnl','fees','funding','knownClosedNetPnl','fundingComplete','sampledDrawdownBps','gaps','rejected','abstentions']);
  for(const list of [value.support,value.counter])if(!Array.isArray(list)||list.length>4||list.some(id=>typeof id!=='string'||!allowed.has(id))||new Set(list).size!==list.length)throw Error('Invalid references');
  const support=value.support as string[],counter=value.counter as string[];
  if(support.some(id=>counter.includes(id))||(value.choice!=='keep'&&(!support.length||!counter.length)))throw Error('Invalid counterevidence');
  return {choice:value.choice as ReviewChoice,support,counter};
}
/** Prospective comparison only. Thresholds were frozen before either virtual account received a signal. */
export function evaluateTrial(baseline: PaperCycle, challenger: PaperCycle, startedAt: number, at: number) {
  const a=reviewFacts(baseline),b=reviewFacts(challenger),ids=new Set(baseline.trades.filter(t=>t.exit).map(t=>t.id));
  const paired=challenger.trades.filter(t=>t.exit&&ids.has(t.id)).length;
  const reasons:string[]=[];
  if(at-startedAt<TRIAL_RULES.minimumDays*86400000)reasons.push('前向观察不足七天');
  if(paired<TRIAL_RULES.minimumPairedTrades)reasons.push('成对已平仓样本不足三十笔');
  if(a.openTrades||b.openTrades||!a.fundingComplete||!b.fundingComplete)reasons.push('持仓或资金费尚未结算');
  if(a.gaps||b.gaps||baseline.curve.some(p=>p.equity===null)||challenger.curve.some(p=>p.equity===null))reasons.push('观察存在缺口');
  const advantageBps=Number((d(b.knownClosedNetPnl)-d(a.knownClosedNetPnl))*10000n/d(a.capital));
  if(baseline.capital!==challenger.capital)reasons.push('对照本金不一致');
  if(advantageBps<TRIAL_RULES.minimumAdvantageBps)reasons.push('净值优势未达到预先声明门槛');
  if(b.sampledDrawdownBps>a.sampledDrawdownBps||b.sampledDrawdownBps>TRIAL_RULES.maximumDrawdownBps)reasons.push('采样回撤未通过门槛');
  return {eligible:reasons.length===0,paired,advantageBps,baseline:a,challenger:b,reasons};
}
