// Angles are exact integer multiples of π/12; no floating-point equality.
export const POINTS = Array.from({ length: 24 }, (_, n) => n).filter(n => n % 2 === 0 || n % 3 === 0);
export const ERROR_DELAY = 500;
export const normalize = (units: number): number => ((units % 24) + 24) % 24;
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
export function levelFor(correct: number): number { return 1 + Math.floor(correct / 3); }
export function poolFor(level: number): number[] {
  const max = Math.max(1, Math.floor(level)) * 12;
  return Array.from({ length: 2 * max + 1 }, (_, i) => i - max)
    .filter(n => (n % 2 === 0 || n % 3 === 0) && (level === 1 || Math.abs(n) > max - 12));
}
export type Question = { units: number; point: number; level: number };
export class QuestionDeck {
  private remaining: number[] = [];
  private level = 0;
  private previousPoint = -1;
  private asked = 0;
  constructor(private random: () => number = Math.random) {}
  next(correct: number): Question {
    const level = levelFor(correct);
    if (this.level !== level || !this.remaining.length) {
      this.remaining = poolFor(level);
      this.level = level;
    }
    // One large integer multiple in each block of four, starting at question 2.
    // Their parity is accessible from the outset, independent of fraction level.
    const largeInteger = this.asked % 4 === 1;
    let source = largeInteger
      ? Array.from({ length: 198 }, (_, i) => (i < 99 ? i + 2 : -(i - 99 + 2)) * 12)
      : this.remaining;
    if (!source.some(n => normalize(n) !== this.previousPoint)) {
      this.remaining = poolFor(level);
      source = this.remaining;
    }
    const candidates = source.filter(n => normalize(n) !== this.previousPoint);
    const units = candidates[Math.floor(this.random() * candidates.length)]!;
    if (!largeInteger) this.remaining.splice(this.remaining.indexOf(units), 1);
    this.asked++;
    this.previousPoint = normalize(units);
    return { units, point: this.previousPoint, level };
  }
}
export type Answer = { units: number; selected: number; correct: boolean; elapsed: number };
export class Session {
  answers: Answer[] = [];
  question: Question;
  private deck: QuestionDeck;
  constructor(public total: number, random: () => number = Math.random) {
    this.deck = new QuestionDeck(random);
    this.question = this.deck.next(0);
  }
  get correct(): number { return this.answers.filter(a => a.correct).length; }
  get done(): boolean { return this.answers.length >= this.total; }
  answer(point: number, elapsed: number): Answer {
    if (this.done) throw new Error('Session finished');
    if (!POINTS.includes(point)) throw new Error('Unknown point');
    const answer = { units: this.question.units, selected: point, correct: point === this.question.point, elapsed };
    this.answers.push(answer);
    return answer;
  }
  advance(): void { if (!this.done) this.question = this.deck.next(this.correct); }
}
