/**
 * Saf oyun mantığı — DOM yok, canvas yok, atlas yok.
 *
 * Diğer üç birimden farkı: bu GERÇEK ZAMANLI. Merge ve escape'te state sadece
 * dokunuşla değişiyordu; burada her karede düşman yürüyor, kule ateş ediyor,
 * mermi yol alıyor. Yine de aynı ayrım geçerli: burası sadece simülasyon,
 * çizimin nerede olduğunu bilmiyor.
 *
 * Koordinatlar HÜCRE cinsinden (piksel değil). Ekran ölçüsü değişince
 * simülasyonun hiçbir sayısı değişmiyor — cihaz farkı oyunu değiştirmemeli.
 */
import { TD, WAY, SLOTS, FOES, WAVE } from './config';

export interface Foe {
  id: number;
  kind: string;
  /** Yol üzerinde kat edilen mesafe, hücre cinsinden. */
  dist: number;
  hp: number;
  maxHp: number;
  /** Vurulma parlaması için kalan süre. */
  hit: number;
}

export interface Tower {
  id: number;
  slot: number;
  cool: number;
  /** Namlunun baktığı açı (radyan), hedefe yumuşak dönüyor. */
  aim: number;
  /** Namlu ateşi efektinin kalan süresi. */
  flash: number;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  target: number;
  dmg: number;
}

export type EvType = 'build' | 'deny' | 'shoot' | 'kill' | 'leak' | 'win' | 'lose';
export interface Ev {
  type: EvType;
  x?: number;
  y?: number;
  kind?: string;
  slot?: number;
}

export interface State {
  t: number;
  cash: number;
  lives: number;
  towers: Tower[];
  foes: Foe[];
  bullets: Bullet[];
  /** WAVE dizisinde işlenmiş sıradaki indeks. */
  spawned: number;
  killed: number;
  status: 'playing' | 'won' | 'lost';
  endT: number;
  started: boolean;
  events: Ev[];
}

let nextId = 1;

/** Yolun kırılma noktaları arası uzunlukları ve toplam uzunluk. */
const SEG: number[] = [];
let TOTAL = 0;
for (let i = 1; i < WAY.length; i++) {
  const d = Math.hypot(WAY[i][0] - WAY[i - 1][0], WAY[i][1] - WAY[i - 1][1]);
  SEG.push(d);
  TOTAL += d;
}

export const pathLength = TOTAL;

/** Yol üzerinde `d` mesafedeki nokta ve yön açısı. */
export function pointAt(d: number): { x: number; y: number; a: number } {
  let left = Math.max(0, d);
  for (let i = 0; i < SEG.length; i++) {
    if (left <= SEG[i] || i === SEG.length - 1) {
      const k = SEG[i] ? Math.min(1, left / SEG[i]) : 0;
      const p0 = WAY[i];
      const p1 = WAY[i + 1];
      return {
        x: p0[0] + (p1[0] - p0[0]) * k,
        y: p0[1] + (p1[1] - p0[1]) * k,
        a: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]),
      };
    }
    left -= SEG[i];
  }
  return { x: WAY[0][0], y: WAY[0][1], a: 0 };
}

export function createState(): State {
  return {
    t: 0,
    cash: TD.startCash,
    lives: TD.lives,
    towers: [],
    foes: [],
    bullets: [],
    spawned: 0,
    killed: 0,
    status: 'playing',
    endT: 0,
    started: false,
    events: [],
  };
}

export function slotTaken(s: State, slot: number): boolean {
  for (const t of s.towers) if (t.slot === slot) return true;
  return false;
}

export function canBuild(s: State, slot: number): boolean {
  return s.status === 'playing' && !slotTaken(s, slot) && s.cash >= TD.towerCost;
}

export function build(s: State, slot: number): void {
  if (s.status !== 'playing' || slot < 0 || slot >= SLOTS.length) return;
  if (slotTaken(s, slot)) return;
  if (s.cash < TD.towerCost) {
    // Para yetmiyorsa sessizce yutmuyoruz: oyuncu NEDEN olmadığını görmeli.
    s.events.push({ type: 'deny', slot });
    return;
  }
  s.cash -= TD.towerCost;
  s.towers.push({ id: nextId++, slot, cool: 0, aim: -Math.PI / 2, flash: 0 });
  s.events.push({ type: 'build', slot });
}

/** İlk boş ve satın alınabilir yuva — tutorial ve auto-advance bunu kullanıyor. */
export function hintSlot(s: State): number {
  for (let i = 0; i < SLOTS.length; i++) if (canBuild(s, i)) return i;
  return -1;
}

function foeById(s: State, id: number): Foe | null {
  for (const f of s.foes) if (f.id === id) return f;
  return null;
}

export function tick(s: State, dt: number): void {
  if (s.status !== 'playing') {
    s.endT += dt;
    return;
  }
  // Dalga oyuncu ilk kez dokununca başlıyor. Reklamı henüz fark etmemiş
  // birine kaybettirmek izlenimi boşa yakmak demek — escape'teki saatle
  // aynı gerekçe.
  if (!s.started) return;
  s.t += dt;

  // --- doğuş
  while (s.spawned < WAVE.length && s.t >= WAVE[s.spawned][0]) {
    const kind = WAVE[s.spawned][1];
    const k = FOES[kind];
    s.foes.push({ id: nextId++, kind, dist: 0, hp: k.hp, maxHp: k.hp, hit: 0 });
    s.spawned++;
  }

  // --- düşmanlar yürüyor
  for (let i = s.foes.length - 1; i >= 0; i--) {
    const f = s.foes[i];
    f.hit = Math.max(0, f.hit - dt);
    f.dist += FOES[f.kind].speed * dt;
    if (f.dist >= TOTAL) {
      s.foes.splice(i, 1);
      s.lives--;
      const p = pointAt(TOTAL);
      s.events.push({ type: 'leak', x: p.x, y: p.y });
      if (s.lives <= 0) {
        s.lives = 0;
        s.status = 'lost';
        s.events.push({ type: 'lose' });
        return;
      }
    }
  }

  // --- kuleler nişan alıp ateş ediyor
  for (const tw of s.towers) {
    const sl = SLOTS[tw.slot];
    const cx = sl[0] + 0.5;
    const cy = sl[1] + 0.5;
    tw.cool -= dt;
    tw.flash = Math.max(0, tw.flash - dt);

    // Hedef: menzildeki EN İLERİ düşman. En yakını seçmek, kaçmak üzere
    // olanı bırakıp yeni geleni vurmak olurdu.
    let best: Foe | null = null;
    let bestD = -1;
    for (const f of s.foes) {
      const p = pointAt(f.dist);
      if (Math.hypot(p.x - cx, p.y - cy) <= TD.range && f.dist > bestD) {
        best = f;
        bestD = f.dist;
      }
    }
    if (!best) continue;

    const p = pointAt(best.dist);
    const want = Math.atan2(p.y - cy, p.x - cx);
    // Açıyı en kısa yönden takip et; -PI/PI sınırında namlu bir tam tur atıyordu.
    let diff = want - tw.aim;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    tw.aim += diff * Math.min(1, dt * 12);

    if (tw.cool <= 0) {
      tw.cool = TD.fireEvery;
      tw.flash = 0.09;
      s.bullets.push({ id: nextId++, x: cx, y: cy, target: best.id, dmg: TD.damage });
      s.events.push({ type: 'shoot', x: cx, y: cy });
    }
  }

  // --- mermiler
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i];
    const f = foeById(s, b.target);
    if (!f) {
      s.bullets.splice(i, 1);
      continue;
    }
    const p = pointAt(f.dist);
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy);
    const step = TD.bulletSpeed * dt;
    if (d <= step) {
      s.bullets.splice(i, 1);
      f.hp -= b.dmg;
      f.hit = 0.12;
      if (f.hp <= 0) {
        const idx = s.foes.indexOf(f);
        if (idx >= 0) s.foes.splice(idx, 1);
        s.cash += FOES[f.kind].reward;
        s.killed++;
        s.events.push({ type: 'kill', x: p.x, y: p.y, kind: f.kind });
      }
      continue;
    }
    b.x += (dx / d) * step;
    b.y += (dy / d) * step;
  }

  // --- kazanma: dalga bitti ve sahada düşman kalmadı
  if (s.spawned >= WAVE.length && !s.foes.length) {
    s.status = 'won';
    s.events.push({ type: 'win' });
  }
}

export function reset(s: State): void {
  s.t = 0;
  s.cash = TD.startCash;
  s.lives = TD.lives;
  s.towers = [];
  s.foes = [];
  s.bullets = [];
  s.spawned = 0;
  s.killed = 0;
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
