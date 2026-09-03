/**
 * Saf oyun mantığı — DOM yok, canvas yok, Three.js yok.
 * Playable #2'de aynı dosya 3D render ile kullanılacak; ayrım bilerek burada.
 */
import { GAME } from './config';

export type Tile = { level: number; id: number } | null;

export type EvType = 'merge' | 'move' | 'spawn' | 'win' | 'lose' | 'reject';
export interface Ev {
  type: EvType;
  index?: number;
  level?: number;
}

export interface State {
  cols: number;
  rows: number;
  cells: Tile[];
  /** Kalan hamle. 0'a inince ve kazanılmadıysa kaybediliyor. */
  moves: number;
  /** Kapanış sahnesine girildikten sonra geçen süre (kutlama -> kart geçişi). */
  endT: number;
  status: 'playing' | 'won' | 'lost';
  merges: number;
  highest: number;
  charges: number;
  elapsed: number;
  started: boolean;
  events: Ev[];
}

let nextId = 1;

/**
 * Açılış dizilimi kasıtlı olarak deterministik:
 * 1+1=2 -> 2+2=3 -> 3+3=4 -> 4+4=5(DRAGON). Tam 4 merge ile kazanılır.
 * Playable'da rastgelelik = ölçülemeyen CTR. Herkes aynı arkı yaşamalı.
 */
const OPENING: Array<[number, number]> = [
  [5, 1], // tutorial çifti (yan yana)
  [6, 1],
  [9, 2],
  [10, 3],
  [13, 4],
  [2, 1], // yem: spawn ile eşleşir, oyuncuya "keşif" hissi verir
];

export function createState(): State {
  const cells: Tile[] = new Array(GAME.cols * GAME.rows).fill(null);
  for (const [idx, level] of OPENING) cells[idx] = { level, id: nextId++ };
  return {
    cols: GAME.cols,
    rows: GAME.rows,
    cells,
    moves: GAME.moveBudget,
    endT: 0,
    status: 'playing',
    merges: 0,
    highest: 4,
    charges: GAME.spawnCharges,
    elapsed: 0,
    started: false,
    events: [],
  };
}

/**
 * Tutorial elinin göstereceği hamle: aynı seviyeden en YAKIN çift.
 * Tahtayı çapraz kesen bir tutorial çizgisi okunmuyor; kısa mesafe
 * hem daha anlaşılır hem de time-to-fun'ı düşürüyor.
 */
export function hintPair(s: State): [number, number] | null {
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let a = 0; a < s.cells.length; a++) {
    const ta = s.cells[a];
    if (!ta || ta.level >= GAME.maxLevel) continue;
    for (let b = a + 1; b < s.cells.length; b++) {
      const tb = s.cells[b];
      if (!tb || tb.level !== ta.level) continue;
      const d =
        Math.abs((a % s.cols) - (b % s.cols)) +
        Math.abs(((a / s.cols) | 0) - ((b / s.cols) | 0)) +
        ta.level * 0.01; // eşitlikte düşük seviyeyi seç: ilk merge en kolay olan olsun
      if (d < bestD) {
        bestD = d;
        best = [a, b];
      }
    }
  }
  return best;
}

export function tryMove(s: State, from: number, to: number): void {
  if (s.status !== 'playing' || from === to) return;
  const src = s.cells[from];
  if (!src) return;
  const dst = s.cells[to];

  if (!dst) {
    s.cells[to] = src;
    s.cells[from] = null;
    s.events.push({ type: 'move', index: to });
    spend(s);
    return;
  }

  if (dst.level === src.level && src.level < GAME.maxLevel) {
    const level = src.level + 1;
    s.cells[to] = { level, id: nextId++ };
    s.cells[from] = null;
    s.merges++;
    if (level > s.highest) s.highest = level;
    s.events.push({ type: 'merge', index: to, level });
    if (s.highest >= GAME.goalLevel) {
      s.status = 'won';
      s.events.push({ type: 'win' });
      return;
    }
    spend(s);
    return;
  }

  // Geçersiz bırakma hamle yakmıyor — oyuncu keşif yaparken cezalandırılmamalı.
  s.events.push({ type: 'reject', index: to });
}

/** Hamle bütçesinden düşer; bittiğinde kaybettirir. Kazanan hamle harcanmaz. */
function spend(s: State): void {
  s.moves--;
  if (s.moves <= 0) {
    s.moves = 0;
    s.status = 'lost';
    s.events.push({ type: 'lose' });
  }
}

export function spawn(s: State): void {
  if (s.status !== 'playing' || s.charges <= 0) return;
  const empty: number[] = [];
  for (let i = 0; i < s.cells.length; i++) if (!s.cells[i]) empty.push(i);
  if (!empty.length) return;
  const idx = empty[(Math.random() * empty.length) | 0];
  s.cells[idx] = { level: 1, id: nextId++ };
  s.charges--;
  s.events.push({ type: 'spawn', index: idx });
}

export function tick(s: State, dt: number): void {
  s.elapsed += dt;
  // Kapanış sahnesi saati: kutlama -> marka + CTA kartı geçişini bu sürüyor.
  if (s.status !== 'playing') s.endT += dt;
}

/** TRY AGAIN: state'i yerinde sıfırlar, referanslar hep bir replay sunuyor. */
export function reset(s: State): void {
  s.cells = new Array(GAME.cols * GAME.rows).fill(null);
  for (const [idx, level] of OPENING) s.cells[idx] = { level, id: nextId++ };
  s.moves = GAME.moveBudget;
  s.endT = 0;
  s.status = 'playing';
  s.merges = 0;
  s.highest = 4;
  s.charges = GAME.spawnCharges;
  s.started = false;
  s.events = [];
}

export function drainEvents(s: State): Ev[] {
  const out = s.events;
  s.events = [];
  return out;
}
