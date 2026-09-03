/**
 * İki renderer'ın (WebGL ve 2D yedek) ortak sözleşmesi.
 *
 * merge-3d'de bu sözleşme örtüktü — View3D ile View2D'nin metodları tesadüfen
 * uyuşuyordu ve main.ts `View3D | View2D` yazıyordu. Biri değişince diğerinin
 * bozulduğunu ancak derleyici yakalıyordu, o da her zaman değil. Burada
 * arayüz açıkça duruyor: yedek renderer eksik bir metotla derlenmiyor.
 */
import { State, Car } from './state';
import { Layout, UiState } from './layout';

export interface EscapeView {
  L: Layout;
  /** Girişin bağlanacağı canvas — WebGL'de üstteki HUD katmanı. */
  cv: HTMLCanvasElement;
  resize(): void;
  /** Ekran noktası -> hücre indeksi, yoksa -1. */
  cellAt(x: number, y: number): number;
  /** Aracın ekrandaki merkezi — tutorial halkası oraya çiziliyor. */
  carScreenPos(car: Car): [number, number] | null;
  /** Araç çıkıyor: animasyonu renderer yönetiyor. */
  drive(car: Car): void;
  /** Tıkalı araç dokunuşu: araç ileri atılıp geri geliyor, engel yanıp sönüyor. */
  bump(car: Car, blocker: Car): void;
  render(s: State, ui: UiState, dt: number): void;
}
