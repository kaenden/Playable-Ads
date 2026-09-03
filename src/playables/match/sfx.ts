/**
 * Ses bankası — prosedürel, iki renderer da paylaşıyor.
 */
import { tone } from '../../core/audio';

export const sfx = {
  swap(): void {
    tone(520, 0.06, 'triangle', 0.09, 0);
  },

  reject(): void {
    tone(170, 0.09, 'square', 0.06, 0);
  },

  /** Zincir derinleştikçe perde yükseliyor: cascade kulakla da duyuluyor. */
  clear(chain: number): void {
    const base = 440 * Math.pow(1.16, Math.min(chain, 6) - 1);
    tone(base, 0.12, 'triangle', 0.2, 0);
    tone(base * 1.5, 0.1, 'sine', 0.12, 0.04);
  },

  win(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.28, 'triangle', 0.2, i * 0.09));
  },

  lose(): void {
    tone(330, 0.2, 'triangle', 0.16, 0);
    tone(247, 0.3, 'triangle', 0.14, 0.13);
  },
};
