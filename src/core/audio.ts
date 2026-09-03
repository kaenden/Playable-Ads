/**
 * Prosedürel ses — WebAudio ile üretiliyor, tek ses DOSYASI yok.
 *
 * Referans reklamların üçünde de ses toggle'ı vardı (bkz. Sample Ads teardown 02).
 * Base64 mp3 gömmek 100-300 KB tutardı; osilatörle üretmek ~1 KB kod.
 *
 * Ağ kuralı: kullanıcı etkileşiminden ÖNCE ses çalmak yasak. WebAudio zaten
 * gesture olmadan context açtırmıyor, yani kural ve platform aynı yöne bakıyor —
 * ctx sadece ilk dokunuşta (unlock) yaratılıyor.
 */

let ctx: AudioContext | null = null;
let on = true;

/**
 * Tek osilatör vuruşu. Üçüncü playable kendi ses bankasını (escape-3d/sfx.ts)
 * bununla kuruyor: merge'in korna sesine, escape'in merge sesine ihtiyacı yok,
 * ama ikisi de aynı context'i ve aynı ses aç/kapat durumunu paylaşmalı.
 */
export function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay: number): void {
  if (!ctx || !on) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env);
  env.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const audio = {
  get on(): boolean {
    return on;
  },

  /** İlk kullanıcı dokunuşunda çağrılıyor. */
  unlock(): void {
    if (ctx) return;
    try {
      const AC = (window as unknown as Record<string, unknown>).AudioContext
        || (window as unknown as Record<string, unknown>).webkitAudioContext;
      if (AC) ctx = new (AC as { new (): AudioContext })();
    } catch (e) {
      ctx = null;
    }
  },

  toggle(): void {
    on = !on;
  },

  /** Merge: seviye yükseldikçe perde yükseliyor — ilerleme kulakla da duyuluyor. */
  merge(level: number): void {
    const base = 320 * Math.pow(1.18, level);
    tone(base, 0.13, 'triangle', 0.22, 0);
    tone(base * 1.5, 0.1, 'sine', 0.14, 0.045);
  },

  spawn(): void {
    tone(240, 0.08, 'sine', 0.12, 0);
  },

  reject(): void {
    tone(150, 0.09, 'square', 0.07, 0);
  },

  win(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone(f, 0.28, 'triangle', 0.2, i * 0.09));
  },

  lose(): void {
    tone(330, 0.2, 'triangle', 0.16, 0);
    tone(247, 0.3, 'triangle', 0.14, 0.13);
  },
};
