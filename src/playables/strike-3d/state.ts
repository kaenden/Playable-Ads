/**
 * Oyun mantığı — çizimden tamamen bağımsız.
 *
 * Crowd Rush'taki ayrımın aynısı: burada three.js yok, canvas yok. 3D
 * görünüm de 2D yedek görünüm de AYNI durumu okuyor.
 */
import { STRIKE, TRACK, Gate, Boss, applyOp, opGood, opLabel } from './config';

export type EvOut =
  /**
   * `label` kapının KENDİ etiketi, farkın değil.
   *
   * Önce farkı yazıyorduk ve güç 1'in altına inemediği için kırpılan bir
   * kapı ekranda "+0" gösteriyordu — bozuk görünüyor. Kapının üstünde ne
   * yazıyorsa ekranda o beliriyor artık; oyuncunun az önce geçtiği panelin
   * yankısı, ve her zaman anlamlı.
   */
  | { type: 'gate'; good: boolean; before: number; after: number; label: string }
  | { type: 'kill'; x: number; z: number }
  | { type: 'hurt'; n: number }
  | { type: 'finish'; won: boolean };

/** Tek düşman. Konumu sabit, tek değişkeni canı. */
export interface Foe {
  x: number;
  z: number;
  hp: number;
  /** Hangi gruba ait — grup geçildiğinde ceza bunun üstünden sayılıyor. */
  wave: number;
}

/** Havadaki silah. */
export interface Shot {
  x: number;
  z: number;
  /** Hedef düşmanın dizideki sırası; -1 ise patron. */
  target: number;
  /** Fırlatıldığı andaki güç — havadayken kapıdan geçmek onu değiştirmesin. */
  dmg: number;
  /** Görsel: dönüş açısı. */
  spin: number;
}

export interface State {
  z: number;
  x: number;
  steer: number;
  /** Sayaç: silah gücü. */
  power: number;
  status: 'playing' | 'won' | 'lost';
  started: boolean;
  t: number;
  pre: number;
  next: number;
  endT: number;
  foes: Foe[];
  shots: Shot[];
  bossHp: number;
  fireAcc: number;
  events: EvOut[];
}

/**
 * DÜŞMAN DİZİLİMİ — SAF SAF, DAĞINIK DEĞİL.
 *
 * İlk sürümde Crowd Rush'ın ayçiçeği spiralini kullanıyordum: kalabalık
 * için doğru, hedef için yanlış. Referans kreatifte (Hell Escape) hedefler
 * koridoru kapatan SAFLAR hâlinde duruyor ve her birinin canı üstünde
 * yazıyor. Spiralde figürler birbirinin önüne binince o sayılar üst üste
 * düşüyor ve okunmaz oluyor — dizilimin asıl işi artık yer açmak.
 *
 * Saf başına en fazla `foeCols` düşman, koridora eşit aralıklı; artanlar
 * arkaya yeni saf oluyor. Böylece hem hepsi görünüyor hem sayılar ayrık.
 */
function buildFoes(): Foe[] {
  const out: Foe[] = [];
  for (let e = 0; e < TRACK.length; e++) {
    const ev = TRACK[e];
    if (ev.type !== 'wave') continue;
    const cols = Math.min(STRIKE.foeCols, ev.count);
    const span = (STRIKE.halfW - 0.5) * 2;
    const rows = Math.ceil(ev.count / cols);
    for (let i = 0; i < ev.count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const rowN = Math.min(cols, ev.count - r * cols);
      // Her saf KENDİ içinde ortalanıyor; yarım kalan son saf sola yaslanmıyor.
      const step = span / Math.max(1, rowN);
      // ARKA SAF YARIM ADIM KAYIK. Hizalı olduğunda arkadaki tam öndekinin
      // ardına düşüyor ve iki can sayısı üst üste biniyordu.
      const shift = r % 2 ? step * 0.5 : 0;
      out.push({
        x: Math.max(-span / 2, Math.min(span / 2, -span / 2 + step * (c + 0.5) + shift)),
        // EN ARKA SAF TAM `ev.z` ÜSTÜNDE. Saflar oyuncuya doğru uzuyor,
        // çünkü ceza `ev.z` geçilince işliyor: saflar ileri uzasaydı ceza,
        // oyuncunun daha varmadığı bir safı da ölmüş sayardı.
        z: ev.z - (rows - 1 - r) * STRIKE.foeRowGap,
        hp: ev.hp,
        wave: e,
      });
    }
  }
  return out;
}

export function createState(): State {
  return {
    z: 0,
    x: 0,
    steer: 0,
    power: STRIKE.start,
    status: 'playing',
    started: false,
    t: 0,
    pre: STRIKE.countIn,
    next: 0,
    endT: 0,
    foes: buildFoes(),
    shots: [],
    bossHp: (TRACK[TRACK.length - 1] as Boss).hp,
    fireAcc: 0,
    events: [],
  };
}

export function reset(s: State): void {
  const f = createState();
  s.z = f.z;
  s.x = f.x;
  s.steer = f.steer;
  s.power = f.power;
  s.status = f.status;
  s.started = f.started;
  s.t = f.t;
  s.pre = f.pre;
  s.next = f.next;
  s.endT = f.endT;
  s.foes = f.foes;
  s.shots.length = 0;
  s.bossHp = f.bossHp;
  s.fireAcc = 0;
  s.events.length = 0;
}

export function steerBy(s: State, dx: number): void {
  if (s.status !== 'playing') return;
  s.steer = clamp(s.steer + dx, -STRIKE.steerLimit, STRIKE.steerLimit);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Sıradaki kapı — tutorial oku bunu kullanıyor. */
export function nextGate(s: State): Gate | null {
  for (let i = s.next; i < TRACK.length; i++) {
    if (TRACK[i].type === 'gate') return TRACK[i] as Gate;
  }
  return null;
}

/** Patronun z'si — görünüm mesafeyi buradan hesaplıyor. */
export function bossZ(): number {
  return (TRACK[TRACK.length - 1] as Boss).z;
}

/**
 * Menzildeki en yakın canlı hedef. Silah kendi buluyor: nişan alma yok,
 * parmağın tek işi kapı seçmek.
 */
function acquire(s: State): number {
  let best = -2;
  let bestZ = Infinity;
  for (let i = 0; i < s.foes.length; i++) {
    const f = s.foes[i];
    if (f.hp <= 0) continue;
    if (f.z <= s.z) continue;
    if (f.z - s.z > STRIKE.range) continue;
    if (f.z < bestZ) {
      bestZ = f.z;
      best = i;
    }
  }
  if (best >= 0) return best;
  // Grup kalmadıysa patron hedeftir — ama sadece menzile girince.
  const bz = bossZ();
  if (s.bossHp > 0 && bz > s.z && bz - s.z <= STRIKE.range) return -1;
  return -2;
}

export function tick(s: State, dt: number): void {
  if (s.status !== 'playing') {
    s.endT += dt;
    return;
  }

  // Yatay yumuşatma geri sayımda da çalışıyor: oyuncu başlamadan parmağını
  // yerleştirebilmeli.
  const k = 1 - Math.exp(-STRIKE.steerLerp * dt);
  s.x += (s.steer - s.x) * k;

  if (s.pre > 0) {
    s.pre -= dt;
    return;
  }

  s.t += dt;
  s.z += STRIKE.speed * Math.min(1, s.t / STRIKE.rampFor) * dt;

  fire(s, dt);
  moveShots(s, dt);

  while (s.next < TRACK.length && TRACK[s.next].z <= s.z) {
    const ev = TRACK[s.next];
    s.next++;
    if (ev.type === 'gate') {
      const op = s.x < 0 ? ev.left : ev.right;
      const before = s.power;
      s.power = Math.max(1, applyOp(s.power, op));
      s.events.push({ type: 'gate', good: opGood(op), before, after: s.power, label: opLabel(op) });
    } else if (ev.type === 'wave') {
      // Temizlenemeyen her düşman güçten bir puan götürüyor.
      let left = 0;
      for (const f of s.foes) {
        if (f.wave === s.next - 1 && f.hp > 0) {
          left++;
          f.hp = 0;
        }
      }
      // Silah hep elde kalıyor: sıfıra düşüp reklamı ortasında bitirmek,
      // gösterimi ödül anına hiç ulaştırmıyor.
      const hurt = Math.min(left, s.power - 1);
      if (hurt > 0) {
        s.power -= hurt;
        s.events.push({ type: 'hurt', n: hurt });
      }
    } else {
      const won = s.bossHp <= 0;
      s.status = won ? 'won' : 'lost';
      s.endT = 0;
      s.events.push({ type: 'finish', won });
      s.z = ev.z;
      return;
    }
  }
}

function fire(s: State, dt: number): void {
  s.fireAcc += dt;
  if (s.fireAcc < STRIKE.fireEvery) return;
  s.fireAcc = 0;
  if (s.shots.length >= STRIKE.shotCap) return;
  const target = acquire(s);
  if (target === -2) return;
  s.shots.push({ x: s.x, z: s.z + 0.7, target, dmg: s.power, spin: 0 });
}

function moveShots(s: State, dt: number): void {
  const bz = bossZ();
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i];
    sh.z += STRIKE.shotSpeed * dt;
    sh.spin += dt * 22;

    // Hedef bu arada öldüyse yeni hedef ara; bulunmazsa silah geçip gidiyor.
    if (sh.target >= 0 && s.foes[sh.target].hp <= 0) {
      sh.target = acquire(s);
    }

    if (sh.target === -1) {
      if (sh.z >= bz) {
        s.bossHp = Math.max(0, s.bossHp - sh.dmg);
        s.shots.splice(i, 1);
      }
      continue;
    }
    if (sh.target < 0) {
      if (sh.z > s.z + STRIKE.range + 6) s.shots.splice(i, 1);
      continue;
    }

    const f = s.foes[sh.target];
    if (sh.z >= f.z) {
      f.hp -= sh.dmg;
      s.shots.splice(i, 1);
      if (f.hp <= 0) s.events.push({ type: 'kill', x: f.x, z: f.z });
    }
  }
}

export function drainEvents(s: State): EvOut[] {
  const out = s.events.slice();
  s.events.length = 0;
  return out;
}
