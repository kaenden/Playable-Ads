/**
 * Saf match-3 mantığı — DOM yok, canvas yok, three yok.
 *
 * merge'de olduğu gibi bu dosya İKİ renderer'ı da besliyor ve hangisiyle
 * çizildiğini bilmiyor. Fark şu: match-3 zincirleme (cascade) çalışıyor,
 * yani bir takas birden çok tur temizlik doğurabiliyor. O yüzden state bir
 * FAZ MAKİNESİ: idle -> swap -> clear -> fall -> (tekrar clear...) -> idle.
 *
 * Renderer sadece `phase` ve `phaseT`'ye bakıp aradeğerleme yapıyor;
 * animasyon süresi burada, animasyonun kendisi orada.
 */
import { M } from './config';

export type Phase = 'idle' | 'swap' | 'back' | 'clear' | 'fall';

export type EvType = 'swap' | 'reject' | 'clear' | 'land' | 'win' | 'lose';
export interface Ev {
  type: EvType;
  cells?: number[];
  kind?: number;
  /** Zincir derinliği: 1 ilk temizlik, 2+ cascade. Ses ve puan buna bakıyor. */
  chain?: number;
}

export interface State {
  cols: number;
  rows: number;
  /** Tür indeksi; -1 boş (sadece faz içinde geçici olarak). */
  cells: number[];
  /**
   * Düşüş animasyonu için her hücrenin GELDİĞİ satır. Kendi satırıysa
   * hareket etmedi; negatifse tahtanın üstünden yeni girdi.
   */
  fallSrc: number[];
  phase: Phase;
  phaseT: number;
  swapA: number;
  swapB: number;
  clearing: number[];
  chain: number;

  moves: number;
  collected: number;
  status: 'playing' | 'won' | 'lost';
  endT: number;
  started: boolean;
  events: Ev[];
}

/**
 * Deterministik kaynak. Reklamda rastgelelik = ölçülemeyen CTR; ama
 * match-3'te dolum da rastgele olmak zorunda, o yüzden rastgelelik SABİT
 * BİR DİZİYE dönüştürülüyor: herkes aynı tahtayı ve aynı dolumu görüyor.
 */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const rnd = lcg(20260902);
/** Dolum sırası: uzun ve sabit. Tükenirse başa dönüyor. */
const REFILL: number[] = [];
for (let i = 0; i < 512; i++) REFILL.push((rnd() * M.kinds) | 0);

/** Açılış tahtası: eşleşmesiz kurulur, yoksa oyun ilk karede kendini yer. */
const OPENING: number[] = (() => {
  const n = M.cols * M.rows;
  const b: number[] = new Array(n);
  const r2 = lcg(777);
  for (let i = 0; i < n; i++) {
    const col = i % M.cols;
    const row = (i / M.cols) | 0;
    for (let guard = 0; guard < 40; guard++) {
      const k = (r2() * M.kinds) | 0;
      const h2 = col >= 2 && b[i - 1] === k && b[i - 2] === k;
      const v2 = row >= 2 && b[i - M.cols] === k && b[i - M.cols * 2] === k;
      if (!h2 && !v2) {
        b[i] = k;
        break;
      }
      b[i] = k; // guard dolarsa yine de bir değer kalsın
    }
  }
  return b;
})();

let refillAt = 0;

export function createState(): State {
  return {
    cols: M.cols,
    rows: M.rows,
    cells: OPENING.slice(),
    fallSrc: OPENING.map((_, i) => (i / M.cols) | 0),
    phase: 'idle',
    phaseT: 0,
    swapA: -1,
    swapB: -1,
    clearing: [],
    chain: 0,
    moves: M.moves,
    collected: 0,
    status: 'playing',
    endT: 0,
    started: false,
    events: [],
  };
}

export function rowOf(i: number): number {
  return (i / M.cols) | 0;
}
export function colOf(i: number): number {
  return i % M.cols;
}

export function adjacent(a: number, b: number): boolean {
  const dc = Math.abs(colOf(a) - colOf(b));
  const dr = Math.abs(rowOf(a) - rowOf(b));
  return dc + dr === 1;
}

/** Tahtadaki bütün 3+ dizileri. */
function findMatches(cells: number[]): number[] {
  const hit: boolean[] = new Array(cells.length).fill(false);

  for (let r = 0; r < M.rows; r++) {
    let run = 1;
    for (let c = 1; c <= M.cols; c++) {
      const i = r * M.cols + c;
      const p = r * M.cols + c - 1;
      const same = c < M.cols && cells[i] >= 0 && cells[i] === cells[p];
      if (same) run++;
      else {
        if (run >= 3) for (let k = 0; k < run; k++) hit[p - k] = true;
        run = 1;
      }
    }
  }
  for (let c = 0; c < M.cols; c++) {
    let run = 1;
    for (let r = 1; r <= M.rows; r++) {
      const i = r * M.cols + c;
      const p = (r - 1) * M.cols + c;
      const same = r < M.rows && cells[i] >= 0 && cells[i] === cells[p];
      if (same) run++;
      else {
        if (run >= 3) for (let k = 0; k < run; k++) hit[p - k * M.cols] = true;
        run = 1;
      }
    }
  }

  const out: number[] = [];
  for (let i = 0; i < hit.length; i++) if (hit[i]) out.push(i);
  return out;
}

/** Bir takas eşleşme üretir mi? Tutorial ve auto-advance bunu kullanıyor. */
function wouldMatch(cells: number[], a: number, b: number): boolean {
  const t = cells.slice();
  const x = t[a];
  t[a] = t[b];
  t[b] = x;
  return findMatches(t).length > 0;
}

/** Oyuncuya gösterilecek geçerli hamle: hedefe en çok yaklaştıran değil, ilk bulunan. */
export function hintSwap(s: State): [number, number] | null {
  if (s.phase !== 'idle' || s.status !== 'playing') return null;
  for (let i = 0; i < s.cells.length; i++) {
    const right = i + 1;
    if (colOf(right) !== 0 && right < s.cells.length && wouldMatch(s.cells, i, right)) return [i, right];
    const down = i + M.cols;
    if (down < s.cells.length && wouldMatch(s.cells, i, down)) return [i, down];
  }
  return null;
}

export function trySwap(s: State, a: number, b: number): void {
  if (s.status !== 'playing' || s.phase !== 'idle') return;
  if (a < 0 || b < 0 || a === b || !adjacent(a, b)) return;

  s.swapA = a;
  s.swapB = b;
  const t = s.cells[a];
  s.cells[a] = s.cells[b];
  s.cells[b] = t;

  if (findMatches(s.cells).length) {
    s.phase = 'swap';
    s.phaseT = 0;
    s.chain = 0;
    s.events.push({ type: 'swap' });
  } else {
    // Eşleşme yok: taşlar geri dönüyor ve HAMLE YANMIYOR.
    s.phase = 'back';
    s.phaseT = 0;
    s.events.push({ type: 'reject' });
  }
}

function applyGravity(s: State): boolean {
  let moved = false;
  for (let c = 0; c < M.cols; c++) {
    let write = M.rows - 1;
    for (let r = M.rows - 1; r >= 0; r--) {
      const i = r * M.cols + c;
      if (s.cells[i] < 0) continue;
      const dst = write * M.cols + c;
      if (dst !== i) {
        s.cells[dst] = s.cells[i];
        s.cells[i] = -1;
        s.fallSrc[dst] = r;
        moved = true;
      } else {
        s.fallSrc[dst] = r;
      }
      write--;
    }
    // Kalan boşluklar tahtanın üstünden doluyor; kaynak satır NEGATİF.
    let above = -1;
    for (let r = write; r >= 0; r--) {
      const dst = r * M.cols + c;
      s.cells[dst] = REFILL[refillAt++ % REFILL.length];
      s.fallSrc[dst] = above--;
      moved = true;
    }
  }
  return moved;
}

function startClear(s: State, hits: number[]): void {
  s.chain++;
  s.clearing = hits;
  s.phase = 'clear';
  s.phaseT = 0;
  let got = 0;
  for (const i of hits) if (s.cells[i] === M.target) got++;
  s.collected += got;
  s.events.push({ type: 'clear', cells: hits, chain: s.chain });
}

function finishTurn(s: State): void {
  s.phase = 'idle';
  s.clearing = [];
  s.swapA = -1;
  s.swapB = -1;

  if (s.collected >= M.goal) {
    s.status = 'won';
    s.events.push({ type: 'win' });
    return;
  }
  if (s.moves <= 0) {
    s.status = 'lost';
    s.events.push({ type: 'lose' });
  }
}

export function tick(s: State, dt: number): void {
  if (s.status !== 'playing') {
    s.endT += dt;
    return;
  }
  if (!s.started) return;
  if (s.phase === 'idle') return;

  s.phaseT += dt;

  if (s.phase === 'back') {
    if (s.phaseT < M.swapFor) return;
    const t = s.cells[s.swapA];
    s.cells[s.swapA] = s.cells[s.swapB];
    s.cells[s.swapB] = t;
    s.phase = 'idle';
    s.swapA = -1;
    s.swapB = -1;
    return;
  }

  if (s.phase === 'swap') {
    if (s.phaseT < M.swapFor) return;
    // Takas geçerliydi: hamle burada yanıyor, sonuç ne olursa olsun.
    s.moves--;
    const hits = findMatches(s.cells);
    startClear(s, hits);
    return;
  }

  if (s.phase === 'clear') {
    if (s.phaseT < M.clearFor) return;
    for (const i of s.clearing) s.cells[i] = -1;
    applyGravity(s);
    s.phase = 'fall';
    s.phaseT = 0;
    s.events.push({ type: 'land' });
    return;
  }

  if (s.phase === 'fall') {
    if (s.phaseT < M.fallFor) return;
    const hits = findMatches(s.cells);
    if (hits.length) {
      startClear(s, hits);
      return;
    }
    finishTurn(s);
  }
}

export function reset(s: State): void {
  refillAt = 0;
  s.cells = OPENING.slice();
  s.fallSrc = OPENING.map((_, i) => (i / M.cols) | 0);
  s.phase = 'idle';
  s.phaseT = 0;
  s.swapA = -1;
  s.swapB = -1;
  s.clearing = [];
  s.chain = 0;
  s.moves = M.moves;
  s.collected = 0;
  s.status = 'playing';
  s.endT = 0;
  s.started = false;
  s.events = [];
}

export function drainEvents(s: State): Ev[] {
  const out = s.events;
  s.events = [];
  return out;
}
