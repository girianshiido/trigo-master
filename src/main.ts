import './style.css';
import { sounds } from './sound';
import { angle, valueHtml, trigFormula, trigEquation } from './math';
import { angleText, ERROR_DELAY, normalize, POINTS, type Answer } from './engine';
import { STAGES, ACHIEVEMENTS, createProfile, grade, seenPoints, seenGuides, startAttempt, startTrig, submit, submitTrig, coordinate, trigTargets, interrupt, average, type Profile, type Guides } from './progression';
import * as storage from './storage';
import { initPwa, install, installLabel, preventZoom, isStandalone } from './pwa';

const app = document.querySelector<HTMLDivElement>('#app')!;
let profile: Profile | null = null;
let screen = 'home';
let locked = false;
let clock: number | null = null;
let paused = false;
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
let pulseTimer: ReturnType<typeof setTimeout> | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let profiles: Profile[] = [];
const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const number = (n: number) => n.toLocaleString('fr-FR');
const seconds = (ms: number) => (ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const run = (fn: () => void | Promise<void>) => () => { try { void Promise.resolve(fn()).catch(showError); } catch (error) { showError(error); } };
function coords(point: number, radius = 150): { x: number; y: number } {
  return { x: 200 + radius * Math.cos(point * Math.PI / 12), y: 200 - radius * Math.sin(point * Math.PI / 12) };
}
let boardSerial = 0;
function circle(points: readonly number[], enabled: readonly number[], guide: Guides, labels = false): string {
  const interactive = enabled.length > 0;
  const uid = `circle-${++boardSerial}`;
  const lines = `${guide.diagonal ? '<path class="guides diagonal" data-guide="diagonal" d="M56 344L344 56M56 56L344 344"/>' : ''}${guide.vertical ? '<path class="guides" data-guide="vertical" d="M125 27V373M275 27V373"/>' : ''}${guide.horizontal ? '<path class="guides" data-guide="horizontal" d="M27 125H373M27 275H373"/>' : ''}`;
  return `<div class="circle-board ${interactive ? 'interactive' : ''} ${labels ? 'labelled' : ''}">
    <svg viewBox="0 0 400 400" aria-label="Cercle trigonométrique de rayon 1 dans un repère orthonormé" role="img">
      <defs><radialGradient id="disc-${uid}"><stop offset="0%" stop-color="#143545"/><stop offset="100%" stop-color="#0e202f"/></radialGradient><marker id="arrow-${uid}" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="currentColor" stroke-width="1.1"/></marker></defs>
      ${labels ? '' : `<circle class="orbit-ring" cx="200" cy="200" r="174"/><path class="orbit-accent" d="M200 26A174 174 0 0 1 323 77"/><g class="orbit-ticks">${Array.from({ length: 48 }, (_, i) => { const a = coords(i / 2, 169), b = coords(i / 2, i % 4 === 0 ? 174 : 171); return `<path d="M${a.x} ${a.y}L${b.x} ${b.y}"/>`; }).join('')}</g>`}
      <circle cx="200" cy="200" r="150" fill="url(#disc-${uid})"/>
      <circle class="circle-fill" cx="200" cy="200" r="150"/>${lines}
      <path class="axes" d="M200 381V18" marker-end="url(#arrow-${uid})"/>
      <path class="axes" d="M19 200H383" marker-end="url(#arrow-${uid})"/>
      <circle class="unit-circle" cx="200" cy="200" r="150"/>
      <circle cx="200" cy="200" r="3" class="origin"/>
      <g class="axis-labels"><text x="190" y="218">O</text><text x="369" y="222">x</text><text x="214" y="25">y</text><text x="352" y="222">1</text><text x="32" y="222">−1</text><text x="213" y="47">1</text><text x="210" y="359">−1</text></g>
      <path class="answer-ray" d=""/>
    </svg>
    <div class="points">${points.map(p => { const c = coords(p); return `<button type="button" class="point" data-point="${p}" style="left:${c.x / 4}%;top:${c.y / 4}%" ${enabled.includes(p) ? '' : 'disabled'} aria-label="Point ${points.indexOf(p) + 1}, ${p === 0 ? 'sur l’axe horizontal positif' : `à ${p * 15} degrés dans le sens inverse des aiguilles d’une montre`}"><span class="dot"></span><span class="point-mark"></span></button>`; }).join('')}</div>
    ${labels ? `<div class="angle-labels">${points.map(p => { const c = coords(p, 185); return `<span style="left:${c.x / 4}%;top:${c.y / 4}%">${angle(p > 12 ? p - 24 : p)}</span>`; }).join('')}</div>` : ''}
  </div>`;
}
let heldId: string | null = null;
let releaseLock: (() => void) | undefined;
function releaseProfile(): void { releaseLock?.(); releaseLock = undefined; heldId = null; }
async function acquireProfile(id: string): Promise<void> {
  if (heldId === id) return;
  releaseProfile();
  if (!navigator.locks) { heldId = id; return; }
  await new Promise<void>((resolve, reject) => {
    void navigator.locks.request(`trigo-master-save-${id}`, { ifAvailable: true }, async lock => {
      if (!lock) { reject(new Error('Cette aventure est déjà ouverte dans un autre onglet. Reviens à l’accueil dans cet onglet avant de la charger ici.')); return; }
      heldId = id; resolve(); await new Promise<void>(done => { releaseLock = done; });
    }).catch(reject);
  });
}
function soundIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5Z"/>${sounds.enabled ? '<path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>' : '<path d="M16 9l5 6M21 9l-5 6"/>'}</svg>`;
}
function header(): string {
  return `<header class="header"><button class="brand" aria-label="Trigo Master, accueil"><img src="./favicon.svg" alt=""/><span>trigo<span class="brand-light">master</span><span class="brand-dot">.</span></span></button><div class="header-actions"><span class="mode-label">${profile ? esc(grade(profile)) : 'LE CERCLE EN JEU'}</span><button class="sound-button" aria-label="${sounds.enabled ? 'Couper' : 'Activer'} le son" aria-pressed="${sounds.enabled}">${soundIcon()}</button><button class="help-button" aria-label="Afficher l’aide">?</button></div></header>`;
}
function bindHeader(): void {
  document.querySelector('.brand')!.addEventListener('click', run(() => screen === 'game' ? leaveGame() : home()));
  document.querySelector('.help-button')!.addEventListener('click', showHelp);
  document.querySelector('.sound-button')!.addEventListener('click', () => {
    sounds.toggle();
    const b = document.querySelector('.sound-button')!; b.innerHTML = soundIcon();
    b.setAttribute('aria-pressed', String(sounds.enabled)); b.setAttribute('aria-label', `${sounds.enabled ? 'Couper' : 'Activer'} le son`);
  });
}
function clearTimers(): void { clearTimeout(feedbackTimer); clearTimeout(pulseTimer); clock = null; locked = false; }
function status(text: string): void { document.querySelectorAll('.save-status').forEach(e => { e.textContent = text; }); }
async function persist(): Promise<void> {
  if (!profile) return;
  const id = profile.id; status('Enregistrement…');
  try { await storage.save(profile); if (profile?.id === id) status('Sauvegardé'); }
  catch (error) { status('Non enregistré · exporter'); throw error; }
}
function backgroundSave(): void { void persist().catch(() => saveWarning()); }
function saveWarning(): void {
  if (document.querySelector('.save-warning')) return;
  const banner = document.createElement('div'); banner.className = 'save-warning';
  banner.innerHTML = 'Enregistrement indisponible. Exporte une copie pour conserver ta progression. <button>Exporter</button>';
  banner.querySelector('button')!.addEventListener('click', run(exportCurrent)); app.prepend(banner);
}
function checkpoint(): void {
  if (profile?.active && !profile.active.done && screen === 'game' && clock !== null && !locked) {
    const now = performance.now(); profile.active.elapsed += now - clock; clock = now;
  }
}
function pause(): void {
  if (screen !== 'game' || !profile?.active || profile.active.done) return;
  const elapsed = clock === null ? 0 : performance.now() - clock;
  interrupt(profile, elapsed); clock = null; paused = true; backgroundSave();
}
function resume(): void {
  if (screen !== 'game' || !profile?.active || profile.active.done || document.hidden) return;
  paused = false; document.querySelector('.resume-overlay')?.remove();
  if (!locked) clock = performance.now();
}
async function home(): Promise<void> {
  if (screen === 'game') { pause(); await persist(); }
  clearTimers(); releaseProfile(); screen = 'home'; profile = null;
  let damaged = 0;
  try { const loaded = await storage.list(); profiles = loaded.profiles; damaged = loaded.damaged.length; }
  catch { profiles = []; }
  app.innerHTML = `${header()}<main class="home title-screen"><section class="intro"><div class="eyebrow"><span></span> DU PREMIER ANGLE AU GRAND MAÎTRE</div><h1 class="title-wordmark"><img class="title-logo" src="./logo.svg" alt="Trigo Master"/></h1><p>Explore le cercle. Trouve ton rythme.<br/> Construis ta maîtrise, un point après l’autre.</p></section><section class="home-visual" aria-label="Ton premier cercle"><span class="visual-caption">TOUT COMMENCE PAR DEUX POINTS</span>${circle(STAGES[0].points, [], STAGES[0].guides)}<div class="sample-angle"><span>À TOI DE PLACER</span>${angle(384)}<span class="sample-arrow">↗</span></div><div class="visual-foot"><span class="legend-dot"></span>Angles · cosinus · sinus</div></section><section class="launch-card"><div class="launch-title">Ton aventure commence ici.</div><button class="primary new-game">Nouvelle partie <span>↗</span></button><button class="secondary load-game">Charger une partie <span>${profiles.length + damaged}</span></button>${profiles[0] ? `<button class="recent-game" data-id="${esc(profiles[0].id)}"><span>REPRENDRE</span><b>${esc(profiles[0].name)}</b><small>${esc(grade(profiles[0]))} · ${number(profiles[0].stats.correct)} réussites</small></button>` : ''}<div class="home-tools"><button class="quiet install-button">${installLabel()}</button><button class="quiet import-button">Importer une sauvegarde</button></div><p class="micro">Sauvegardes sur cet appareil · jeu hors connexion</p></section><footer class="home-footer"><span><b>01</b> Apprends les repères</span><span><b>02</b> Débloque les succès</span><span><b>03</b> Deviens Grand Maître</span></footer></main>`;
  bindHeader();
  document.querySelector('.new-game')!.addEventListener('click', newGame);
  document.querySelector('.load-game')!.addEventListener('click', run(showSaves));
  document.querySelector('.recent-game')?.addEventListener('click', run(() => loadProfile(profiles[0])));
  document.querySelector('.install-button')!.addEventListener('click', run(showInstall));
  document.querySelector('.import-button')!.addEventListener('click', importFile);
}
function newGame(): void {
  const dialog = openDialog(`<div class="eyebrow">NOUVELLE PARTIE</div><h2>Un nom pour ton aventure.</h2><form class="name-form"><label for="save-name">Nom de la sauvegarde</label><input id="save-name" name="name" maxlength="40" value="Aventure ${profiles.length + 1}" required autocomplete="off"/><p>Tu commenceras au grade Débutant. Chaque réponse sera enregistrée automatiquement.</p><div class="dialog-actions"><button class="secondary" type="button" data-close>Annuler</button><button class="primary" type="submit">Commencer <span>↗</span></button></div></form>`);
  dialog.querySelector('form')!.addEventListener('submit', event => {
    event.preventDefault(); sounds.activate(); const button = dialog.querySelector<HTMLButtonElement>('[type="submit"]')!; button.disabled = true;
    void (async () => { profile = createProfile(dialog.querySelector<HTMLInputElement>('input')!.value); await acquireProfile(profile.id); startAttempt(profile); await persist(); dialog.close(); sounds.play('start'); renderGame(); })().catch(error => { button.disabled = false; showError(error); });
  });
  dialog.querySelector<HTMLInputElement>('input')!.select();
}
async function showSaves(): Promise<void> {
  clearTimers(); screen = 'saves';
  const loaded = await storage.list(); profiles = loaded.profiles;
  app.innerHTML = `${header()}<main class="menu-page"><div class="eyebrow">TES AVENTURES</div><div class="page-heading"><div><h1>Charger une partie</h1><p>${profiles.length ? 'Chaque aventure garde ses grades, ses succès et son aide.' : 'Crée ta première aventure pour découvrir le cercle.'}</p></div><button class="secondary new-game">+ Nouvelle partie</button></div><div class="save-grid">${profiles.map(p => `<article class="save-card"><div class="save-card-top"><span class="grade-chip">${esc(grade(p))}</span><span class="save-date">${new Date(p.updatedAt).toLocaleDateString('fr-FR')}</span></div><h2>${esc(p.name)}</h2><p>${STAGES[p.stage].title}</p><div class="save-metrics"><span>${number(p.stats.correct)} réussites</span><span>${Object.keys(p.achievements).length}/${ACHIEVEMENTS.length} succès</span></div><button class="primary load-slot" data-id="${p.id}">Reprendre <span>↗</span></button><div class="slot-actions"><button class="quiet export-slot" data-id="${p.id}">Exporter</button><button class="quiet rename-slot" data-id="${p.id}">Renommer</button><button class="quiet delete-slot" data-id="${p.id}">Supprimer</button></div></article>`).join('')}${loaded.damaged.map(id => `<article class="save-card damaged"><h2>Sauvegarde illisible</h2><p>Le contrôle d’intégrité a échoué. Le contenu n’a pas été chargé.</p><button class="secondary delete-slot" data-id="${esc(id)}">Supprimer</button></article>`).join('')}</div><div class="menu-actions"><button class="secondary back-home">Accueil</button><button class="secondary import-button">Importer un fichier</button></div><p class="storage-note">Pas de limite de nombre imposée. L’espace disponible dépend de l’appareil. Exporte tes parties pour en garder une copie ou les transférer.</p></main>`;
  bindHeader(); document.querySelector('.new-game')!.addEventListener('click', newGame);
  document.querySelector('.back-home')!.addEventListener('click', run(home)); document.querySelector('.import-button')!.addEventListener('click', importFile);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-id]')) button.addEventListener('click', run(async () => {
    const id = button.dataset.id!, p = profiles.find(p => p.id === id);
    if (button.classList.contains('load-slot') && p) await loadProfile(p);
    else if (button.classList.contains('export-slot') && p) await exportProfile(p);
    else if (button.classList.contains('rename-slot') && p) rename(p);
    else if (button.classList.contains('delete-slot')) confirmDelete(id, p?.name ?? 'cette sauvegarde illisible');
  }));
}
async function loadProfile(p: Profile): Promise<void> { await acquireProfile(p.id); const fresh = (await storage.list()).profiles.find(x => x.id === p.id); if (!fresh) { releaseProfile(); throw new Error('Cette sauvegarde n’est plus disponible.'); } profile = structuredClone(fresh); dashboard(); }
function dashboard(): void {
  if (!profile) return;
  clearTimers(); screen = 'dashboard'; const p = profile;
  const completed = p.active?.done, count = p.active && !completed ? p.active.answers.length : 0;
  app.innerHTML = `${header()}<main class="menu-page dashboard"><div class="eyebrow"><span></span> TON AVENTURE</div><div class="page-heading"><div><h1>${esc(p.name)}</h1><p><span class="grade-chip">${esc(grade(p))}</span><span class="save-status">Sauvegardé</span></p></div><button class="secondary back-home">Changer de partie</button></div><div class="dashboard-grid"><section class="journey-card"><span class="stat-label">PROCHAIN OBJECTIF</span><h2>${p.grandMaster ? 'Le cercle t’appartient.' : STAGES[p.stage].title}</h2><p>${p.grandMaster ? 'Rejoue les épreuves et poursuis ta collection de succès.' : `${STAGES[p.stage].family} · ${STAGES[p.stage].total} réponses sans faute${p.stage === 8 ? ' · moyenne ≤ 5 s' : ''}`}</p><button class="primary continue-game">${p.active && !completed ? `Reprendre ${p.active.kind === 'angles' ? 'les angles' : 'cosinus & sinus'} · ${count}/${p.active.total}` : 'Continuer les angles'} <span>↗</span></button><div class="journey-stats"><span><b>${number(p.stats.streak)}</b> d’affilée</span><span><b>${number(p.stats.correct)}</b> réussites</span><span><b>${Object.keys(p.achievements).length}</b> succès</span></div>${p.stage === 8 ? `<div class="grand-requirements"><b>Pour devenir Grand Maître</b><span>${p.angleMastery ? '✓' : '○'} 40 angles sur π/12 · moyenne ≤ 5 s</span><span>${p.trigDirect ? '✓' : '○'} 20 cosinus/sinus sans faute</span><span>${p.trigInverse ? '✓' : '○'} 20 équations sans faute</span></div>` : ''}</section><section class="mode-card"><div class="eyebrow">SECOND PARCOURS</div><h2>Cosinus & sinus</h2><p>${p.stage >= 5 ? 'Lis les coordonnées, puis retrouve tous les points d’une équation.' : 'Découvre les seize points pour débloquer ce parcours.'}</p><button class="secondary trig-menu" ${p.stage < 5 ? 'disabled' : ''}>${p.stage < 5 ? 'Verrouillé · les seize points' : 'Explorer les coordonnées →'}</button><div class="mode-status">${p.trigDirect ? '✓ Lecture validée' : ''} ${p.trigInverse ? ' · ✓ Équations validées' : ''}</div></section></div><div class="dashboard-actions">${p.active && !p.active.done && (p.active.mode === 'practice' || p.active.kind !== 'angles') ? '<button class="secondary main-journey">Reprendre le parcours d’angles</button>' : ''}<button class="secondary training">Entraînement</button><button class="secondary successes">Succès <span>${Object.keys(p.achievements).length}/${ACHIEVEMENTS.length}</span></button><button class="secondary export-current">Exporter ma partie</button></div><section class="roadmap"><h2>Ton chemin</h2>${STAGES.map((s, i) => `<div class="roadmap-step ${i === p.stage ? 'current' : ''} ${i > p.stage ? 'future' : ''}"><span>${i < p.stage ? '✓' : i === p.stage ? '◇' : '·'}</span><b>${s.title}</b><small>${i < 6 ? ['Débutant','Apprenti','Initié','Pratiquant','Confirmé','Expert'][i] : i === 7 ? 'Vers Maître' : i === 8 ? 'Vers Grand Maître' : 'Expert'}</small></div>`).join('')}</section></main>`;
  bindHeader(); document.querySelector('.back-home')!.addEventListener('click', run(home));
  document.querySelector('.continue-game')!.addEventListener('click', () => {
    if (!p.active || p.active.done) startAttempt(p);
    sounds.play('start'); renderGame(); backgroundSave();
  });
  document.querySelector('.main-journey')?.addEventListener('click', () => abandonThen(() => { startAttempt(p); sounds.play('start'); renderGame(); backgroundSave(); }));
  document.querySelector('.training')!.addEventListener('click', training);
  document.querySelector('.successes')!.addEventListener('click', showAchievements);
  document.querySelector('.trig-menu')!.addEventListener('click', trigMenu);
  document.querySelector('.export-current')!.addEventListener('click', run(exportCurrent));
}
function abandonThen(action: () => void): void {
  if (!profile?.active || profile.active.done || !profile.active.answers.length) { action(); return; }
  const d = openDialog('<h2>Changer d’épreuve ?</h2><p>Ton grade, tes succès et ta série de bonnes réponses seront conservés. La série en cours sera remplacée.</p><div class="dialog-actions"><button class="secondary" data-close>Annuler</button><button class="primary replace-attempt">Changer</button></div>');
  d.querySelector('.replace-attempt')!.addEventListener('click', () => { d.close(); action(); });
}
function training(): void {
  if (!profile) return;
  const d = openDialog(`<div class="eyebrow">ENTRAÎNEMENT</div><h2>Reviens à tes repères.</h2><form class="training-form"><label for="practice-stage">Famille d’angles</label><select id="practice-stage">${STAGES.slice(0, profile.stage + 1).map((s, i) => `<option value="${i}">${s.family}</option>`).join('')}</select><label for="practice-count">Nombre de questions</label><select id="practice-count">${[10,20,40,100].map(n => `<option value="${n}">${n}</option>`).join('')}</select><p>Les succès et séries consécutives comptent ici aussi. Le grade acquis est conservé.</p><div class="dialog-actions"><button type="button" class="secondary" data-close>Retour</button><button class="primary" type="submit">Jouer <span>↗</span></button></div></form>`);
  d.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); const stage = Number(d.querySelector<HTMLSelectElement>('#practice-stage')!.value), count = Number(d.querySelector<HTMLSelectElement>('#practice-count')!.value); d.close(); abandonThen(() => { startAttempt(profile!, stage, 'practice', count); sounds.play('start'); renderGame(); backgroundSave(); }); });
}
function trigMenu(): void {
  if (!profile || profile.stage < 5) return;
  const d = openDialog(`<div class="eyebrow">COSINUS & SINUS</div><h2>Deux façons de lire le cercle.</h2><p>Chaque épreuve demande 20 réponses sans faute, en alternant cosinus et sinus.</p><div class="trig-options"><button class="secondary start-direct"><b>Lire les coordonnées</b><span>Un angle, quatre valeurs possibles.</span><small>${profile.trigDirect ? '✓ Épreuve validée · rejouer' : 'Première épreuve'}</small></button><button class="secondary start-inverse" ${profile.trigDirect ? '' : 'disabled'}><b>Retrouver les points</b><span>Une valeur, tous les points correspondants.</span><small>${profile.trigInverse ? '✓ Épreuve validée · rejouer' : profile.trigDirect ? 'Deuxième épreuve' : 'Valide d’abord la lecture'}</small></button></div><button class="secondary" data-close>Retour</button>`);
  for (const [selector, kind] of [['.start-direct','trig-direct'],['.start-inverse','trig-inverse']] as const) d.querySelector(selector)!.addEventListener('click', () => { d.close(); abandonThen(() => { startTrig(profile!, kind); sounds.play('start'); renderGame(); backgroundSave(); }); });
}
function renderGame(): void {
  if (!profile?.active) return;
  clearTimers(); screen = 'game'; paused = false;
  const a = profile.active;
  if (a.done) { results(); return; }
  const stage = STAGES[a.stage], direct = a.kind === 'trig-direct';
  app.innerHTML = `${header()}<main class="game ${direct ? 'direct-game' : ''}"><section class="hud" aria-label="Progression"><div><span class="stat-label">QUESTION</span><strong id="progress-count"></strong></div><div class="level-stat"><span class="stat-label">${a.kind === 'angles' ? 'GRADE' : 'COORDONNÉES'}</span><strong id="level"></strong></div><div class="score-stat"><span class="stat-label">D’AFFILÉE</span><strong id="score"></strong></div><div class="progress-track"><div id="progress-fill"></div></div></section><section class="play-area">${circle(seenPoints(profile), direct ? [] : stage.points, stage.guides)}<div class="feedback" aria-live="polite" aria-atomic="true"></div></section><section class="question-panel"><div class="question-overline"></div><div id="question-angle" aria-live="polite" aria-atomic="true"></div>${direct ? '<div class="answers-grid"></div>' : '<div class="question-hint"></div>'}<div class="level-note" id="level-note"></div></section><footer class="game-footer"><span class="save-status">Sauvegardé</span><button class="quiet quit">Sauvegarder et quitter</button></footer></main>`;
  bindHeader(); document.querySelector('.quit')!.addEventListener('click', run(leaveGame));
  document.querySelectorAll<HTMLButtonElement>('.point:not(:disabled)').forEach(b => b.addEventListener('click', () => answer(Number(b.dataset.point))));
  updateQuestion();
}
function updateQuestion(): void {
  if (!profile?.active || screen !== 'game') return;
  const a = profile.active;
  document.querySelector('#progress-count')!.innerHTML = `${a.answers.length + 1}<small> / ${a.total}</small>`;
  document.querySelector('#level')!.textContent = a.kind === 'angles' ? grade(profile) : a.kind === 'trig-direct' ? 'Lecture' : 'Équations';
  document.querySelector('#score')!.textContent = number(profile.stats.streak);
  document.querySelector<HTMLElement>('#progress-fill')!.style.width = `${100 * a.answers.length / a.total}%`;
  document.querySelector('.question-overline')!.textContent = a.kind === 'angles' ? 'PLACE CET ANGLE' : a.kind === 'trig-direct' ? 'CHOISIS LA BONNE VALEUR' : 'RETROUVE TOUS LES POINTS';
  const question = document.querySelector('#question-angle')!;
  if (a.kind === 'angles') { question.innerHTML = angle(a.question); document.querySelector('.question-hint')!.textContent = 'Touche le point sur le cercle'; }
  else if (a.kind === 'trig-direct') {
    question.innerHTML = trigFormula(a.fn,a.question);
    document.querySelector('.answers-grid')!.innerHTML = a.choices.map(n => `<button class="answer-choice" data-value="${n}">${valueHtml(n)}</button>`).join('');
    document.querySelectorAll<HTMLButtonElement>('.answer-choice').forEach(b => b.addEventListener('click', () => answer(Number(b.dataset.value))));
    document.querySelector(`[data-point="${normalize(a.question)}"]`)!.classList.add('given-point');
    if (a.answers.length < 10) {
      const c = coords(a.question), end = a.fn === 'cos' ? { x:c.x,y:200 } : { x:200,y:c.y };
      document.querySelector('.answer-ray')!.setAttribute('d', `M${c.x} ${c.y}L${end.x} ${end.y}`);
    }
  } else {
    question.innerHTML = trigEquation(a.fn,coordinate(a.question,a.fn));
    const targets = trigTargets(a);
    document.querySelector('.question-hint')!.textContent = `${a.selected.length}/${targets.length} point${targets.length > 1 ? 's' : ''} trouvé${targets.length > 1 ? 's' : ''}`;
    for (const point of a.selected) document.querySelector(`[data-point="${point}"]`)!.classList.add('chosen-point');
  }
  const errors = a.answers.some(x => !x.correct);
  document.querySelector('#level-note')!.textContent = errors ? 'La série parfaite est perdue · tu pourras retenter' : a.kind === 'angles' ? `${a.mode === 'practice' ? 'Entraînement' : STAGES[a.stage].title}${a.stage === 8 ? ' · moyenne ≤ 5 s' : ''}` : a.kind === 'trig-direct' ? `${a.fn === 'cos' ? 'Cosinus : abscisse' : 'Sinus : ordonnée'}${a.answers.length < 10 ? ' · projection guidée' : ''}` : 'Une ou deux solutions · validation automatique';
  document.querySelector('.question-panel')!.setAttribute('aria-label', a.kind === 'angles' ? `Place l’angle ${angleText(a.question)}` : `${a.fn} ${a.kind === 'trig-direct' ? `de ${angleText(a.question)}` : `égal à ${coordinate(a.question, a.fn)}`}`);
  if (!paused && !document.hidden) clock = performance.now();
}
function resetPoints(): void {
  document.querySelectorAll('.point').forEach(b => b.classList.remove('correct','wrong','chosen-point','given-point'));
  document.querySelector('.answer-ray')?.setAttribute('d', '');
  document.querySelectorAll('.answer-choice').forEach(b => b.classList.remove('correct','wrong'));
}
function answer(input: number): void {
  if (!profile?.active || locked || paused || clock === null || document.hidden || document.querySelector('dialog[open]')) return;
  const a = profile.active, oldKind = a.kind;
  const targets = a.kind === 'trig-inverse' ? trigTargets(a) : [normalize(a.question)];
  const oldValue = a.kind === 'trig-direct' ? coordinate(a.question,a.fn) : null;
  const elapsed = performance.now() - clock;
  const result = a.kind === 'angles' ? submit(profile, input, elapsed) : submitTrig(profile, input, elapsed);
  if (!result) { document.querySelector(`[data-point="${input}"]`)?.classList.add('chosen-point'); document.querySelector('.question-hint')!.textContent = `${a.selected.length}/${targets.length} points trouvés`; backgroundSave(); return; }
  clearTimeout(feedbackTimer); clearTimeout(pulseTimer); clock = null; resetPoints();
  const feedback = document.querySelector<HTMLElement>('.feedback')!;
  const notify = () => { if (result.unlocked.length) { const achievement = ACHIEVEMENTS.find(x => x.id === result.unlocked[0])!; toast(`✦ ${achievement.title}${result.unlocked.length > 1 ? ` · +${result.unlocked.length - 1} succès` : ''}`, 'success'); } };
  const next = () => {
    locked = false;
    if (a.done) {
      if (a.mode === 'journey' && a.kind === 'angles' && a.passed && a.stage < 8) {
        const oldGrade = STAGES[a.stage].grade; startAttempt(profile!); renderGame(); sounds.play('finish');
        toast(`${STAGES[profile!.stage].grade > oldGrade ? `✦ ${grade(profile!)} !` : '✓ Palier validé'} · ${STAGES[profile!.stage].title}`, 'success');
      } else { results(); notify(); }
    } else { resetPoints(); feedback.classList.remove('visible'); document.querySelector('.question-panel')!.classList.remove('is-error'); updateQuestion(); notify(); }
    backgroundSave();
  };
  if (result.answer.correct) {
    if (a.done) { next(); return; }
    for (const point of targets) document.querySelector(`[data-point="${point}"]`)?.classList.add('correct');
    sounds.play(result.unlocked.length ? 'achievement' : (['correct-1','correct-2','correct-3'] as const)[(profile.stats.streak - 1) % 3]); feedback.className = 'feedback success visible'; feedback.textContent = '✓ Bien vu !';
    updateQuestion();
    pulseTimer = setTimeout(() => { resetPoints(); if (oldKind === 'trig-direct') updateDirectMarker(); }, 180);
    feedbackTimer = setTimeout(() => feedback.classList.remove('visible'), 650);
    if (result.unlocked.length) notify();
    backgroundSave();
  } else {
    sounds.play('error'); locked = true;
    if (oldKind === 'trig-direct') {
      document.querySelector(`[data-value="${input}"]`)?.classList.add('wrong');
      document.querySelector(`[data-value="${oldValue}"]`)?.classList.add('correct');
    } else document.querySelector(`[data-point="${input}"]`)?.classList.add('wrong');
    for (const point of targets) document.querySelector(`[data-point="${point}"]`)?.classList.add('correct');
    const paths = targets.map(point => { const c=coords(point); return `M200 200L${c.x} ${c.y}`; }).join('');
    document.querySelector('.answer-ray')!.setAttribute('d', paths);
    feedback.className = 'feedback error visible'; feedback.textContent = oldKind === 'trig-inverse' ? 'Voici les points attendus' : 'Voici la bonne réponse';
    document.querySelector('.question-panel')!.classList.add('is-error');
    backgroundSave(); feedbackTimer = setTimeout(next, ERROR_DELAY);
  }
}
function updateDirectMarker(): void {
  if (profile?.active?.kind !== 'trig-direct' || screen !== 'game') return;
  const a=profile.active; document.querySelector(`[data-point="${normalize(a.question)}"]`)?.classList.add('given-point');
  if (a.answers.length < 10) { const c=coords(a.question), e=a.fn==='cos'?{x:c.x,y:200}:{x:200,y:c.y}; document.querySelector('.answer-ray')?.setAttribute('d', `M${c.x} ${c.y}L${e.x} ${e.y}`); }
}
function reviewItem(a: Answer): string {
  const c = coords(normalize(a.units), 26), x = 36+c.x-200, y=36+c.y-200;
  return `<div class="review-item"><svg viewBox="0 0 72 72" aria-label="Position correcte"><path d="M3 36H69M36 3V69" stroke="#52717f"/><circle cx="36" cy="36" r="26" fill="none" stroke="#75aaa9"/><path d="M36 36L${x} ${y}" stroke="#8ce7ce"/><circle cx="${x}" cy="${y}" r="5" fill="#8ce7ce"/></svg><div>${angle(a.units)}<span class="equivalent">Position à retenir</span></div></div>`;
}
function results(): void {
  if (!profile?.active) return;
  clearTimers(); screen = 'results'; sounds.play('finish');
  const p=profile,a=p.active!, correct=a.answers.filter(x=>x.correct).length;
  const errors=a.answers.filter(x=>!x.correct);
  const title=p.grandMaster&&a.passed?'Grand Maître.':a.passed?'Épreuve validée.':correct===a.total?'Un sans-faute.':'Le cercle s’apprivoise.';
  const message=a.kind==='angles'&&a.stage===8&&correct===a.total&&!a.passed?'La moyenne doit être ≤ 5 s pour valider cette épreuve.':a.kind==='angles'&&a.stage===8&&a.passed&&!p.grandMaster?'Angles rapides validés ! Termine aussi les épreuves de cosinus et sinus pour devenir Grand Maître.':a.passed?'Tes réussites et tes succès sont enregistrés.':'Ton grade est conservé. Retente la série pour la réussir sans faute.';
  app.innerHTML=`${header()}<main class="results"><div class="eyebrow"><span></span> ${a.kind==='angles'?'SÉRIE TERMINÉE':'COSINUS & SINUS'}</div><h1>${title}</h1><p>${message}</p><div class="result-score">${correct}<span>/${a.total}</span></div><span class="result-caption">bonnes réponses · ${esc(grade(p))}</span><div class="result-stats"><div><strong>${Math.round(correct/a.total*100)} %</strong><span>de réussite</span></div><div><strong>${seconds(average(a))} s</strong><span>par réponse</span></div><div><strong>${number(p.stats.bestStreak)}</strong><span>meilleure série</span></div></div><div class="result-actions"><button class="primary replay">${a.passed?'Rejouer':'Retenter'} <span>↗</span></button><button class="secondary adventure">Mon aventure</button>${a.kind==='trig-direct'&&p.trigDirect?'<button class="secondary next-inverse">Passer aux équations</button>':''}</div>${errors.length&&a.kind==='angles'?`<section class="review"><h2>Un petit tour de révision</h2><div class="review-grid">${errors.map(reviewItem).join('')}</div></section>`:'<div class="perfect-mark" aria-hidden="true">✦</div>'}</main>`;
  bindHeader(); document.querySelector('.adventure')!.addEventListener('click',dashboard);
  document.querySelector('.replay')!.addEventListener('click',()=>{if(a.kind==='angles')startAttempt(p,a.stage,a.mode,a.total);else startTrig(p,a.kind);sounds.play('start');renderGame();backgroundSave();});
  document.querySelector('.next-inverse')?.addEventListener('click',()=>{startTrig(p,'trig-inverse');sounds.play('start');renderGame();backgroundSave();});
}
function showAchievements(): void {
  if(!profile)return;screen='achievements';clearTimers();const p=profile;
  app.innerHTML=`${header()}<main class="menu-page"><div class="eyebrow">TA COLLECTION</div><div class="page-heading"><div><h1>Succès</h1><p>${Object.keys(p.achievements).length}/${ACHIEVEMENTS.length} débloqués · ${esc(p.name)}</p></div><button class="secondary adventure">Mon aventure</button></div><div class="achievement-grid">${ACHIEVEMENTS.map(a=>{const unlocked=Boolean(p.achievements[a.id]),value=Math.min(a.target,a.value(p));return `<article class="achievement-card ${unlocked?'unlocked':''}"><div class="achievement-symbol">${unlocked?'✦':'◇'}</div><h2>${a.title}</h2><p>${a.description}</p><div class="achievement-meter"><span style="width:${Math.min(100,100*value/a.target)}%"></span></div><small>${unlocked?'✓ Débloqué':`${number(value)} / ${number(a.target)}`}</small></article>`;}).join('')}</div></main>`;
  bindHeader();document.querySelector('.adventure')!.addEventListener('click',dashboard);
}
async function leaveGame(): Promise<void> { pause(); await persist(); clearTimers(); dashboard(); }
function openDialog(content:string,className=''):HTMLDialogElement {
  pause();const d=document.createElement('dialog');d.className=className;d.innerHTML=content;app.append(d);
  const focused=document.activeElement as HTMLElement;
  d.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>d.close()));
  d.addEventListener('click',e=>{if(e.target===d)d.close();});
  d.addEventListener('close',()=>{d.remove();if(!document.querySelector('dialog[open]'))resume();if(focused?.isConnected)focused.focus();});
  d.showModal();return d;
}
function showHelp():void {
  const points=profile?seenPoints(profile):[...STAGES[0].points],guides=profile?seenGuides(profile):STAGES[0].guides;
  const d=openDialog(`<button class="close-dialog" aria-label="Fermer l’aide" data-close>×</button><div class="eyebrow">TES REPÈRES DÉCOUVERTS</div><h2>Un tour vaut 2π.</h2><p>Les angles positifs tournent dans le sens inverse des aiguilles d’une montre. Le cosinus est l’abscisse ; le sinus est l’ordonnée.</p>${circle(points,[],guides,true)}<div class="help-rules"><p><b>${points.length} points découverts</b> · L’aide s’enrichit avec ton aventure.</p><p><b>32π, −75π…</b> · Pair : à droite ; impair : à gauche.</p><p><b>Sans faute</b> · Une erreur conserve le grade, mais l’épreuve est à retenter.</p><p><b>Reprendre</b> · Quitter conserve ta progression et ta série de bonnes réponses. Les pauses ne comptent pas dans la moyenne ; elles interrompent les succès de vitesse.</p></div><button class="primary understood" data-close>Compris <span>↗</span></button>`,'help-dialog');
  void d;
}
function toast(message:string,kind=''):void {
  clearTimeout(toastTimer);document.querySelector('.toast')?.remove();
  const e=document.createElement('div');e.className=`toast ${kind}`;e.setAttribute('role','status');e.textContent=message;app.append(e);toastTimer=setTimeout(()=>e.remove(),3000);
}
function showError(error:unknown):void { openDialog(`<h2>Une action n’a pas abouti.</h2><p>${esc(error instanceof Error?error.message:'Réessaie dans quelques instants.')}</p><button class="secondary" data-close>Fermer</button>`); }
async function exportProfile(p:Profile):Promise<void> {
  const envelope=await storage.seal(p),blob=new Blob([JSON.stringify(envelope)],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`trigo-master-${p.name.replace(/[^a-z0-9à-ÿ_-]/gi,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function exportCurrent():Promise<void>{if(profile){checkpoint();await exportProfile(profile);}}
function importFile():void {
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
  input.addEventListener('change',run(async()=>{const file=input.files?.[0];if(!file)return;if(file.size>2_000_000)throw new Error('Ce fichier est trop volumineux.');const p=await storage.importSave(await file.text());await loadProfile(p);toast('✓ Sauvegarde importée');}));input.click();
}
function confirmDelete(id:string,name:string):void {
  const d=openDialog(`<h2>Supprimer cette partie ?</h2><p>« ${esc(name)} » et ses succès seront supprimés de cet appareil. Un fichier exporté restera utilisable.</p><div class="dialog-actions"><button class="secondary" data-close>Conserver</button><button class="primary delete-confirm">Supprimer</button></div>`);
  d.querySelector('.delete-confirm')!.addEventListener('click',run(async()=>{await acquireProfile(id);await storage.remove(id);releaseProfile();if(profile?.id===id)profile=null;d.close();await showSaves();}));
}
function rename(p:Profile):void {
  const d=openDialog(`<h2>Renommer la partie</h2><form class="name-form"><label for="rename">Nom de la sauvegarde</label><input id="rename" maxlength="40" required value="${esc(p.name)}"/><div class="dialog-actions"><button type="button" class="secondary" data-close>Annuler</button><button class="primary" type="submit">Enregistrer</button></div></form>`);
  d.querySelector('form')!.addEventListener('submit',event=>{event.preventDefault();void(async()=>{await acquireProfile(p.id);const fresh=(await storage.list()).profiles.find(x=>x.id===p.id);if(!fresh)throw new Error('Cette sauvegarde n’est plus disponible.');fresh.name=d.querySelector<HTMLInputElement>('input')!.value.trim()||fresh.name;await storage.save(fresh);releaseProfile();d.close();await showSaves();})().catch(showError);});
}
async function showInstall():Promise<void> {
  await install(ios=>{openDialog(`<div class="eyebrow">TON JEU, À PORTÉE DE MAIN</div><h2>${isStandalone()?'Le jeu est installé.':'Installer Trigo Master'}</h2><p>${isStandalone()?'L’application fonctionne aussi hors connexion après son premier chargement.':ios?'Dans Safari, ouvre le menu Partager, puis choisis « Sur l’écran d’accueil » et confirme avec « Ajouter ».':'Dans le menu du navigateur, choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ». Sur ordinateur, utilise aussi l’icône d’installation dans la barre d’adresse.'}</p><p class="install-detail">Tes sauvegardes restent sur cet appareil. Tu peux les exporter puis les importer dans l’application si le navigateur utilise un espace de stockage distinct.</p><button class="primary" data-close>Compris <span>↗</span></button>`);},async()=>{pause();await persist();await storage.flush();});
}
preventZoom();
initPwa(()=>document.querySelectorAll('.install-button').forEach(b=>{b.textContent=installLabel();}));
setInterval(()=>{if(screen==='game'&&clock!==null&&!locked){checkpoint();backgroundSave();}},1500);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){pause();return;}
  if(screen==='game'&&profile?.active&&!profile.active.done&&(paused||clock===null)){
    if(document.querySelector('dialog[open]'))return;
    if(locked){clearTimeout(feedbackTimer);renderGame();pause();}
    if(!document.querySelector('.resume-overlay')){const b=document.createElement('button');b.className='resume-overlay primary';b.textContent='Reprendre la partie';b.addEventListener('click',()=>{sounds.play('start');resume();});document.querySelector('.play-area')!.append(b);}
  }
});
window.addEventListener('pagehide',pause);
void home().catch(showError);
