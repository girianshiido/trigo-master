// Exact integer multiples of π/12, never floating-point angle comparisons.
export const POINTS = Array.from({ length: 24 }, (_, n) => n).filter(n => n % 2 === 0 || n % 3 === 0);
export const ALL_POINTS = Array.from({ length: 24 }, (_, n) => n);
export const ERROR_DELAY = 500;
export const normalize = (n: number): number => ((n % 24) + 24) % 24;
const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
export function fraction(units: number): { numerator: number; denominator: number } {
  const divisor = gcd(Math.abs(units), 12);
  return { numerator: units / divisor, denominator: 12 / divisor };
}
export function angleText(units: number): string {
  if (units === 0) return '0';
  const { numerator: n, denominator: d } = fraction(units);
  return `${n < 0 ? '−' : ''}${Math.abs(n) === 1 ? '' : Math.abs(n)}π${d === 1 ? '' : `/${d}`}`;
}
export type Answer = { units: number; selected: number; correct: boolean; elapsed: number };
