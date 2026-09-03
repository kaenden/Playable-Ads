/**
 * Platform uyumluluk denetimi — paketleri yüklemeden önce statik kontrol.
 *
 *   npm run preflight
 *
 * Gerçek validator'lar (AppLovin Playable Preview, Meta, Google) hesap
 * gerektiriyor. Ama reddedilmelerin büyük kısmı dokümante edilmiş, statik
 * olarak kontrol edilebilir kurallardan geliyor: dış istek, boyut, eksik
 * CTA API'si, yasak tarayıcı API'leri. Bu araç onları paket paket tarıyor.
 *
 * Kaynak: her ağın kendi creative spec dokümanı (bkz. 00-RESEARCH.md §2).
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NETWORKS } from './networks.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');

const kb = (n) => (n / 1024).toFixed(1) + ' KB';

/** Ağların head'de izin verdiği tek dış kaynak. Bunun dışındaki her URL red sebebi. */
const ALLOWED_HOSTS = {
  google: ['tpc.googlesyndication.com'],
  tiktok: ['sf16-muse-va.ibytedtos.com'],
};

/** Ad container'ında çalışmayan ya da reddedilen tarayıcı API'leri. */
const FORBIDDEN = [
  ['document.write', 'document.write ad container\'ında belgeyi bozar'],
  ['localStorage', 'depolama API\'leri bazı webview\'larda exception atar'],
  ['sessionStorage', 'depolama API\'leri bazı webview\'larda exception atar'],
  ['indexedDB', 'depolama API\'leri bazı webview\'larda exception atar'],
  ['document.cookie', 'çerez erişimi reddedilir'],
  ['window.top', 'üst çerçeveye erişim cross-origin hatası verir'],
  ['ServiceWorker', 'service worker tek dosya creative\'de çalışmaz'],
];

function checkPackage(variant, network, dir) {
  const cfg = NETWORKS[network];
  const file = join(dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  const bytes = statSync(file).size;
  const issues = [];
  const ok = [];

  // --- boyut
  if (bytes > cfg.limit) issues.push(['FAIL', 'boyut ' + kb(bytes) + ' > limit ' + kb(cfg.limit)]);
  else ok.push('boyut ' + kb(bytes) + ' (limitin %' + ((bytes / cfg.limit) * 100).toFixed(1) + "'i)");

  // --- dış istekler
  //
  // DİKKAT: kaynakta URL geçmesi istek yapıldığı anlamına GELMİYOR. İlk sürüm
  // düz regex'le tarıyordu ve three.js içindeki XML namespace'i
  // (www.w3.org/1999/xhtml) ile bir yorumdaki akademik atıfı (jcgt.org) red
  // sebebi sayıp bütün 3D paketleri "RED" işaretledi. Artık sadece gerçekten
  // yükleme yapan konumlara bakılıyor.
  const allowed = ALLOWED_HOSTS[network] || [];
  const INERT = ['www.w3.org', 'jcgt.org', 'apps.apple.com', 'play.google.com'];
  const fetchable = [
    /<script[^>]+src=["'](https?:[^"']+)/gi,
    /<link[^>]+href=["'](https?:[^"']+)/gi,
    /<img[^>]+src=["'](https?:[^"']+)/gi,
    /\.src\s*=\s*["'](https?:[^"']+)/gi,
    /url\(\s*["']?(https?:[^"')]+)/gi,
    /(?:fetch|importScripts)\(\s*["'](https?:[^"']+)/gi,
  ];
  const bad = [];
  for (const re of fetchable) {
    let m;
    while ((m = re.exec(html))) {
      const host = m[1].replace(/^https?:\/\//, '').split('/')[0];
      if (INERT.indexOf(host) >= 0) continue;
      if (allowed.indexOf(host) >= 0) continue;
      bad.push(m[1]);
    }
  }
  if (bad.length) issues.push(['FAIL', 'izinsiz dış kaynak yükleniyor: ' + [...new Set(bad)].slice(0, 3).join(', ')]);
  else ok.push('yükleme yapan dış kaynak yok' + (allowed.length ? " (ağın kendi SDK'sı hariç)" : ''));

  // --- ağ isteği yapan API'ler
  for (const api of ['XMLHttpRequest', 'WebSocket', 'EventSource']) {
    if (html.includes(api)) issues.push(['FAIL', api + ' kullanımı — playable ağ isteği yapamaz']);
  }
  // fetch ayrı ele alınıyor: GLTFLoader'ın içinden geliyor. Biz .parse() ile
  // ArrayBuffer veriyoruz, o kod yolu hiç çağrılmıyor — ama katı bir tarayıcı
  // yine de işaretleyebilir. Red değil, yükleme öncesi bilinmesi gereken bir risk.
  if (html.includes('fetch(')) {
    issues.push(['WARN', "fetch( kodu var (GLTFLoader'dan gelir, .parse() kullanıldığı için çağrılmıyor) — katı tarayıcılar yine de işaretleyebilir"]);
  }

  // --- yasak API'ler
  for (const [needle, why] of FORBIDDEN) {
    if (html.includes(needle)) issues.push(['WARN', needle + ': ' + why]);
  }

  // --- ağa özel zorunluluklar
  if (network === 'google') {
    if (!/name=["']ad\.size["']/.test(html)) issues.push(['FAIL', 'ad.size meta etiketi yok — Google otomatik doğrulamada eler']);
    else ok.push('ad.size meta var');
    if (!html.includes('ExitApi')) issues.push(['FAIL', 'ExitApi.exit() çağrısı yok']);
    else ok.push('ExitApi CTA');
    const zip = join(dirname(dir), network + '.zip');
    if (!existsSync(zip)) issues.push(['WARN', 'ZIP üretilmemiş']);
    else ok.push('ZIP ' + kb(statSync(zip).size));
  } else if (network === 'facebook') {
    if (!html.includes('FbPlayableAd')) issues.push(['FAIL', 'FbPlayableAd.onCTAClick() yok']);
    else ok.push('FbPlayableAd CTA');
    if (html.includes('mraid')) issues.push(['WARN', 'Meta paketinde mraid izi var — gereksiz kod']);
    if (bytes > 2 * 1024 * 1024) issues.push(['FAIL', 'index.html 2MB üstü']);
  } else if (network === 'tiktok') {
    if (!html.includes('openAppStore')) issues.push(['FAIL', 'window.openAppStore() yok']);
    else ok.push('openAppStore CTA');
    if (!existsSync(join(dir, 'config.json'))) issues.push(['FAIL', 'config.json yok']);
    else ok.push('config.json var');
  } else if (network !== 'preview' && network !== 'showcase') {
    if (!html.includes('mraid')) issues.push(['FAIL', 'MRAID referansı yok']);
    else ok.push('MRAID CTA');
  }

  // --- genel sağlık
  if (!/name=["']viewport["']/.test(html)) issues.push(['FAIL', 'viewport meta yok']);
  if (!html.includes('orientationchange')) issues.push(['WARN', 'orientationchange dinlenmiyor — yön değişiminde layout bozulabilir']);
  if (/new\s+AudioContext|new\s+\w*\.?AudioContext/.test(html) && !html.includes('unlock')) {
    issues.push(['WARN', 'AudioContext etkileşim öncesi kuruluyor olabilir']);
  }

  // --- WebGL kullanan paketlerde geri düşüş var mı
  if (/webgl2?["']/.test(html) || html.includes('WebGLRenderer')) {
    // Marker olarak 'webglcontextlost' kullanmıştım — three.js kendi içinde
    // o listener'ı kaydediyor, yani her 3D paket "geri düşüşü var" görünüyordu.
    // Artık sadece BİZİM koyduğumuz işarete bakılıyor.
    if (!html.includes('WEBGL_FALLBACK')) {
      issues.push(['WARN', 'WebGL başarısız olursa geri düşüş yok — desteklemeyen cihazda boş ekran']);
    } else ok.push('WebGL geri düşüşü var');
  }

  return { variant, network, bytes, issues, ok };
}

// ---------------------------------------------------------------- çalıştır

if (!existsSync(DIST)) {
  console.error('dist/ yok. Önce `npm run build`.');
  process.exit(1);
}

const results = [];
for (const variant of readdirSync(DIST)) {
  const vdir = join(DIST, variant);
  if (!statSync(vdir).isDirectory()) continue;
  for (const network of readdirSync(vdir)) {
    const ndir = join(vdir, network);
    if (!statSync(ndir).isDirectory()) continue;
    if (!NETWORKS[network]) continue;
    if (!existsSync(join(ndir, 'index.html'))) continue;
    results.push(checkPackage(variant, network, ndir));
  }
}

let fails = 0;
let warns = 0;
console.log('\n  PLATFORM UYUMLULUK DENETİMİ — ' + results.length + ' paket\n');

const byVariant = {};
for (const r of results) (byVariant[r.variant] = byVariant[r.variant] || []).push(r);

for (const [variant, list] of Object.entries(byVariant)) {
  console.log('  ' + '='.repeat(70));
  console.log('  ' + variant);
  console.log('  ' + '='.repeat(70));
  for (const r of list) {
    const f = r.issues.filter((i) => i[0] === 'FAIL');
    const w = r.issues.filter((i) => i[0] === 'WARN');
    fails += f.length;
    warns += w.length;
    const mark = f.length ? 'RED  ' : w.length ? 'UYARI' : 'GEÇTİ';
    console.log('  ' + mark + '  ' + r.network.padEnd(12) + kb(r.bytes).padStart(10));
    for (const [, msg] of f) console.log('           x ' + msg);
    for (const [, msg] of w) console.log('           ! ' + msg);
  }
  console.log('');
}

console.log('  ' + '-'.repeat(70));
console.log('  ' + results.length + ' paket · ' + fails + ' red sebebi · ' + warns + ' uyarı');
console.log('\n  NOT: bu statik denetim, gerçek validator yerine geçmez. Ağların');
console.log('  kendi araçları (AppLovin Playable Preview, Meta ve Google validator)');
console.log('  hesap gerektiriyor ve yükleme öncesi son adım olarak kalıyor.\n');

if (fails) process.exit(1);
