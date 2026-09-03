/**
 * Ağ başına paketleme kuralları.
 *
 * Kaynaklar (Eylül 2026): Unity/AppLovin/ironSource/Mintegral tek dosya + MRAID;
 * Google App campaigns ZIP + exitapi.js + ad.size meta; Meta tek .html + FbPlayableAd;
 * TikTok/Pangle ZIP + config.json + playable-sdk.js.
 *
 * NOT: limitler ağların dokümanlarında değişiyor (Unity için 5MB da 10MB da yazan
 * kaynak var). Burada muhafazakâr olan 5MB alındı; teslimden önce hedef ağın
 * güncel dokümanıyla teyit et.
 */

const MRAID_TAG = '<script src="mraid.js"></script>';

export const NETWORKS = {
  preview: {
    label: 'Preview (tarayıcı)',
    head: '',
    pack: 'html',
    limit: 5 * 1024 * 1024,
  },
  // Vitrine gömülen sürüm: preview ile aynı, ama FPS rozeti ve QA hook'u yok
  // (ikisi de __AD_NETWORK__ === 'preview' koşuluna bağlı).
  showcase: {
    label: 'Vitrin gömme',
    head: '',
    pack: 'html',
    limit: 5 * 1024 * 1024,
  },
  applovin: {
    label: 'AppLovin',
    head: MRAID_TAG,
    pack: 'html',
    limit: 5 * 1024 * 1024,
  },
  unity: {
    label: 'Unity Ads',
    head: MRAID_TAG,
    pack: 'html',
    limit: 5 * 1024 * 1024,
  },
  ironsource: {
    label: 'ironSource',
    head: MRAID_TAG,
    pack: 'zip',
    limit: 5 * 1024 * 1024,
  },
  mintegral: {
    label: 'Mintegral',
    head: MRAID_TAG,
    pack: 'zip',
    limit: 5 * 1024 * 1024,
  },
  moloco: {
    label: 'Moloco',
    head: MRAID_TAG,
    pack: 'html',
    limit: 5 * 1024 * 1024,
  },
  facebook: {
    label: 'Meta',
    head: '',
    pack: 'html',
    // Meta: paket 5MB ama index.html tek başına 2MB'ı geçmemeli.
    limit: 2 * 1024 * 1024,
  },
  google: {
    label: 'Google App campaigns',
    head: '<script src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>',
    pack: 'zip',
    limit: 5 * 1024 * 1024,
  },
  tiktok: {
    label: 'TikTok / Pangle',
    head: '<script src="https://sf16-muse-va.ibytedtos.com/obj/union-fe-nc-i18n/playable/sdk/playable-sdk.js"></script>',
    pack: 'zip',
    limit: 5 * 1024 * 1024,
    extra: {
      'config.json': JSON.stringify({ orientation: ['portrait', 'landscape'] }, null, 2),
    },
  },
};

export const STORE = {
  ios: 'https://apps.apple.com/app/id0000000000',
  android: 'https://play.google.com/store/apps/details?id=com.playablelab.mergedragons',
};
