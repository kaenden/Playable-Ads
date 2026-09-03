/**
 * Saf oyun mantığı — DOM yok, canvas yok, Three.js yok.
 *
 * Merge'de olduğu gibi renderer'dan tamamen bağımsız: aynı state hem WebGL
 * sahnesini hem WebGL bulunmayan cihazdaki 2D yedeği besliyor.
 */
import { LOT } from './config';

/** 0 yukarı(-satır), 1 sağ(+sütun), 2 aşağı(+satır), 3 sol(-sütun). */
export type Dir = 0 | 1 | 2 | 3;

export interface Car {
  id: number;
  /** Sol-üst hücre. Yatay araç sütun boyunca, dikey araç satır boyunca uzanır. */
  col: number;
  row: number;
  len: number;
  horiz: boolean;
  /** Aracın burnunun baktığı ve çıkacağı yön. */
  dir: Dir;
  color: string;
}

export type EvType = 'drive' | 'blocked' | 'win' | 'lose';
export interface Ev {
  type: EvType;
  car?: Car;
  /** 'blocked' olayında yolu kapatan araç — görsel olarak o da yanıp sönüyor. */
  blocker?: Car;
}

export interface State {
  cols: number;
  rows: number;
  cars: Car[];
  total: number;
  /** Kalan süre. Sadece oyuncu ilk kez dokunduktan SONRA işliyor. */
  time: number;
  status: 'playing' | 'won' | 'lost';
  /** Kapanış sahnesine girildikten sonra geçen süre (kutlama -> kart geçişi). */
  endT: number;
  elapsed: number;
  started: boolean;
  taps: number;
  events: Ev[];
}

/**
 * Açılış dizilimi deterministik — merge'deki ile aynı gerekçe: reklamda
 * rastgelelik, ölçülemeyen CTR demek. Herkes aynı bulmacayı görmeli.
 *
 *        c0    c1    c2    c3    c4
 *  r0    A     A     ..    B     B      A sağa çıkar, B'ye tıkalı
 *  r1    C     ..    ..    ..    D      C aşağı çıkar, G'ye tıkalı
 *  r2    C     E     E     E     D      E sola çıkar, C'ye tıkalı
 *  r3    ..    ..    F     ..    ..     D, F, G ve B başta serbest
 *  r4    G     G     F     ..    ..
 *
 * Başta 4 araç serbest (oyun ilk dokunuşta kesin ödüllendiriyor), ama
 * G -> C -> E üç kademeli bir zincir: bulmaca hissi oradan geliyor.
 * Kilitlenme yok, her sıralama çözülebilir — reklam kazanılabilir olmalı.
 */
const OPENING: Car[] = [
  { id: 1, col: 0, row: 0, len: 2, horiz: true, dir: 1, color: '#E8443A' },
  { id: 2, col: 3, row: 0, len: 2, horiz: true, dir: 1, color: '#F5B62B' },
  { id: 3, col: 0, row: 1, len: 2, horiz: false, dir: 2, color: '#2F7BE8' },
  { id: 4, col: 4, row: 1, len: 2, horiz: false, dir: 2, color: '#34C167' },
  { id: 5, col: 1, row: 2, len: 3, horiz: true, dir: 3, color: '#F2762B' },
  { id: 6, col: 2, row: 3, len: 2, horiz: false, dir: 2, color: '#8C5BE0' },
  { id: 7, col: 0, row: 4, len: 2, horiz: true, dir: 3, color: '#21B8C4' },
];

function fresh(): Car[] {
  return OPENING.map((c) => ({ ...c }));
}

export function createState(): State {
  const cars = fresh();
  return {
    cols: LOT.cols,
    rows: LOT.rows,
    cars,
    total: cars.length,
    time: LOT.timeLimit,
    status: 'playing',
    endT: 0,
    elapsed: 0,
    started: false,
    taps: 0,
    events: [],
  };
}

/** Aracın kapladığı hücre indeksleri (row * cols + col). */
export function cellsOf(s: State, c: Car): number[] {
  const out: number[] = [];
  for (let i = 0; i < c.len; i++) {
    const col = c.col + (c.horiz ? i : 0);
    const row = c.row + (c.horiz ? 0 : i);
    out.push(row * s.cols + col);
  }
  return out;
}

/** Yön vektörü: [dCol, dRow]. */
export function step(dir: Dir): [number, number] {
  return dir === 0 ? [0, -1] : dir === 1 ? [1, 0] : dir === 2 ? [0, 1] : [-1, 0];
}

/** Aracın burnunun bulunduğu hücre. */
export function head(c: Car): [number, number] {
  if (c.horiz) return [c.dir === 1 ? c.col + c.len - 1 : c.col, c.row];
  return [c.col, c.dir === 2 ? c.row + c.len - 1 : c.row];
}

export function carAt(s: State, cell: number): Car | null {
  for (const c of s.cars) if (cellsOf(s, c).indexOf(cell) >= 0) return c;
  return null;
}

/**
 * Aracın çıkış yolu boş mu?
 * Boşsa null, değilse yolu ilk kapatan aracı döndürür — "neden olmadı"
 * sorusunun cevabı oyuncuya gösterilecek.
 */
export function blockerOf(s: State, car: Car): Car | null {
  const [dc, dr] = step(car.dir);
  let [col, row] = head(car);
  for (;;) {
    col += dc;
    row += dr;
    if (col < 0 || row < 0 || col >= s.cols || row >= s.rows) return null; // kenardan çıktı
    const other = carAt(s, row * s.cols + col);
    if (other && other.id !== car.id) return other;
  }
}

/** Şu an çıkabilecek araçlar. */
export function freeCars(s: State): Car[] {
  return s.cars.filter((c) => !blockerOf(s, c));
}

export function tap(s: State, cell: number): void {
  if (s.status !== 'playing') return;
  const car = carAt(s, cell);
  if (!car) return;
  s.taps++;

  const blocker = blockerOf(s, car);
  if (blocker) {
    // Tıkalı dokunuş CEZALANDIRILMIYOR (bkz. LOT.timeLimit yorumu): bu bir
    // hata değil, oyuncunun bulmacayı okuma biçimi.
    s.events.push({ type: 'blocked', car, blocker });
    return;
  }

  s.cars = s.cars.filter((c) => c.id !== car.id);
  s.events.push({ type: 'drive', car });
  if (!s.cars.length) {
    s.status = 'won';
    s.events.push({ type: 'win' });
  }
}

/** Tutorial elinin göstereceği araç: çıkabilecek olanların ilki. */
export function hintCar(s: State): Car | null {
  return freeCars(s)[0] || null;
}

export function tick(s: State, dt: number): void {
  s.elapsed += dt;
  if (s.status !== 'playing') {
    s.endT += dt;
    return;
  }
  // Saat oyuncu başlayınca başlıyor. Reklamı henüz fark etmemiş birini
  // dokunmadan kaybettirmek, izlenimi boşa yakmak demek.
  if (!s.started) return;
  s.time -= dt;
  if (s.time <= 0) {
    s.time = 0;
    s.status = 'lost';
    s.events.push({ type: 'lose' });
  }
}

/** TRY AGAIN: state'i yerinde sıfırlar. */
export function reset(s: State): void {
  s.cars = fresh();
  s.time = LOT.timeLimit;
  s.status = 'playing';
  s.endT = 0;
  s.started = false;
  s.taps = 0;
  s.events = [];
}

export function drainEvents(s: State): Ev[] {
  const out = s.events;
  s.events = [];
  return out;
}
