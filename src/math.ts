import { angleText, fraction } from './engine';
const wrap = (body: string, label: string): string => `<math xmlns="http://www.w3.org/1998/Math/MathML" class="math" display="inline" displaystyle="true" aria-label="${label}"><mrow>${body}</mrow></math>`;
export function angleNode(units: number): string {
  if (units === 0) return '<mn>0</mn>';
  const { numerator:n,denominator:d }=fraction(units);
  const top=`<mrow>${Math.abs(n)>1?`<mn>${Math.abs(n)}</mn>`:''}<mi>π</mi></mrow>`;
  return `${n<0?'<mo class="minus">−</mo>':''}${d===1?top:`<mfrac>${top}<mn>${d}</mn></mfrac>`}`;
}
export function angle(units: number): string { return wrap(angleNode(units),angleText(units)); }
function radical(n: 2 | 3): string {
  // One connected path: identical stroke and no join between a font glyph and a rule.
  return `<mtext class="radical-holder"><svg xmlns="http://www.w3.org/2000/svg" class="unified-root" viewBox="0 0 38 32" width="1.1875em" height="1em" aria-hidden="true"><path d="M1.5 16L5.5 13L10.5 28L17 3H36" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><text x="19" y="26" font-size="30">${n}</text></svg></mtext>`;
}
export function valueNode(value: number): string {
  const n=Math.abs(value),sign=value<0?'<mo class="minus">−</mo>':'';
  return `${sign}${n===0?'<mn>0</mn>':n===4?'<mn>1</mn>':`<mfrac>${n===1?'<mn>1</mn>':radical(n===2?2:3)}<mn>2</mn></mfrac>`}`;
}
export function valueHtml(value:number):string { return wrap(valueNode(value),valueText(value)); }
export function valueText(value:number):string {
  const n=Math.abs(value);return `${value<0?'−':''}${n===0?'0':n===4?'1':n===1?'1/2':n===2?'√2/2':'√3/2'}`;
}
export function trigFormula(fn:'cos'|'sin',units:number):string {
  return wrap(`<mi class="function-name" mathvariant="normal">${fn}</mi><mo>⁡</mo><mrow><mo class="math-parenthesis" stretchy="true">(</mo><mrow>${angleNode(units)}</mrow><mo class="math-parenthesis" stretchy="true">)</mo></mrow><mo>=</mo><mo>?</mo>`,`${fn} de ${angleText(units)} égale ?`);
}
export function trigEquation(fn:'cos'|'sin',value:number):string {
  return wrap(`<mi class="function-name" mathvariant="normal">${fn}</mi><mo>=</mo>${valueNode(value)}`,`${fn} égale ${valueText(value)}`);
}
