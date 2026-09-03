/**
 * Tek arayüz, çok ağ.
 *
 * Ağ başına CTA çağrısı farklı ve yanlışı build reddine yol açıyor:
 *   Meta       -> FbPlayableAd.onCTAClick()
 *   Google UAC -> ExitApi.exit()          (exitapi.js head'de yüklü olmalı)
 *   TikTok     -> window.openAppStore()   (playable-sdk.js head'de yüklü olmalı)
 *   diğerleri  -> mraid.open(storeUrl)    (Unity, AppLovin, ironSource, Mintegral, Moloco, Vungle)
 *
 * ÖNEMLİ: karşılaştırmalar doğrudan __AD_NETWORK__ sabiti üzerinden yapılıyor.
 * Bir ara değişkene ("const NETWORK = __AD_NETWORK__") alınırsa esbuild sabiti
 * katlayamıyor ve her pakete dört ağın kodu birden giriyor — ölçtük, öyle oldu.
 * Bu haliyle unity build'inde FbPlayableAd/ExitApi/openAppStore string'leri yok.
 */

type AnyWin = Window & Record<string, any>;

function w(): AnyWin {
  return window as AnyWin;
}

function storeUrl(): string {
  const ios = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
  return ios ? __STORE_IOS__ : __STORE_ANDROID__;
}

/** MRAID container hazır olmadan çizme — bazı SDK'lar öncesinde canvas'ı boyutsuz verir. */
function whenMraidReady(cb: () => void): void {
  const m = w().mraid;
  if (!m || typeof m.getState !== 'function') {
    cb();
    return;
  }
  if (m.getState() === 'loading') {
    m.addEventListener('ready', function onReady() {
      m.removeEventListener('ready', onReady);
      cb();
    });
  } else {
    cb();
  }
}

let ctaFired = false;

export const ad = {
  network: __AD_NETWORK__,

  init(onReady: () => void): void {
    if (__AD_NETWORK__ !== 'preview' && __AD_NETWORK__ !== 'facebook' && __AD_NETWORK__ !== 'google' && __AD_NETWORK__ !== 'tiktok') whenMraidReady(onReady);
    else onReady();
  },

  /** Ses/animasyon duraklatma. MRAID viewableChange; diğerlerinde sayfa görünürlüğü. */
  onVisibility(cb: (visible: boolean) => void): void {
    if (__AD_NETWORK__ !== 'preview' && __AD_NETWORK__ !== 'facebook' && __AD_NETWORK__ !== 'google' && __AD_NETWORK__ !== 'tiktok') {
      const m = w().mraid;
      if (m && typeof m.addEventListener === 'function') {
        m.addEventListener('viewableChange', (v: boolean) => cb(!!v));
      }
    }
    document.addEventListener('visibilitychange', () => cb(!document.hidden));
  },

  /** CTA. Ad container içinde ASLA exception fırlatma — bazı SDK'lar tüm creative'i öldürür. */
  install(): void {
    try {
      const g = w();
      if (__AD_NETWORK__ === 'facebook') {
        if (g.FbPlayableAd && g.FbPlayableAd.onCTAClick) g.FbPlayableAd.onCTAClick();
      } else if (__AD_NETWORK__ === 'google') {
        if (g.ExitApi && g.ExitApi.exit) g.ExitApi.exit();
      } else if (__AD_NETWORK__ === 'tiktok') {
        if (typeof g.openAppStore === 'function') g.openAppStore();
      } else if (g.mraid && typeof g.mraid.open === 'function') {
        g.mraid.open(storeUrl());
      } else {
        g.open(storeUrl(), '_blank');
      }
      ctaFired = true;
    } catch (e) {
      /* yut */
    }
  },

  get fired(): boolean {
    return ctaFired;
  },
};
