import type { Position } from '../types/exchange';

export function numeric(value: unknown, label = '数据'): number {
  if ((typeof value !== 'string' && typeof value !== 'number') ||
      (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))) throw new Error(`${label}缺失或格式无效`);
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`${label}不是有限数值`);
  return result;
}
export function optionalNumber(value: unknown): number | null {
  return value == null || (typeof value === 'string' && !value.trim()) ? null : numeric(value);
}
export function nonnegative(value: unknown): number | null {
  const result=optionalNumber(value);
  if(result!==null&&result<0) throw new Error('保证金金额不能为负');
  return result;
}
export function positionNotional(position: Pick<Position,'positionAmt'|'markPrice'>): number {
  const quantity=numeric(position.positionAmt,'币数量'),mark=numeric(position.markPrice,'标记价');
  const value=Math.abs(quantity)*mark;
  if(!quantity||mark<=0||value<=0||!Number.isFinite(value)) throw new Error('名义价值不可计算');
  return value;
}
export function liquidationDistance(position: Pick<Position,'positionAmt'|'markPrice'|'liquidationPrice'>): number | null {
  const liquidation=optionalNumber(position.liquidationPrice),mark=optionalNumber(position.markPrice),quantity=optionalNumber(position.positionAmt);
  if(liquidation===null||liquidation<=0||mark===null||mark<=0||quantity===null||!quantity)return null;
  const distance=quantity>0?(mark-liquidation)/mark:(liquidation-mark)/mark;
  if (!Number.isFinite(distance)) throw new Error('强平参考距离超出可计算范围');
  return distance;
}
export function sumKnown(values: (number | null | undefined)[]): number | null {
  if(values.some(value=>value==null||!Number.isFinite(value)))return null;
  const result=(values as number[]).reduce((sum,value)=>sum+value,0);
  return Number.isFinite(result)?result:null;
}
