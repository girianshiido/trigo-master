import test from 'node:test';
import assert from 'node:assert/strict';
import { angleText, fraction, normalize, POINTS } from '../src/engine';

test('exactly the 16 distinct points from multiples of π/4 and π/6', () => {
  assert.equal(POINTS.length, 16);
  assert.equal(new Set(POINTS).size, 16);
  for (let n = -240; n <= 240; n++) assert.equal(POINTS.includes(normalize(n)), n % 2 === 0 || n % 3 === 0);
});
test('all displayed fractions are irreducible, including negatives and large angles', () => {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  for (let units = -1200; units <= 1200; units++) {
    const f = fraction(units);
    assert.equal(gcd(Math.abs(f.numerator), f.denominator), 1);
    assert.equal(f.numerator / f.denominator, units / 12);
  }
  assert.equal(angleText(6), 'π/2');
  assert.equal(angleText(-12), '−π');
  assert.equal(angleText(8), '2π/3');
  assert.equal(angleText(32 * 12), '32π');
  assert.equal(angleText(-75 * 12), '−75π');
  assert.equal(angleText(0), '0');
});
test('parity maps even and odd integer multiples to opposite horizontal endpoints', () => {
  for (let n = -100; n <= 100; n++) assert.equal(normalize(12 * n), n % 2 === 0 ? 0 : 12);
});
