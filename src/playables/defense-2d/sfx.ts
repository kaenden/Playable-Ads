/**
 * Ses bankası — yine prosedürel, tek ses dosyası yok.
 *
 * Gerçek zamanlı bir oyunda atış sesi saniyede birkaç kez çalıyor; ses
 * dosyası olsaydı bile bu kadar sık tetiklemek için havuz gerekirdi.
 * Osilatör başına bir nesne yaratmak WebAudio'da normal ve ucuz.
 */
import { tone } from '../../core/audio';

let lastShot = 0;

export const sfx = {
  build(): void {
    tone(220, 0.09, 'square', 0.09, 0);
    tone(440, 0.12, 'triangle', 0.13, 0.05);
  },

  /** Para yetmiyor. */
  deny(): void {
    tone(150, 0.1, 'square', 0.07, 0);
  },

  /**
   * Atış. Aynı anda üç kule ateş edince üst üste binip cızırdıyordu;
   * 60 ms'den sık çalınmıyor — kulak farkı duymuyor, kırpılma gidiyor.
   */
  shoot(now: number): void {
    if (now - lastShot < 0.06) return;
    lastShot = now;
    tone(680, 0.045, 'square', 0.035, 0);
  },

  kill(): void {
    tone(180, 0.11, 'sawtooth', 0.08, 0);
    tone(120, 0.16, 'triangle', 0.07, 0.04);
  },

  leak(): void {
    tone(200, 0.22, 'sawtooth', 0.11, 0);
    tone(140, 0.3, 'sawtooth', 0.09, 0.12);
  },

  win(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.28, 'triangle', 0.2, i * 0.09));
  },

  lose(): void {
    tone(300, 0.24, 'sawtooth', 0.11, 0);
    tone(190, 0.36, 'sawtooth', 0.1, 0.18);
  },
};
