import './style.css';
import { angleText, ERROR_DELAY, fraction, normalize, POINTS, Session, type Answer } from './engine';

const app = document.querySelector<HTMLDivElement>('#app')!;
let total = 10;
let session: Session | null = null;
let locked = false;
let questionStarted = 0;
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
let pulseTimer: ReturnType<typeof setTimeout> | undefined;
let screen: 'home' | 'game' | 'results' = 'home';

function angle(units: number): string {
  if (units === 0) return '<span class="integer">0</span>';
  const { numerator: n, denominator: d } = fraction(units);
  const top = `${Math.abs(n) === 1 ? '' : Math.abs(n)}π`;
  return `<span class="math" aria-label="${angleText(units)}">${n < 0 ? '<span class="minus">−</span>' : ''}${d === 1 ? top : `<span class="fraction"><span>${top}</span><span>${d}</span></span>`}</span>`;
}
function coords(point: number, radius = 150): { x: number; y: number } {
  return { x: 200 + radius * Math.cos(point * Math.PI / 12), y: 200 - radius * Math.sin(point * Math.PI / 12) };
}
function circle(interactive = false, labels = false): string {
  const lines = `<path class="guides diagonal" d="M56 344L344 56M56 56L344 344"/><path class="guides" d="M27 125H373M27 275H373M125 27V373M275 27V373"/>`;
  return `<div class="circle-board ${interactive ? 'interactive' : ''} ${labels ? 'labelled' : ''}">
    <svg viewBox="0 0 400 400" aria-label="Cercle trigonométrique de rayon 1 dans un repère orthonormé" role="img">
      <defs><marker id="arrow-${interactive}-${labels}" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="currentColor" stroke-width="1.1"/></marker></defs>
      <circle class="circle-fill" cx="200" cy="200" r="150"/>${lines}
      <path class="axes" d="M19 200H383M200 381V18" marker-end="url(#arrow-${interactive}-${labels})"/>
      <path class="axes" d="M19 200H383" marker-end="url(#arrow-${interactive}-${labels})"/>
      <circle class="unit-circle" cx="200" cy="200" r="150"/>
      <circle cx="200" cy="200" r="3" class="origin"/>
      <g class="axis-labels"><text x="190" y="218">O</text><text x="369" y="222">x</text><text x="214" y="25">y</text><text x="352" y="222">1</text><text x="32" y="222">−1</text><text x="213" y="47">1</text><text x="210" y="359">−1</text></g>
      <path class="answer-ray" d=""/>
    </svg>
    <div class="points">${POINTS.map(p => { const c = coords(p); return `<button type="button" class="point" data-point="${p}" style="left:${c.x / 4}%;top:${c.y / 4}%" ${interactive ? '' : 'disabled'} aria-label="Point ${POINTS.indexOf(p) + 1}, ${p === 0 ? 'sur l’axe horizontal positif' : `à ${p * 15} degrés dans le sens inverse des aiguilles d’une montre`}"><span class="dot"></span><span class="point-mark"></span></button>`; }).join('')}</div>
    ${labels ? `<div class="angle-labels">${POINTS.map(p => { const c = coords(p, 185); return `<span style="left:${c.x / 4}%;top:${c.y / 4}%">${angle(p > 12 ? p - 24 : p)}</span>`; }).join('')}</div>` : ''}
  </div>`;
}
function header(): string {
  return `<header class="header"><button class="brand" aria-label="Trigo Master, accueil"><img src="./favicon.svg" alt=""/><span>trigo<span class="brand-light">master</span><span class="brand-dot">.</span></span></button><button class="help-button" aria-label="Afficher l’aide">?</button></header>`;
}
function bindHeader(): void {
  document.querySelector('.brand')!.addEventListener('click', () => {
    if (screen === 'game') showLeave(); else home();
  });
  document.querySelector('.help-button')!.addEventListener('click', showHelp);
}
function clearTimers(): void { clearTimeout(feedbackTimer); clearTimeout(pulseTimer); }
function home(): void {
  clearTimers(); screen = 'home'; session = null;
  app.innerHTML = `${header()}<main class="home">
    <section class="intro"><div class="eyebrow"><span></span> LE CERCLE, EN UN CLIC</div><h1>Un angle.<br/>Un point.<br/><em>À toi de jouer.</em></h1><p>Repère l’angle sur le cercle.<br/>Touche le bon point et enchaîne.</p>
      <div class="setup"><div class="setup-heading"><label for="count">Ta série</label><output id="count-value" for="count">${total} questions</output></div><input id="count" type="range" min="5" max="40" value="${total}" step="1"/><div class="range-labels"><span>5 · express</span><span>40 · grand tour</span></div><div class="quick-counts">${[5, 10, 20].map(n => `<button data-count="${n}" class="${n === total ? 'selected' : ''}">${n}</button>`).join('')}<span>questions</span></div><button class="primary start">C’est parti <span aria-hidden="true">↗</span></button></div>
      <p class="micro">Sans chrono. Juste le plaisir de progresser.</p>
    </section><section class="home-visual" aria-label="Les seize points du cercle"><span class="visual-caption">16 POINTS. À TOI DE LES RETROUVER.</span>${circle()}<div class="sample-angle"><span>par exemple</span>${angle(8)}<span class="sample-arrow" aria-hidden="true">↖</span></div><div class="visual-foot"><span class="legend-dot"></span>Multiples de π/4 et de π/6</div></section>
    <footer class="home-footer"><span><b>01</b> Touche un point</span><span><b>02</b> Vois la réponse</span><span><b>03</b> Va un peu plus loin</span></footer>
  </main>`;
  bindHeader();
  const input = document.querySelector<HTMLInputElement>('#count')!;
  const updateCount = (n: number) => { total = n; input.value = String(n); document.querySelector('#count-value')!.textContent = `${n} questions`; document.querySelectorAll<HTMLButtonElement>('[data-count]').forEach(b => b.classList.toggle('selected', Number(b.dataset.count) === n)); };
  input.addEventListener('input', () => updateCount(Number(input.value)));
  document.querySelectorAll<HTMLButtonElement>('[data-count]').forEach(b => b.addEventListener('click', () => updateCount(Number(b.dataset.count))));
  document.querySelector('.start')!.addEventListener('click', start);
  document.querySelector('.home-visual [data-point="8"]')!.classList.add('sample-point');
}
function start(): void {
  clearTimers(); screen = 'game'; locked = false; session = new Session(total);
  app.innerHTML = `${header()}<main class="game"><section class="hud" aria-label="Progression"><div><span class="stat-label">QUESTION</span><strong id="progress-count"></strong></div><div class="level-stat"><span class="stat-label">EXPLORATION</span><strong id="level"></strong></div><div class="score-stat"><span class="stat-label">RÉUSSITES</span><strong id="score"></strong></div><div class="progress-track"><div id="progress-fill"></div></div></section>
    <section class="play-area">${circle(true)}<div class="feedback" aria-live="polite" aria-atomic="true"></div></section>
    <section class="question-panel"><div class="question-overline">PLACE CET ANGLE</div><div id="question-angle" aria-live="polite" aria-atomic="true"></div><div class="question-hint">Touche le point sur le cercle</div><div class="level-note" id="level-note"></div></section>
    <footer class="game-footer"><span>16 points · un seul bon choix</span><button class="quiet quit">Quitter la série</button></footer>
  </main>`;
  bindHeader();
  document.querySelectorAll<HTMLButtonElement>('.point').forEach(b => b.addEventListener('click', () => answer(Number(b.dataset.point))));
  document.querySelector('.quit')!.addEventListener('click', showLeave);
  updateQuestion();
}
function updateQuestion(): void {
  if (!session) return;
  const s = session;
  document.querySelector('#progress-count')!.innerHTML = `${s.answers.length + 1}<small> / ${s.total}</small>`;
  document.querySelector('#level')!.textContent = `Palier ${s.question.level}`;
  document.querySelector('#score')!.innerHTML = `${s.correct}<small> ${s.correct > 1 ? 'justes' : 'juste'}</small>`;
  document.querySelector<HTMLElement>('#progress-fill')!.style.width = `${100 * s.answers.length / s.total}%`;
  document.querySelector('#question-angle')!.innerHTML = angle(s.question.units);
  document.querySelector('#level-note')!.textContent = s.question.units % 12 === 0 && Math.abs(s.question.units) > 12 ? 'Grand multiple : pense à la parité' : s.question.level === 1 ? 'Fractions entre −π et π' : `Fractions : de ${s.question.level - 1 === 1 ? '' : s.question.level - 1}π à ${s.question.level}π en valeur absolue`;
  document.querySelector('.question-panel')!.setAttribute('aria-label', `Place l’angle ${angleText(s.question.units)}`);
  questionStarted = performance.now();
}
function resetPoints(): void {
  document.querySelectorAll('.point').forEach(b => b.classList.remove('correct', 'wrong'));
  document.querySelector('.answer-ray')!.setAttribute('d', '');
}
function answer(point: number): void {
  if (!session || locked || session.done || screen !== 'game' || document.querySelector('dialog[open]')) return;
  clearTimeout(pulseTimer); resetPoints();
  const s = session;
  const result = s.answer(point, performance.now() - questionStarted);
  const feedback = document.querySelector<HTMLElement>('.feedback')!;
  clearTimeout(feedbackTimer);
  if (result.correct) {
    document.querySelector(`[data-point="${point}"]`)!.classList.add('correct');
    feedback.className = 'feedback success visible'; feedback.textContent = '✓ Bien vu !';
    if (s.done) { results(); return; }
    s.advance(); updateQuestion();
    pulseTimer = setTimeout(resetPoints, 180);
    feedbackTimer = setTimeout(() => feedback.classList.remove('visible'), 650);
  } else {
    locked = true;
    const target = normalize(result.units);
    document.querySelector(`[data-point="${point}"]`)!.classList.add('wrong');
    document.querySelector(`[data-point="${target}"]`)!.classList.add('correct');
    const c = coords(target);
    document.querySelector('.answer-ray')!.setAttribute('d', `M200 200L${c.x} ${c.y}`);
    feedback.className = 'feedback error visible'; feedback.innerHTML = `Le bon point est ici <span aria-hidden="true">↗</span>`;
    document.querySelector('.question-panel')!.classList.add('is-error');
    feedbackTimer = setTimeout(() => {
      locked = false;
      if (s.done) { results(); return; }
      resetPoints(); feedback.classList.remove('visible');
      document.querySelector('.question-panel')!.classList.remove('is-error');
      s.advance(); updateQuestion();
    }, ERROR_DELAY);
  }
}
function reviewItem(a: Answer): string {
  const c = coords(normalize(a.units), 26);
  const x = 36 + (c.x - 200), y = 36 + (c.y - 200);
  const reduced = normalize(a.units) > 12 ? normalize(a.units) - 24 : normalize(a.units);
  return `<div class="review-item"><svg viewBox="0 0 72 72" aria-label="Position correcte"><path d="M3 36H69M36 3V69" stroke="#ccd6d0"/><circle cx="36" cy="36" r="26" fill="none" stroke="#6c8982"/><path d="M36 36L${x} ${y}" stroke="#207764"/><circle cx="${x}" cy="${y}" r="5" fill="#207764"/></svg><div>${angle(a.units)}${reduced !== a.units ? `<span class="equivalent">même point que ${angle(reduced)}</span>` : '<span class="equivalent">À retrouver la prochaine fois</span>'}</div></div>`;
}
function results(): void {
  clearTimers(); screen = 'results'; locked = false;
  const s = session!;
  const errors = s.answers.filter(a => !a.correct);
  const precision = Math.round(100 * s.correct / s.total);
  const average = (s.answers.reduce((sum, a) => sum + a.elapsed, 0) / s.total / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  app.innerHTML = `${header()}<main class="results"><div class="eyebrow"><span></span> SÉRIE TERMINÉE</div><h1>${precision === 100 ? 'Un sans-faute.' : precision >= 70 ? 'Bien joué.' : 'Le cercle s’apprivoise.'}</h1><p>${precision === 100 ? 'Les seize points n’ont qu’à bien se tenir.' : 'Chaque tour te rapproche de la maîtrise.'}</p><div class="result-score">${s.correct}<span>/${s.total}</span></div><span class="result-caption">bonnes réponses</span><div class="result-stats"><div><strong>${precision} %</strong><span>de réussite</span></div><div><strong>${average} s</strong><span>par réponse</span></div><div><strong>${s.question.level}</strong><span>palier atteint</span></div></div><div class="result-actions"><button class="primary replay">Rejouer <span aria-hidden="true">↗</span></button><button class="secondary configure">Changer la série</button></div>${errors.length ? `<section class="review"><h2>Un petit tour de révision</h2><p>Voici les points à retenir de cette série.</p><div class="review-grid">${errors.map(reviewItem).join('')}</div></section>` : '<div class="perfect-mark" aria-hidden="true">✦</div>'}</main>`;
  bindHeader(); document.querySelector('.replay')!.addEventListener('click', start); document.querySelector('.configure')!.addEventListener('click', home);
}
function openDialog(content: string, className = ''): HTMLDialogElement {
  const dialog = document.createElement('dialog'); dialog.className = className;
  dialog.innerHTML = content; app.append(dialog);
  const previouslyFocused = document.activeElement as HTMLElement;
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { dialog.remove(); questionStarted = performance.now(); previouslyFocused?.focus(); });
  dialog.showModal(); return dialog;
}
function showHelp(): void {
  const dialog = openDialog(`<button class="close-dialog" aria-label="Fermer l’aide">×</button><div class="eyebrow">LES REPÈRES</div><h2>Un tour vaut 2π.</h2><p>Les angles positifs tournent dans le sens inverse des aiguilles d’une montre. Les angles négatifs tournent dans l’autre sens.</p>${circle(false, true)}<div class="help-rules"><p><b>✓ Bonne réponse</b> · Le nombre suivant arrive immédiatement.</p><p><b>× Erreur</b> · Le bon point apparaît en vert pendant une demi-seconde.</p><p><b>Un peu plus loin</b> · Toutes les 3 bonnes réponses, les fractions gagnent un demi-tour. Elles sont toujours irréductibles.</p><p><b>32π, −75π…</b> · Les grands multiples entiers arrivent dès le début : pair, à droite ; impair, à gauche.</p></div><button class="primary understood">Compris <span>↗</span></button>`, 'help-dialog');
  dialog.querySelector('.close-dialog')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('.understood')!.addEventListener('click', () => dialog.close());
}
function showLeave(): void {
  const dialog = openDialog('<h2>Quitter cette série ?</h2><p>La série en cours sera terminée.</p><div class="leave-actions"><button class="primary resume">Continuer</button><button class="secondary leave">Quitter</button></div>');
  dialog.querySelector('.resume')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('.leave')!.addEventListener('click', home);
}
home();
