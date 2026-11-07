/** Twelve decimal places, serialized as decimal strings. No binary float money arithmetic. */
export const SCALE = 1_000_000_000_000n;
export function decimal(value: unknown): bigint {
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d{0,12})(?:\.\d{1,12})?$/.test(value)) throw new Error('Invalid decimal');
  const negative = value.startsWith('-'), [whole, part = ''] = (negative ? value.slice(1) : value).split('.');
  return (negative ? -1n : 1n) * (BigInt(whole) * SCALE + BigInt(part.padEnd(12, '0')));
}
export function format(value: bigint): string {
  const magnitude = value < 0n ? -value : value;
  const fraction = (magnitude % SCALE).toString().padStart(12, '0').replace(/0+$/, '');
  return `${value < 0n ? '-' : ''}${magnitude / SCALE}${fraction ? '.' + fraction : ''}`;
}
export const multiply = (a: bigint, b: bigint) => a * b / SCALE;
export const divide = (a: bigint, b: bigint) => { if (b === 0n) throw new Error('Zero divisor'); return a * SCALE / b; };
export const ceilPositive = (a: bigint, denominator: bigint) => (a + denominator - 1n) / denominator;
export const basisPoints = (value: bigint, bps: number) => value * BigInt(bps) / 10_000n;
export const cost = (value: bigint, bps: number) => ceilPositive(value * BigInt(bps), 10_000n);
