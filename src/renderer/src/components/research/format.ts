import type { ResearchFact } from '../../../../main/types/research';
export const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export function number(value: number | null | undefined, digits = 2) {
  return finite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
}
export function percent(value: number | null | undefined) { return finite(value) ? `${value > 0 ? '+' : ''}${number(value)}%` : '—'; }
export function sign(value: number | null | undefined) { return finite(value) ? value > 0 ? 'positive' : value < 0 ? 'negative' : '' : ''; }
export function compact(value: number | null | undefined) {
  if (!finite(value)) return '—';
  if (Math.abs(value) >= 1e9) return `${number(value / 1e9)}B`;
  if (Math.abs(value) >= 1e6) return `${number(value / 1e6)}M`;
  if (Math.abs(value) >= 1e3) return `${number(value / 1e3)}K`;
  return number(value);
}
export function time(value: number | null | undefined) { return value ? new Date(value).toLocaleTimeString('zh-CN', { hour12: false }) : '时间未知'; }
export function factValue(fact: ResearchFact) {
  if (fact.unit === 'percent') return percent(fact.value);
  if (fact.unit === 'ratio') return percent(fact.value * 100);
  return `${number(fact.value, fact.unit === 'contracts' ? 0 : 2)} ${fact.unit}`;
}
