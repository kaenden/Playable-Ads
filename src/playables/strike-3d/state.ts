/**
 * Oyun mantığı — çizimden tamamen bağımsız.
 *
 * Gate Crashers'taki ayrımın aynısı: burada three.js yok, canvas yok. 3D
 * görünüm de 2D yedek görünüm de AYNI durumu okuyor.
 */
import { STRIKE, TRACK, Gate, Target, applyOp, opGood, opLabel } from './config';

export type EvOut =
  /** `label` kapının KENDİ etiketi, farkın değil: 1'in altına kırpılan bir
   *  kapı "+0" gösteriyordu ve bozuk görünüyordu. */
  | { type: 'gate'; good: boolean; before: number; after: number; label: string }
  | { type: 'break'; z: number; upgraded: number }
  /** Bir vuruş hedefe değdi. `crit` ise iki kat hasar verdi. */
  | { type: 'hit'; x: number; z: number; dmg: number; crit: boolean }
  | { type: 'hurt'; n: number }
  | { type: 'finish'; won: boolean };

/** Havadaki silah. */
export interface Shot {
  x: number;
  z: number;
  /** Hedefin TRACK içindeki indeksi; -1 ise hedefsiz. */
  target: number;
  /** Fırlatıldığı andaki güç — havadayken silah yükselirse bu değişmesin. */
  dmg: number;
  /** Kritik mi: iki kat hasar, ekranda kırmızı ve büyük yazılıyor. */
  crit: boolean;
  spin: number;
}

/** Bir hedefin çalışma zamanı durumu. TRACK indeksiyle eşleşiyor. */
export interface TargetState {
  hp: number;
  /** Kırıldı mı — kırılan hedef ne çiziliyor ne ceza kesiyor. */
  broken: boolean;
}

export interface State {
  z: number;
  x: number;
  steer: number;
  /** Sayaç bir: adam sayısı. Kapılardan geliyor, atış SIKLIĞINI belirliyor. */
  crowd: number;
  /** Sayaç iki: silah gücü. Tuzaklardan geliyor, vuruşun BÜYÜKLÜĞÜNÜ belirliyor. */
  weapon: number;
  status: 'playing' | 'won' | 'lost';
  started: boolean;
  t: number;
  pre: number;
  next: number;
  endT: number;
  targets: TargetState[];
  shots: Shot[];
  fireAcc: number;
  /** Kaç atış yapıldı — kritik ritmi buradan sayılıyor. */
  throws: number;
  events: EvOut[];
}

const GA = 2.39996323;

/** Kalabalık dizilimi — Gate Crashers'taki ayçiçeği spiralinin aynısı. */
export function offsetX(i: number): number {
  return Math.cos(i * GA) * STRIKE.spread * Math.sqrt(i);
}

export function offsetZ(i: number): number {
  return Math.sin(i * GA) * STRIKE.spread * Math.sqrt(i);
}

/**
 * HEDEF FİGÜRLERİNİN YERLEŞİMİ — saf saf, dağınık değil.
 *
 * Kalabalık için spiral doğru, hedef için yanlış: figürler birbirinin önüne
 * binince üstlerindeki can sayısı üst üste düşüyor ve okunmaz oluyor.
 *
 * Saflar oyuncuya DOĞRU uzuyor, en arka saf tam `ev.z` üstünde — ceza orada
 * işlediği için, saflar ileri uzasaydı ceza oyuncunun daha varmadığı bir
 * safı da ölmüş sayardı.
 */
export function targetSlot(ev: Target, i: number): { x: number; z: number } {
  const cols = Math.min(STRIKE.foeCols, ev.count);
  const span = (STRIKE.halfW - 0.5) * 2;
  const rows = Math.ceil(ev.count / cols);
  const c = i % cols;
  const r = Math.floor(i / cols);
  const rowN = Math.min(cols, ev.count - r * cols);
  const step = span / Math.max(1, rowN);
  // Arka saf yarım adım kayık: hizalı olduğunda tam öndekinin ardına düşüyor.
  const shift = r % 2 ? step * 0.5 : 0;
  const x =
    ev.count === 1
      ? 0
      : Math.max(-span / 2, Math.min(span / 2, -span / 2 + step * (c + 0.5) + shift));
  return { x, z: ev.z - (rows - 1 - r) * STRIKE.foeRowGap };
}

/** Hedefin canı düştükçe ayakta kalan figür sayısı da düşüyor. */
export function standing(ev: Target, ts: TargetState): number {
  if (ts.broken) return 0;
  return Math.max(1, Math.ceil((ts.hp / ev.hp) * ev.count));
}

function freshTargets(): TargetState[] {
  return TRACK.map((ev) =>
    ev.type === 'target' ? { hp: ev.hp, broken: false } : { hp: 0, broken: true }
  );
}

export function createState(): State {
  return {
    z: 0,
    x: 0,
    steer: 0,
    crowd: STRIKE.startCrowd,
    weapon: STRIKE.startWeapon,
    status: 'playing',
    started: false,
    t: 0,
    pre: STRIKE.countIn,
    next: 0,
    endT: 0,
    targets: freshTargets(),
    shots: [],
    fireAcc: 0,
    throws: 0,
    events: [],
  };
}

export function reset(s: State): void {
  const f = createState();
  s.z = f.z;
  s.x = f.x;
  s.steer = f.steer;
  s.crowd = f.crowd;
  s.weapon = f.weapon;
  s.status = f.status;
  s.started = f.started;
  s.t = f.t;
  s.pre = f.pre;
  s.next = f.next;
  s.endT = f.endT;
  s.targets = f.targets;
  s.shots.length = 0;
  s.fireAcc = 0;
  s.throws = 0;
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

/** Kaç adam gerçekten atış yapıyor — akış sıklığı buradan geliyor. */
export function throwers(s: State): number {
  return Math.max(1, Math.min(s.crowd, STRIKE.throwCap));
}

/** Menzildeki en yakın kırılmamış hedef. Nişan alma yok, silah kendi buluyor. */
function acquire(s: State): number {
  for (let i = 0; i < TRACK.length; i++) {
    const ev = TRACK[i];
    if (ev.type !== 'target') continue;
    if (s.targets[i].broken) continue;
    if (ev.z <= s.z - 1) continue;
    if (ev.z - s.z > STRIKE.range) continue;
    return i;
  }
  return -1;
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

  // HEDEF OLAYLARI BİRAZ GEÇTEN İŞLİYOR (grace).
  //
  // Hedefin tam üstünde işletince, o karede hâlâ HAVADA olan son vuruş
  // hedefi kırmadan önce ceza kesiliyordu: oyuncu hedefi kırıyor ama yine
  // de bir adam kaybediyor. 1.6 birim, yani bir vuruşun uçuş payı.
  while (s.next < TRACK.length && TRACK[s.next].z + (TRACK[s.next].type === 'target' ? 1.6 : 0) <= s.z) {
    const idx = s.next;
    const ev = TRACK[idx];
    s.next++;
    if (ev.type === 'gate') {
      const op = s.x < 0 ? ev.left : ev.right;
      const before = s.crowd;
      s.crowd = Math.max(1, applyOp(s.crowd, op));
      s.events.push({ type: 'gate', good: opGood(op), before, after: s.crowd, label: opLabel(op) });
      continue;
    }

    const ts = s.targets[idx];
    if (ts.broken) continue;

    if (ev.boss) {
      s.status = 'lost';
      s.endT = 0;
      s.events.push({ type: 'finish', won: false });
      s.z = ev.z;
      return;
    }
    // Ayakta kalan her figür bir adam götürüyor. Kalabalık hep 1'de duruyor:
    // sıfıra düşüp reklamı ortasında bitirmek ödül anına hiç ulaşmıyor.
    const hurt = Math.min(standing(ev, ts), s.crowd - 1);
    if (hurt > 0) {
      s.crowd -= hurt;
      s.events.push({ type: 'hurt', n: hurt });
    }
  }

  // Patron kırıldıysa oyun orada bitiyor; ona varmayı beklemeye gerek yok.
  const last = TRACK.length - 1;
  if (s.targets[last].broken) {
    s.status = 'won';
    s.endT = 0;
    s.events.push({ type: 'finish', won: true });
  }
}

function fire(s: State, dt: number): void {
  s.fireAcc += dt;
  const every = Math.max(STRIKE.minFire, STRIKE.baseFire / throwers(s));
  if (s.fireAcc < every) return;
  s.fireAcc = 0;
  if (s.shots.length >= STRIKE.shotCap) return;
  const target = acquire(s);
  if (target < 0) return;
  // Atıcı kalabalığın içinden SIRAYLA çıkıyor, rastgele değil: akış düzenli
  // görünsün ve her atış aynı noktadan çıkmasın.
  const who = s.shots.length % throwers(s);
  // KRİTİK RİTMİ. Rastgele değil sayaçla: sebebi config.ts'te — bir reklam
  // kötü şansla kaybedilmemeli. Hasar fırlatma anında kilitleniyor, yani
  // havadayken silah yükselse bile bu atış eski gücüyle vuruyor.
  s.throws++;
  const crit = s.throws % STRIKE.critEvery === 0;
  s.shots.push({
    x: s.x + offsetX(who),
    z: s.z + offsetZ(who) + 0.7,
    target,
    dmg: s.weapon * (crit ? STRIKE.critMul : 1),
    crit,
    spin: 0,
  });
}

function moveShots(s: State, dt: number): void {
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i];
    sh.z += STRIKE.shotSpeed * dt;
    sh.spin += dt * 22;

    if (sh.target < 0 || s.targets[sh.target].broken) {
      sh.target = acquire(s);
      if (sh.target < 0) {
        if (sh.z > s.z + STRIKE.range + 6) s.shots.splice(i, 1);
        continue;
      }
    }

    const ev = TRACK[sh.target] as Target;
    if (sh.z < ev.z) continue;

    const ts = s.targets[sh.target];
    ts.hp -= sh.dmg;
    s.events.push({ type: 'hit', x: sh.x, z: ev.z, dmg: sh.dmg, crit: sh.crit });
    s.shots.splice(i, 1);
    if (ts.hp > 0) continue;

    ts.hp = 0;
    ts.broken = true;
    const up = ev.gives && ev.gives > s.weapon ? ev.gives : 0;
    if (up) s.weapon = up;
    s.events.push({ type: 'break', z: ev.z, upgraded: up });
  }
}

export function drainEvents(s: State): EvOut[] {
  const out = s.events.slice();
  s.events.length = 0;
  return out;
}
