/**
 * İki görünümün ortak arayüzü.
 *
 * escape-3d'deki kuralın aynısı: WebGL yoksa BOŞ EKRAN gösterilemez. Ad
 * container'larının bir kısmı hâlâ WebGL'siz çalışıyor; orada
 * `new WebGLRenderer()` patlıyor, reklam beyaz kalıyor ve CTA hiç görünmüyor.
 * Bu yüzden aynı durumu okuyan bir 2D yedek görünüm var.
 */
import { State } from './state';
import { Layout, UiState } from './layout';
import { Hud } from './hud';

export interface RunView {
  L: Layout;
  cv: HTMLCanvasElement;
  hud: Hud;
  resize(): void;
  render(s: State, ui: UiState, dt: number): void;
  /** Kapıdan geçildi — etiket zaten hesaplanmış hâlde geliyor. */
  gate(good: boolean, label: string): void;
  /** Temizlenemeyen düşmanların bedeli. */
  hurt(n: number): void;
  /** Hedef kırıldı. `upgraded` sıfırdan büyükse silah o değere çıktı. */
  broke(wz: number, upgraded: number): void;
  finish(won: boolean): void;
  reset(): void;
}
