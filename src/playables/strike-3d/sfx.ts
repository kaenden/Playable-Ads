/**
 * Ses bankası — yine tek ses dosyası yok, hepsi osilatör.
 * Ortak `tone` primitifi core/audio.ts'te; sesler oyuna özel.
 */
import { tone } from '../../core/audio';

export const sfx = {
  /** Ayak sesi: koşu temposuna kilitli, kısa ve alçak. */
  step(): void {
    tone(96 + Math.random() * 14, 0.06, 'square', 0.03, 0);
  },

  /** Kalabalık büyüdü: yükselen ikili. */
  gain(): void {
    tone(523.25, 0.1, 'triangle', 0.14, 0);
    tone(783.99, 0.14, 'triangle', 0.12, 0.05);
  },

  /** Kalabalık küçüldü: alçalan ikili — kazançla ZIT yönde, kulakla ayrılsın. */
  loss(): void {
    tone(330, 0.1, 'sawtooth', 0.1, 0);
    tone(196, 0.18, 'sawtooth', 0.09, 0.05);
  },

  /** Engel çarpması: kuru bir gümbürtü. */
  crush(): void {
    tone(120, 0.16, 'square', 0.11, 0);
    tone(72, 0.22, 'sawtooth', 0.1, 0.02);
  },

  smash(): void {
    tone(150, 0.3, 'sawtooth', 0.16, 0);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, 0.14 + i * 0.08));
  },

  lose(): void {
    tone(300, 0.22, 'sawtooth', 0.1, 0);
    tone(190, 0.36, 'sawtooth', 0.09, 0.16);
  },
};
