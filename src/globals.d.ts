/** build/build.mjs içinde esbuild `define` ile gömülen derleme zamanı sabitleri. */
declare const __AD_NETWORK__: string;
declare const __STORE_IOS__: string;
declare const __STORE_ANDROID__: string;

/** Art kaynağı: 'proc' prosedürel çizim, 'atlas' optimize WebP atlası. */
declare const __ART__: string;
declare const __ATLAS_B64__: string;
declare const __ATLAS_FRAMES__: string;
declare const __GLB_B64__: string;

/**
 * Modelin RENK PALETİ dokusu — GLB'nin İÇİNDE değil, yanında.
 * Sebep: reklam kutusunun CSP'si GLB'ye gömülü dokunun yüklenmesini
 * engelliyor (blob üzerinden ağ isteği). Ayrı taşınıp data URI ile
 * yükleniyor; o yol kutuda çalışıyor.
 */
declare const __PALETTE_B64__: string;
/** İkinci palet dokusu — sahnede iki ayrı dokulu model varsa (bkz. core/palette.ts). */
declare const __PALETTE2_B64__: string;
