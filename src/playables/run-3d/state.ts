/**
 * Oyun mantığı — çizimden tamamen bağımsız.
 *
 * Diğer birimlerdeki ayrımın aynısı: burada three.js yok, canvas yok. 3D
 * görünüm de 2D yedek görünüm de AYNI durumu okuyor, o yüzden ikisi hiçbir
 * zaman farklı bir oyun oynamıyor.
 */
import { RUN, TRACK, Gate, Row, applyOp, opGood } from './config';

export type EvOut =
  | { type: 'gate'; good: boolean; before: number; after: number }
  | { type: 'crush'; n: number }
  | { type: 'finish'; won: boolean };

export interface State {
  /** Parkurda ilerleme. */
  z: number;
  /** Kalabalığın merkezi (yatay). */
  x: number;
  /** Parmağın istediği merkez. */
  steer: number;
  count: number;
  status: 'playing' | 'won' | 'lost';
  /** İlk dokunuş oldu mu — tutorial ve otomatik oynatma buna bakıyor. */
  started: boolean;
  t: number;
  /** Sıradaki parkur olayının indeksi. */
  next: number;
  endT: number;
  events: EvOut[];
}

const GA = 2.39996323;

/**
 * Kalabalık dizilimi — ayçiçeği (phyllotaxis) spirali.
 *
 * Izgara dizilimi denendi ve kötüydü: sayı değiştikçe sıra sayısı zıplıyor,
 * kalabalık ekranda "yeniden diziliyor" gibi görünüyor. Spiralde her yeni
 * adam dışarıya bir halka ekliyor, mevcut adamlar yerinde kalıyor — büyüme
 * ekranda sürekli okunuyor.
 */
export function offsetX(i: number): number {
  return Math.cos(i * GA) * RUN.spread * Math.sqrt(i);
}

export function offsetZ(i: number): number {
  return Math.sin(i * GA) * RUN.spread * Math.sqrt(i);
}

export function createState(): State {
  return {
    z: 0,
    x: 0,
    steer: 0,
    count: RUN.start,
    status: 'playing',
    started: false,
    t: 0,
    next: 0,
    endT: 0,
    events: [],
  };
}

export function reset(s: State): void {
  const f = createState();
  s.z = f.z;
  s.x = f.x;
  s.steer = f.steer;
  s.count = f.count;
  s.status = f.status;
  s.started = f.started;
  s.t = f.t;
  s.next = f.next;
  s.endT = f.endT;
  s.events.length = 0;
}

/** Parmağın verdiği yatay itiş — dünya birimi cinsinden. */
export function steerBy(s: State, dx: number): void {
  if (s.status !== 'playing') return;
  s.steer = clamp(s.steer + dx, -RUN.steerLimit, RUN.steerLimit);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Sıradaki kapı — tutorial oku ve otomatik oynatma bunu kullanıyor. */
export function nextGate(s: State): Gate | null {
  for (let i = s.next; i < TRACK.length; i++) {
    if (TRACK[i].type === 'gate') return TRACK[i] as Gate;
  }
  return null;
}

/** Sıradaki engel sırasının açık koridoru — otomatik oynatma buradan geçiyor. */
export function nextRow(s: State): Row | null {
  for (let i = s.next; i < TRACK.length; i++) {
    if (TRACK[i].type === 'row') return TRACK[i] as Row;
  }
  return null;
}

/** Engel sırasındaki en geniş boşluğun merkezi. */
export function gapCenter(r: Row): number {
  const sorted = r.blocks.slice().sort((a, b) => a[0] - b[0]);
  let best = 0;
  let bestW = -1;
  let cursor = -RUN.halfW;
  for (const b of sorted) {
    if (b[0] - cursor > bestW) {
      bestW = b[0] - cursor;
      best = (cursor + b[0]) / 2;
    }
    cursor = Math.max(cursor, b[1]);
  }
  if (RUN.halfW - cursor > bestW) best = (cursor + RUN.halfW) / 2;
  return best;
}

export function tick(s: State, dt: number): void {
  if (s.status !== 'playing') {
    s.endT += dt;
    return;
  }
  s.t += dt;

  // Yatay: parmak hedefi veriyor, merkez ona yumuşayarak gidiyor. Doğrudan
  // atamak kalabalığı ışınlıyordu; kalabalığın ağırlığı olmalı.
  const k = 1 - Math.exp(-RUN.steerLerp * dt);
  s.x += (s.steer - s.x) * k;

  // Hız rampası: reklam açıldığı an kamera fırlamasın.
  s.z += RUN.speed * Math.min(1, s.t / RUN.rampFor) * dt;

  while (s.next < TRACK.length && TRACK[s.next].z <= s.z) {
    const ev = TRACK[s.next];
    s.next++;
    if (ev.type === 'gate') {
      const op = s.x < 0 ? ev.left : ev.right;
      const before = s.count;
      s.count = Math.max(1, applyOp(s.count, op));
      s.events.push({ type: 'gate', good: opGood(op), before, after: s.count });
    } else if (ev.type === 'row') {
      // Kapalı aralıkta duran HER adam eziliyor.
      let hit = 0;
      for (let i = 0; i < s.count; i++) {
        const wx = s.x + offsetX(i);
        for (const b of ev.blocks) {
          if (wx > b[0] && wx < b[1]) {
            hit++;
            break;
          }
        }
      }
      // Lider hep hayatta kalıyor: oyuncunun kendisi o. Sıfıra düşüp
      // oyunu 8. saniyede bitirmek reklamı ödül anına hiç ulaştırmıyor.
      hit = Math.min(hit, s.count - 1);
      if (hit > 0) {
        s.count -= hit;
        s.events.push({ type: 'crush', n: hit });
      }
    } else {
      const won = s.count >= ev.need;
      s.status = won ? 'won' : 'lost';
      s.endT = 0;
      s.events.push({ type: 'finish', won });
      // Bitişte tam duvarın önünde dur.
      s.z = ev.z;
      return;
    }
  }
}

export function drainEvents(s: State): EvOut[] {
  const out = s.events.slice();
  s.events.length = 0;
  return out;
}
