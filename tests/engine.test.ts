import test from 'node:test';
import assert from 'node:assert/strict';
import { angleText, ERROR_DELAY, fraction, levelFor, normalize, POINTS, poolFor, QuestionDeck, Session } from '../src/engine';

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
test('fraction difficulty expands every three correct answers', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6].map(levelFor), [1, 1, 1, 2, 2, 3]);
  for (let level = 1; level <= 14; level++) for (const units of poolFor(level)) {
    assert.ok(Math.abs(units) <= level * 12);
    if (level > 1) assert.ok(Math.abs(units) > (level - 1) * 12);
    assert.ok(POINTS.includes(normalize(units)));
  }
});
test('question 2 already includes a large integer; consecutive targets differ', () => {
  let seed = 4141;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const deck = new QuestionDeck(random);
  let previous = -1;
  for (let i = 0; i < 1000; i++) {
    const q = deck.next(i % 40);
    assert.notEqual(q.point, previous);
    assert.ok(POINTS.includes(q.point));
    assert.equal(q.point, normalize(q.units));
    if (i % 4 === 1) { assert.equal(Math.abs(q.units % 12), 0); assert.ok(Math.abs(q.units) >= 24); }
    previous = q.point;
  }
});
test('wrong answers do not raise difficulty and final answers complete a session', () => {
  const s = new Session(5, () => .47);
  for (let i = 0; i < 3; i++) { s.answer(s.question.point, 250); s.advance(); }
  assert.equal(s.correct, 3); assert.equal(s.question.level, 2);
  s.answer(POINTS.find(p => p !== s.question.point)!, 400); s.advance();
  assert.equal(s.question.level, 2); assert.equal(s.correct, 3);
  s.answer(s.question.point, 500); assert.equal(s.done, true); assert.equal(s.correct, 4);
  assert.throws(() => s.answer(s.question.point, 0));
  assert.equal(ERROR_DELAY, 500);
});
