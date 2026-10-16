import { ALL_POINTS, POINTS, normalize, type Answer } from './engine';

export const GRADES = ['Débutant', 'Apprenti', 'Initié', 'Pratiquant', 'Confirmé', 'Expert', 'Maître', 'Grand Maître'];
export type Guides = { vertical: boolean; horizontal: boolean; diagonal: boolean };
const guides = (vertical = false, horizontal = false, diagonal = false): Guides => ({ vertical, horizontal, diagonal });
const multiples = (step: number) => ALL_POINTS.filter(n => n % step === 0);
export const STAGES = [
  { title: 'La parité', family: 'Multiples de π', points: multiples(12), guides: guides(), total: 10, range: 12, grade: 0, hint: 'Pair : à droite. Impair : à gauche.' },
  { title: 'Les quatre directions', family: 'Multiples de π/2', points: multiples(6), guides: guides(), total: 8, range: 12, grade: 1, hint: 'Un quart de tour vaut π/2.' },
  { title: 'Les tiers du cercle', family: 'Multiples de π/3', points: multiples(4), guides: guides(true), total: 8, range: 12, grade: 2, hint: 'Les droites x = ±1/2 sont tes repères.' },
  { title: 'De sixième en sixième', family: 'Multiples de π/6', points: multiples(2), guides: guides(true, true), total: 10, range: 12, grade: 3, hint: 'Combine les repères x = ±1/2 et y = ±1/2.' },
  { title: 'Les diagonales', family: 'Multiples de π/4', points: multiples(3), guides: guides(true, true, true), total: 10, range: 12, grade: 4, hint: 'Les diagonales y = x et y = −x s’ajoutent aux repères déjà connus.' },
  { title: 'Les seize points', family: 'π/4 et π/6 réunis', points: POINTS, guides: guides(true, true, true), total: 12, range: 12, grade: 5, hint: 'Les deux familles jouent ensemble.' },
  { title: 'Au-delà du premier tour', family: 'Les seize points · grands angles', points: POINTS, guides: guides(true, true, true), total: 20, range: 48, grade: 5, hint: 'Ajoute ou retire 2π : le point reste le même.' },
  { title: 'L’épreuve de Maître', family: '40 réponses sans faute', points: POINTS, guides: guides(true, true, true), total: 40, range: 96, grade: 5, hint: 'Quarante bonnes réponses. Aucun faux pas.' },
  { title: 'L’épreuve de Grand Maître', family: 'Multiples de π/12', points: ALL_POINTS, guides: guides(true, true, true), total: 40, range: 120, grade: 6, hint: '40 sans faute et une moyenne ≤ 5 s.' },
] as const;

export type Attempt = {
  kind: 'angles' | 'trig-direct' | 'trig-inverse'; fn: 'cos' | 'sin'; choices: number[]; selected: number[];
  mode: 'journey' | 'practice'; stage: number; total: number; answers: Answer[];
  question: number; elapsed: number; bag: number[]; previous: number;
  done: boolean; passed: boolean; interrupted: boolean; speedEligible: boolean;
};
export type Stats = {
  correct: number; answered: number; streak: number; bestStreak: number;
  positive: number; negative: number; far: number; perfect: number;
  points: number[]; integerTimes: number[];
};
export type Profile = {
  version: 1; id: string; name: string; createdAt: number; updatedAt: number;
  stage: number; grandMaster: boolean; angleMastery: boolean; trigDirect: boolean; trigInverse: boolean; active: Attempt | null;
  stats: Stats; achievements: Record<string, number>;
};
export function createProfile(name: string, id: string = crypto.randomUUID(), now = Date.now()): Profile {
  return { version: 1, id, name: name.trim().slice(0, 40) || 'Mon aventure', createdAt: now, updatedAt: now, stage: 0, grandMaster: false, angleMastery: false, trigDirect: false, trigInverse: false, active: null,
    stats: { correct: 0, answered: 0, streak: 0, bestStreak: 0, positive: 0, negative: 0, far: 0, perfect: 0, points: [], integerTimes: [] }, achievements: {} };
}
export function grade(p: Profile): string { return GRADES[p.grandMaster ? 7 : STAGES[p.stage].grade]; }
export function seenPoints(p: Profile): number[] { return [...new Set(STAGES.slice(0, p.stage + 1).flatMap(s => [...s.points]))].sort((a, b) => a - b); }
export function seenGuides(p: Profile): Guides {
  const stages = STAGES.slice(0, p.stage + 1);
  return { vertical: stages.some(s => s.guides.vertical), horizontal: stages.some(s => s.guides.horizontal), diagonal: stages.some(s => s.guides.diagonal) };
}
function nextQuestion(a: Attempt, random = Math.random): number {
  const stage = STAGES[a.stage];
  let point: number;
  if (stage.points.length <= 4) {
    // With two targets, prohibiting repeats would make every answer predictable.
    point = stage.points[Math.floor(random() * stage.points.length)];
  } else {
    if (!a.bag.length) {
      a.bag = [...stage.points];
      for (let i = a.bag.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a.bag[i], a.bag[j]] = [a.bag[j], a.bag[i]]; }
      if (a.bag.at(-1) === a.previous) [a.bag[0], a.bag[a.bag.length - 1]] = [a.bag[a.bag.length - 1], a.bag[0]];
    }
    point = a.bag.pop()!;
  }
  a.previous = point;
  if (point % 12 === 0 && (a.stage === 0 || random() < .75)) {
    const choices = Array.from({ length: 201 }, (_, i) => i - 100).filter(n => normalize(n * 12) === point);
    return choices[Math.floor(random() * choices.length)] * 12;
  }
  const canonical = point > 12 ? point - 24 : point;
  const max = stage.range;
  const candidates = Array.from({ length: 2 * max + 1 }, (_, i) => i - max)
    .filter(n => normalize(n) === point && (a.stage < 6 || a.stage === 8 || Math.abs(n) > 12));
  return candidates.length ? candidates[Math.floor(random() * candidates.length)] : canonical;
}
export function startAttempt(p: Profile, stage = p.stage, mode: Attempt['mode'] = 'journey', total?: number, random = Math.random): Attempt {
  if (!Number.isInteger(stage) || stage < 0 || stage > p.stage) throw new Error('Palier non débloqué');
  const count = mode === 'journey' ? STAGES[stage].total : total ?? 20;
  if (![5, 8, 10, 12, 20, 25, 40, 50, 100].includes(count)) throw new Error('Longueur invalide');
  p.stats.integerTimes = [];
  const a: Attempt = { kind: 'angles', fn: 'cos', choices: [], selected: [], mode, stage, total: count, answers: [], question: 0, elapsed: 0, bag: [], previous: -1, done: false, passed: false, interrupted: false, speedEligible: true };
  a.question = nextQuestion(a, random); p.active = a; return a;
}
export function interrupt(p: Profile, elapsed: number): void {
  const a = p.active;
  if (!a || a.done) return;
  a.elapsed += Math.max(0, elapsed); a.interrupted = true; a.speedEligible = false;
  p.stats.integerTimes = [];
}
export function average(a: Attempt): number { return a.answers.length ? a.answers.reduce((sum, x) => sum + x.elapsed, 0) / a.answers.length : 0; }

export type Achievement = { id: string; title: string; description: string; target: number; value: (p: Profile) => number };
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', title: 'Premier éclat', description: 'Ta toute première bonne réponse.', target: 1, value: p => p.stats.correct },
  ...[10, 25, 50, 100, 200, 500, 1000].map((n, i) => ({ id: `streak-${n}`, title: ['Dans le rythme', 'Main sûre', 'Sans trembler', 'Cent pour cent', 'Inébranlable', 'Virtuose', 'La légende'][i], description: `${n.toLocaleString('fr-FR')} bonnes réponses d’affilée, même sur plusieurs sessions.`, target: n, value: (p: Profile) => p.stats.bestStreak })),
  ...[100, 500, 1000, 5000].map((n, i) => ({ id: `total-${n}`, title: ['Cent détours', 'La belle constance', 'Mille et un angles', 'L’infatigable'][i], description: `Cumuler ${n.toLocaleString('fr-FR')} bonnes réponses.`, target: n, value: (p: Profile) => p.stats.correct })),
  { id: 'speed-10', title: 'Parité express', description: '10 multiples de π sans erreur en moins de 10 s, sans pause.', target: 1, value: p => Number(Boolean(p.achievements['speed-10'])) },
  { id: 'speed-20', title: 'À la vitesse de π', description: '20 multiples de π sans erreur en moins de 15 s, sans pause.', target: 1, value: p => Number(Boolean(p.achievements['speed-20'])) },
  { id: 'points-16', title: 'Le grand tour', description: 'Retrouver chacun des 16 points remarquables.', target: 16, value: p => POINTS.filter(n => p.stats.points.includes(n)).length },
  { id: 'points-24', title: 'Tous azimuts', description: 'Retrouver chacun des 24 points du cercle.', target: 24, value: p => p.stats.points.length },
  { id: 'both-ways', title: 'Dans les deux sens', description: 'Réussir 20 angles positifs et 20 négatifs.', target: 40, value: p => Math.min(20, p.stats.positive) + Math.min(20, p.stats.negative) },
  { id: 'far', title: 'Au-delà de l’horizon', description: '25 angles fractionnaires de valeur absolue supérieure à 2π.', target: 25, value: p => p.stats.far },
  { id: 'perfect-5', title: 'L’art du sans-faute', description: 'Terminer 5 séries sans erreur.', target: 5, value: p => p.stats.perfect },
  { id: 'precision', title: 'Précision éclair', description: 'Une série d’au moins 10 réponses sans faute, moyenne < 3 s, sans pause.', target: 1, value: p => Number(Boolean(p.achievements.precision)) },
  { id: 'master', title: 'La maîtrise', description: 'Obtenir le grade de Maître.', target: 1, value: p => Number(p.stage >= 8) },
  { id: 'trig-direct', title: 'Les coordonnées en tête', description: '20 cosinus et sinus sans faute.', target: 1, value: p => Number(p.trigDirect) },
  { id: 'trig-inverse', title: 'Toutes les solutions', description: '20 équations de cosinus et sinus sans faute.', target: 1, value: p => Number(p.trigInverse) },
  { id: 'grand-master', title: 'Le cercle t’appartient', description: 'Obtenir le grade de Grand Maître.', target: 1, value: p => Number(p.grandMaster) },
];
export function submit(p: Profile, point: number, elapsed: number, random = Math.random, now = Date.now()): { answer: Answer; unlocked: string[]; promoted: boolean } {
  const a = p.active;
  if (!a || a.done || !STAGES[a.stage].points.includes(point) || !Number.isFinite(elapsed) || elapsed < 0) throw new Error('Réponse invalide');
  const oldStage = p.stage, oldGrand = p.grandMaster;
  const oldAchievements = new Set(Object.keys(p.achievements));
  const answer: Answer = { units: a.question, selected: point, correct: normalize(a.question) === point, elapsed: a.elapsed + elapsed };
  a.answers.push(answer); p.stats.answered++;
  if (answer.correct) {
    p.stats.correct++; p.stats.streak++; p.stats.bestStreak = Math.max(p.stats.bestStreak, p.stats.streak);
    if (answer.units > 0) p.stats.positive++;
    if (answer.units < 0) p.stats.negative++;
    if (answer.units % 12 !== 0 && Math.abs(answer.units) > 24) p.stats.far++;
    if (!p.stats.points.includes(point)) p.stats.points.push(point);
    if (a.kind === 'angles' && answer.units % 12 === 0 && a.speedEligible) {
      p.stats.integerTimes.push(answer.elapsed); p.stats.integerTimes = p.stats.integerTimes.slice(-20);
      for (const [n, limit] of [[10, 10000], [20, 15000]]) {
        if (p.stats.integerTimes.length >= n && p.stats.integerTimes.slice(-n).reduce((sum, x) => sum + x, 0) < limit) p.achievements[`speed-${n}`] ??= now;
      }
    } else p.stats.integerTimes = [];
  } else { p.stats.streak = 0; p.stats.integerTimes = []; }
  a.done = a.answers.length === a.total;
  if (a.done) {
    const perfect = a.answers.every(x => x.correct);
    a.passed = perfect && (a.kind !== 'angles' || a.stage !== 8 || average(a) <= 5000);
    if (perfect) {
      p.stats.perfect++;
      if (a.total >= 10 && average(a) < 3000 && !a.interrupted) p.achievements.precision ??= now;
    }
    if (a.passed) {
      if (a.kind === 'trig-direct') p.trigDirect = true;
      else if (a.kind === 'trig-inverse') p.trigInverse = true;
      else if (a.mode === 'journey') {
        if (a.stage === 8) p.angleMastery = true;
        else p.stage = Math.max(p.stage, a.stage + 1);
      }
      p.grandMaster = p.angleMastery && p.trigDirect && p.trigInverse;
    }
  } else { a.question = nextQuestion(a, random); a.elapsed = 0; a.speedEligible = true; if (a.kind !== 'angles') prepareTrig(a, random); }
  for (const achievement of ACHIEVEMENTS) {
    if (achievement.value(p) >= achievement.target) p.achievements[achievement.id] ??= now;
  }
  p.updatedAt = now;
  return { answer, unlocked: Object.keys(p.achievements).filter(id => !oldAchievements.has(id)), promoted: p.stage !== oldStage || p.grandMaster !== oldGrand };
}

export function validProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Profile;
  const count = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
  const duration = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  if (p.version !== 1 || typeof p.id !== 'string' || !/^[\w-]{1,80}$/.test(p.id) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 40 || !duration(p.createdAt) || !duration(p.updatedAt) || !count(p.stage) || p.stage > 8 || !['grandMaster','angleMastery','trigDirect','trigInverse'].every(k => typeof p[k as keyof Profile] === 'boolean') || p.grandMaster !== (p.angleMastery && p.trigDirect && p.trigInverse) || ((p.grandMaster || p.angleMastery) && p.stage !== 8) || ((p.trigDirect || p.trigInverse) && p.stage < 5) || (p.trigInverse && !p.trigDirect)) return false;
  const s = p.stats;
  if (!s || !['correct', 'answered', 'streak', 'bestStreak', 'positive', 'negative', 'far', 'perfect'].every(k => count(s[k as keyof Stats])) || s.correct > s.answered || s.streak > s.bestStreak || s.bestStreak > s.correct || !Array.isArray(s.points) || new Set(s.points).size !== s.points.length || !s.points.every(n => ALL_POINTS.includes(n)) || !Array.isArray(s.integerTimes) || s.integerTimes.length > 20 || !s.integerTimes.every(duration)) return false;
  if (!p.achievements || typeof p.achievements !== 'object' || Array.isArray(p.achievements) || !Object.entries(p.achievements).every(([id, at]) => ACHIEVEMENTS.some(a => a.id === id) && duration(at))) return false;
  const a = p.active;
  if (a !== null) {
    if (!a || !count(a.stage) || a.stage > p.stage || !['angles','trig-direct','trig-inverse'].includes(a.kind) || !['cos','sin'].includes(a.fn) || !Array.isArray(a.choices) || !a.choices.every(n => Number.isInteger(n) && n >= -4 && n <= 4) || !Array.isArray(a.selected) || !a.selected.every(n => POINTS.includes(n)) || (a.kind !== 'angles' && (a.stage !== 5 || a.total !== 20 || a.mode !== 'practice' || !POINTS.includes(a.question))) || !['journey', 'practice'].includes(a.mode) || ![5,8,10,12,20,25,40,50,100].includes(a.total) || (a.mode === 'journey' && a.total !== STAGES[a.stage].total) || !Array.isArray(a.answers) || a.answers.length > a.total || !duration(a.elapsed) || !Number.isSafeInteger(a.question) || Math.abs(a.question) > 1200 || !STAGES[a.stage].points.includes(normalize(a.question)) || !Array.isArray(a.bag) || !a.bag.every(n => STAGES[a.stage].points.includes(n)) || new Set(a.bag).size !== a.bag.length || !['done','passed','interrupted','speedEligible'].every(k => typeof a[k as keyof Attempt] === 'boolean') || a.done !== (a.answers.length === a.total)) return false;
    if (!a.answers.every(x => x && Number.isSafeInteger(x.units) && Math.abs(x.units) <= 1200 && STAGES[a.stage].points.includes(normalize(x.units)) && STAGES[a.stage].points.includes(x.selected) && typeof x.correct === 'boolean' && x.correct === (normalize(x.units) === x.selected) && duration(x.elapsed))) return false;
    if (!Number.isSafeInteger(a.previous) || !STAGES[a.stage].points.includes(a.previous)) return false;
    if (a.kind !== 'angles' && (a.choices.length !== 4 || new Set(a.choices).size !== 4 || !a.choices.includes(coordinate(a.question,a.fn)) || new Set(a.selected).size !== a.selected.length || !a.selected.every(n=>trigTargets(a).includes(n)))) return false;
    if (a.kind === 'angles' && (a.choices.length || a.selected.length)) return false;
    if (a.passed !== (a.done && a.answers.every(x => x.correct) && (a.kind !== 'angles' || a.stage !== 8 || average(a) <= 5000))) return false;
  }
  return true;
}

// Values -4..4 encode -1, -√3/2, -√2/2, -1/2, 0, 1/2, √2/2, √3/2, 1.
const COS: (number | null)[] = [4,null,3,2,1,null,0,null,-1,-2,-3,null,-4,null,-3,-2,-1,null,0,null,1,2,3,null];
const SIN: (number | null)[] = [0,null,1,2,3,null,4,null,3,2,1,null,0,null,-1,-2,-3,null,-4,null,-3,-2,-1,null];
export function coordinate(point: number, fn: 'cos' | 'sin'): number {
  const value = (fn === 'cos' ? COS : SIN)[normalize(point)];
  if (value === null || value === undefined) throw new Error('Coordonnée non remarquable');
  return value;
}
export function trigTargets(a: Attempt): number[] {
  const value = coordinate(a.question, a.fn);
  return POINTS.filter(n => coordinate(n, a.fn) === value);
}
function prepareTrig(a: Attempt, random = Math.random): void {
  a.question = normalize(a.question); a.fn = a.answers.length % 2 === 0 ? 'cos' : 'sin'; a.selected = [];
  const value = coordinate(a.question, a.fn);
  const options = new Set([value, -value, coordinate(a.question, a.fn === 'cos' ? 'sin' : 'cos')]);
  const pool = [-4,-3,-2,-1,0,1,2,3,4];
  while (options.size < 4) { const n = Math.min(pool.length - 1, Math.floor(random() * pool.length)); options.add(pool.splice(n, 1)[0]); }
  a.choices = [...options].slice(0, 4);
  for (let i = a.choices.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a.choices[i], a.choices[j]] = [a.choices[j], a.choices[i]]; }
}
export function startTrig(p: Profile, kind: 'trig-direct' | 'trig-inverse', random = Math.random): Attempt {
  if (p.stage < 5 || (kind === 'trig-inverse' && !p.trigDirect)) throw new Error('Parcours non débloqué');
  const a = startAttempt(p, 5, 'practice', 20, random); a.kind = kind; prepareTrig(a, random); return a;
}
export function submitTrig(p: Profile, input: number, elapsed: number, random = Math.random): ReturnType<typeof submit> | null {
  const a = p.active;
  if (!a || a.done || a.kind === 'angles') throw new Error('Épreuve invalide');
  const targets = trigTargets(a);
  let point: number;
  if (a.kind === 'trig-direct') {
    if (!a.choices.includes(input)) throw new Error('Choix invalide');
    point = input === coordinate(a.question, a.fn) ? normalize(a.question) : POINTS.find(n => coordinate(n, a.fn) === input)!;
  } else {
    if (!POINTS.includes(input)) throw new Error('Point invalide');
    if (a.selected.includes(input)) return null;
    if (targets.includes(input)) {
      a.selected.push(input);
      if (a.selected.length < targets.length) return null;
      point = normalize(a.question);
    } else point = input;
  }
  if (point === undefined) throw new Error('Réponse invalide');
  const result = submit(p, point, elapsed, random);
  if (result.answer.correct && a.kind === 'trig-inverse') for (const target of targets) if (!p.stats.points.includes(target)) p.stats.points.push(target);
  // Point-collection rewards also account for both inverse solutions.
  for (const achievement of ACHIEVEMENTS) if (!p.achievements[achievement.id] && achievement.value(p) >= achievement.target) { p.achievements[achievement.id] = Date.now(); result.unlocked.push(achievement.id); }
  return result;
}
