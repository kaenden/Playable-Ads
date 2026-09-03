/**
 * Bu playable'ın ses bankası — yine tek bir ses DOSYASI yok.
 *
 * core/audio.ts'in `tone` primitifini kullanıyor; context ve ses aç/kapat
 * durumu ortak, sesler oyuna özel. Merge'in ses bankasına korna eklemek
 * 28.3 KB'lık 2D birime hiç çalmayacağı bir sesin kodunu taşıtırdı.
 */
import { tone } from '../../core/audio';

export const sfx = {
  /** Araç çıkışı: yukarı kayan kısa bir "vınn". */
  drive(): void {
    tone(180, 0.16, 'sawtooth', 0.1, 0);
    tone(300, 0.2, 'triangle', 0.13, 0.04);
    tone(430, 0.16, 'sine', 0.09, 0.1);
  },

  /** Korna: iki tonlu, kısa. Tıkalı araç dokunuşunun cevabı. */
  horn(): void {
    tone(392, 0.14, 'square', 0.06, 0);
    tone(311, 0.16, 'square', 0.06, 0.02);
  },

  win(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone(f, 0.28, 'triangle', 0.2, i * 0.09));
  },

  lose(): void {
    tone(300, 0.22, 'sawtooth', 0.1, 0);
    tone(210, 0.34, 'sawtooth', 0.09, 0.16);
  },

  /** Son 5 saniyede saniye başına tik. */
  tick(): void {
    tone(880, 0.05, 'square', 0.045, 0);
  },
};
