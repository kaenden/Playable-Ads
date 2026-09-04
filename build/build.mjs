/**
 * Tek dosya playable build pipeline.
 *
 *   node build/build.mjs              -> tüm ağlar
 *   node build/build.mjs --net unity  -> tek ağ
 *   node build/build.mjs --dev        -> watch + localhost:8080 (preview)
 *
 * Yaptığı iş: esbuild ile TS'i tek IIFE bundle'a çevir, ağa özel head script'lerini
 * ve CTA dalını define ile göm, her şeyi index.html içine inline et, boyut bütçesini
 * kontrol et, gerekli ağlar için zip üret.
 */
import esbuild from 'esbuild';
import { createServer } from 'node:http';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  statSync,
} from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { NETWORKS, STORE } from './networks.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const TEMPLATE = join(SRC, 'index.html');

/** Playable'lar: aynı core, farklı renderer. */
const PLAYABLES = {
  'merge-2d': { entry: 'playables/merge-2d/main.ts', title: 'Merge Dragons — Playable' },
  'merge-3d': { entry: 'playables/merge-3d/main.ts', title: 'Merge Dragons 3D — Playable' },
  'escape-3d': {
    entry: 'playables/escape-3d/main.ts',
    title: 'Traffic Escape — Playable',
    // `--art atlas` ile derlenince prosedürel araçların yerine müşteri
    // modelleri (Kenney Car Kit, CC0) geliyor. `glbVariant` = sadece o
    // bayrakla gömülür; `glb` ise her zaman.
    glbVariant: ['out-3d-cars', 'cars.glb'],
  },
  // Bu birimde atlas SEÇENEK değil, sanatın kendisi: müşteri asset'iyle
  // çalışan gerçek akış bu. `atlas` alanı hangi hat çıktısının gömüleceğini
  // söylüyor, `--art` bayrağından bağımsız.
  'defense-2d': {
    entry: 'playables/defense-2d/main.ts',
    title: 'Tower Rush — Playable',
    atlas: 'out-2d-td',
  },
  // Aynı match-3, iki renderer. İkisi de AYNI sanatı kullanıyor: 3D sürüm
  // modelleri, 2D sürüm o modellerin offline render'ı olan sprite'ları.
  'match-2d': {
    entry: 'playables/match/main2d.ts',
    title: 'Order Up — Playable',
    atlas: 'out-2d-food',
  },
  'match-3d': {
    entry: 'playables/match/main3d.ts',
    title: 'Order Up 3D — Playable',
    // HUD ikonu 2D canvas'ta çiziliyor, o yüzden 3D sürüm de küçük atlası
    // gömüyor (11 KB). Modeli HUD için ayrıca render etmek pahalı olurdu.
    atlas: 'out-2d-food',
    glb: ['out-3d-food', 'food.glb'],
  },
  // Runner. Tek GLB'de 15 model: animasyonlu karakter + koridorun doğa
  // parçaları. 2D atlas YOK — HUD'un tamamı canvas'ta çiziliyor, o yüzden
  // bu birim tek bir görsel dosyası bile taşımıyor (karakter dokusu hariç).
  'run-3d': {
    entry: 'playables/run-3d/main.ts',
    title: 'Gate Crashers — Playable',
    glb: ['out-3d-run', 'run.glb'],
  },
  // AYNI PAKET, BAŞKA SEÇİM. Blade Rush, Gate Crashers'ın koridorunu, kamerasını,
  // instancing düzenini ve derlemesini paylaşıyor; değişen şey mekanik ve
  // AYNI KİTTEN YAPILAN SEÇİM. Aynı Kenney paketlerinden farklı modeller
  // çekiliyor: çam yerine palmiye, çiçek yerine küp ve oberlisk, ve
  // karakterlerden göz bantlı olanı.
  //
  // İkisini yan yana koymak bu vitrinin ikinci kontrollü karşılaştırması:
  // ilki "aynı oyun, iki renderer", bu "aynı hat ve aynı kit, iki oyun".
  'strike-3d': {
    entry: 'playables/strike-3d/main.ts',
    title: 'Blade Rush — Playable',
    glb: ['out-3d-isle', 'isle.glb'],
  },
};

const argv = process.argv.slice(2);
const DEV = argv.includes('--dev');
const netArg = argv.indexOf('--net') >= 0 ? argv[argv.indexOf('--net') + 1] : null;
const plArg = argv.indexOf('--pl') >= 0 ? argv[argv.indexOf('--pl') + 1] : null;
/** 'proc' (prosedürel çizim) veya 'atlas' (optimize WebP atlası). */
const ART = argv.indexOf('--art') >= 0 ? argv[argv.indexOf('--art') + 1] : 'proc';

/**
 * Atlas verisi bundle'a gömülüyor.
 *
 * İki yol var: `--art atlas` bayrağı (merge birimlerinin asset varyantı) ve
 * playable'ın kendi `atlas` alanı (asset'siz çalışamayan birimler). İkincisi
 * bayrağa bakmıyor — o birim için atlas zorunlu.
 *
 * Format sabit değil: hat kazananı seçiyor ve bu sanat tarzına göre değişiyor
 * (bizim gradient'li sprite'larımızda WebP, Kenney'nin düz paletinde PNG-8).
 * O yüzden uzantı aranıyor, varsayılmıyor.
 */
const ATLAS_EXT = ['png', 'webp', 'avif'];

function atlasFrom(dirName) {
  const dir = join(ROOT, 'assets-lab', dirName);
  const meta = join(dir, 'atlas.json');
  const img = ATLAS_EXT.map((e) => join(dir, 'atlas.' + e)).find((f) => existsSync(f));
  if (!img || !existsSync(meta)) {
    console.error('Atlas yok: ' + dir);
    console.error('Once ilgili `npm run assets:*` komutunu calistir.');
    process.exit(1);
  }
  return {
    b64: readFileSync(img).toString('base64'),
    frames: JSON.stringify(JSON.parse(readFileSync(meta, 'utf8')).frames),
  };
}

function glbFrom(parts) {
  const p = join(ROOT, 'assets-lab', ...parts);
  if (!existsSync(p)) {
    console.error('GLB yok: ' + p);
    console.error('Once ilgili `npm run assets:*` komutunu calistir.');
    process.exit(1);
  }
  return readFileSync(p).toString('base64');
}

/**
 * GLB'nin yanindaki palet dokusu (varsa). Ayri tasinmasinin sebebi
 * globals.d.ts'te. `n` kacinci palet: sahnede iki dokulu model varsa
 * (Blade Rush: korsan + zombi) hat palette.webp ve palette2.webp uretiyor.
 */
function paletteFrom(parts, n) {
  const dir = join(ROOT, 'assets-lab', parts[0]);
  const base = !n || n === 1 ? 'palette' : 'palette' + n;
  for (const ext of ['webp', 'png', 'avif']) {
    const p = join(dir, base + '.' + ext);
    if (existsSync(p)) return readFileSync(p).toString('base64');
  }
  return '';
}

function atlasData(playable) {
  const P = PLAYABLES[playable];
  // Asset'i zorunlu olan birimler: bayraktan bağımsız her zaman gömülür.
  if (P.atlas || P.glb) {
    return {
      ...(P.atlas ? atlasFrom(P.atlas) : { b64: '', frames: '{}' }),
      glb: P.glb ? glbFrom(P.glb) : '',
      palette: P.glb ? paletteFrom(P.glb, 1) : '',
      palette2: P.glb ? paletteFrom(P.glb, 2) : '',
      palette3: P.glb ? paletteFrom(P.glb, 3) : '',
    };
  }
  if (ART !== 'atlas') {
    return { b64: '', frames: '{}', glb: '', palette: '', palette2: '', palette3: '' };
  }
  // Sadece 3D asset kullanan birim 2D atlası da gömmemeli.
  if (P.glbVariant) {
    return {
      b64: '', frames: '{}',
      glb: glbFrom(P.glbVariant),
      palette: paletteFrom(P.glbVariant, 1),
      palette2: paletteFrom(P.glbVariant, 2),
      palette3: paletteFrom(P.glbVariant, 3),
    };
  }
  const glb = join(ROOT, 'assets-lab', 'out-3d', 'creatures.opt.glb');
  return {
    ...atlasFrom('out-2d'),
    glb: existsSync(glb) ? readFileSync(glb).toString('base64') : '',
    palette: '',
    palette2: '',
    palette3: '',
  };
}

async function bundle(playable, network, minify) {
  const ATLAS = atlasData(playable);
  const out = await esbuild.build({
    entryPoints: [join(SRC, PLAYABLES[playable].entry)],
    bundle: true,
    write: false,
    format: 'iife',
    target: ['es2018', 'safari12'],
    minify,
    legalComments: 'none',
    define: {
      __AD_NETWORK__: JSON.stringify(network),
      __STORE_IOS__: JSON.stringify(STORE.ios),
      __STORE_ANDROID__: JSON.stringify(STORE.android),
      __ART__: JSON.stringify(ART),
      __ATLAS_B64__: JSON.stringify(ATLAS.b64),
      __ATLAS_FRAMES__: JSON.stringify(ATLAS.frames),
      __GLB_B64__: JSON.stringify(ATLAS.glb),
      __PALETTE_B64__: JSON.stringify(ATLAS.palette || ''),
      __PALETTE2_B64__: JSON.stringify(ATLAS.palette2 || ''),
      __PALETTE3_B64__: JSON.stringify(ATLAS.palette3 || ''),
    },
    loader: { '.png': 'dataurl', '.webp': 'dataurl', '.mp3': 'dataurl', '.svg': 'dataurl' },
  });
  return out.outputFiles[0].text;
}

function html(playable, network, js) {
  const cfg = NETWORKS[network];
  const tpl = readFileSync(TEMPLATE, 'utf8');
  // </script> bundle içinde geçerse HTML parser script'i erken kapatır.
  const safe = js.replace(/<\/script>/gi, '<\\/script>');
  return tpl
    .replace('%%TITLE%%', () => PLAYABLES[playable].title)
    .replace('%%HEAD%%', () => cfg.head)
    .replace('%%BUNDLE%%', () => safe);
}

function zip(dir, dest) {
  try {
    const q = (s) => "'" + s.replace(/'/g, "''") + "'";
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Compress-Archive -Path ${q(join(dir, '*'))} -DestinationPath ${q(dest)} -Force`,
      ],
      { stdio: 'ignore' }
    );
    return statSync(dest).size;
  } catch {
    return -1;
  }
}

const kb = (n) => (n / 1024).toFixed(1) + ' KB';

async function buildNetwork(playable, network) {
  const cfg = NETWORKS[network];
  const js = await bundle(playable, network, true);
  const page = html(playable, network, js);
  const suffix = PLAYABLES[playable].atlas || PLAYABLES[playable].glb ? '' : ART === 'atlas' ? '-atlas' : '';
  const dir = join(DIST, playable + suffix, network);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page);
  if (cfg.extra) for (const [name, body] of Object.entries(cfg.extra)) writeFileSync(join(dir, name), body);

  const bytes = Buffer.byteLength(page);
  let zipBytes = null;
  if (cfg.pack === 'zip') zipBytes = zip(dir, join(DIST, playable + suffix, network + '.zip'));

  return { playable, network, label: cfg.label, bytes, zipBytes, limit: cfg.limit, pack: cfg.pack };
}

function report(rows) {
  const W = 46;
  console.log('\n  AĞ                 index.html    zip        bütçe (5MB/2MB)');
  console.log('  ' + '-'.repeat(66));
  let fail = false;
  for (const r of rows) {
    const pct = r.bytes / r.limit;
    const filled = Math.max(1, Math.round(pct * W));
    const bar = '#'.repeat(Math.min(filled, W)) + '.'.repeat(Math.max(0, W - filled));
    const z = r.pack === 'zip' ? (r.zipBytes > 0 ? kb(r.zipBytes) : 'zip yok') : '-';
    const over = pct > 1;
    if (over) fail = true;
    console.log(
      '  ' +
        r.network.padEnd(18) +
        kb(r.bytes).padStart(10) +
        '  ' +
        z.padStart(9) +
        '   ' +
        (pct * 100).toFixed(2).padStart(6) +
        '%' +
        (over ? '  <-- LIMIT AŞILDI' : '')
    );
    console.log('  ' + ' '.repeat(18) + '[' + bar + ']');
  }
  return fail;
}

async function buildAll() {
  const nets = netArg ? [netArg] : Object.keys(NETWORKS);
  const pls = plArg ? [plArg] : Object.keys(PLAYABLES);
  // Sadece üretilen playable+AĞ kombinasyonları temizleniyor. Önce tüm dist,
  // sonra tüm varyant klasörü siliniyordu; ikisi de --net ile tek ağ derlerken
  // aynı varyantın diğer ağ çıktılarını uçuruyordu.
  for (const p of pls) {
    for (const n of nets) {
      const d = join(DIST, p + (PLAYABLES[p].atlas || PLAYABLES[p].glb ? '' : ART === 'atlas' ? '-atlas' : ''), n);
      if (existsSync(d)) rmSync(d, { recursive: true, force: true });
    }
  }
  for (const n of nets) {
    if (!NETWORKS[n]) {
      console.error('Bilinmeyen ağ: ' + n + '  (' + Object.keys(NETWORKS).join(', ') + ')');
      process.exit(1);
    }
  }
  for (const p of pls) {
    if (!PLAYABLES[p]) {
      console.error('Bilinmeyen playable: ' + p + '  (' + Object.keys(PLAYABLES).join(', ') + ')');
      process.exit(1);
    }
  }
  const t0 = Date.now();
  let fail = false;
  let count = 0;
  for (const p of pls) {
    const rows = [];
    for (const n of nets) rows.push(await buildNetwork(p, n));
    console.log('\n  === ' + p + ' ===');
    if (report(rows)) fail = true;
    count += rows.length;
  }
  console.log('\n  ' + count + ' paket, ' + (Date.now() - t0) + 'ms -> dist/\n');
  if (fail) process.exit(1);
}

async function dev() {
  const playable = plArg || 'merge-2d';
  const dir = join(DIST, playable + (PLAYABLES[playable].atlas || PLAYABLES[playable].glb ? '' : ART === 'atlas' ? '-atlas' : ''), 'preview');
  mkdirSync(dir, { recursive: true });
  let building = false;

  async function rebuild() {
    if (building) return;
    building = true;
    try {
      const js = await bundle(playable, 'preview', false);
      writeFileSync(join(dir, 'index.html'), html(playable, 'preview', js));
      console.log('  build ok  ' + kb(statSync(join(dir, 'index.html')).size) + '  ' + new Date().toLocaleTimeString());
    } catch (e) {
      console.error('  build hatası:\n' + (e.message || e));
    }
    building = false;
  }

  await rebuild();

  const ctx = await esbuild.context({
    entryPoints: [join(SRC, PLAYABLES[playable].entry)],
    bundle: true,
    write: false,
    outdir: dir,
    plugins: [
      {
        name: 'rebuild-html',
        setup(b) {
          b.onEnd(() => rebuild());
        },
      },
    ],
  });
  await ctx.watch();

  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
  createServer((req, res) => {
    const p = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const file = join(dir, p);
    if (!existsSync(file)) {
      res.writeHead(404);
      res.end('404');
      return;
    }
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(file));
  }).listen(8080, () => {
    console.log('\n  dev  ->  http://localhost:8080   (telefonda test için: http://<LAN-IP>:8080)\n');
  });
}

if (DEV) dev();
else buildAll();
