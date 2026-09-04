/**
 * Logo üretimi — yerelde çalışan InvokeAI üzerinden FLUX.2 Klein.
 *
 *   node build/logo-gen.mjs                 iki logoyu da 4 varyantla üretir
 *   node build/logo-gen.mjs --unit run-3d   sadece birini
 *   node build/logo-gen.mjs --lora 0.6      ikon LoRA'sını da bindirir
 *
 * NEDEN KOD, NEDEN ARAYÜZ DEĞİL. Vitrindeki her şey tek komutla yeniden
 * üretilebiliyor: paketler, kapaklar, site, banner. Logoyu elle çizip
 * klasöre atmak o zincirin dışında kalan tek şey olurdu. Bu dosya çıktıyı
 * TOHUMA bağlıyor — aynı komut aynı dört varyantı veriyor, yani "hangisini
 * seçmiştik" sorusu bir daha sorulmuyor.
 *
 * GRAF ELLE KURULUYOR. Invoke'un arayüzünde iş akışını tıklayarak kurmak
 * mümkün ama o iş akışı JSON'u sürümle birlikte kırılıyor; API'nin kendi
 * şemasından okunan düğüm adları (`/openapi.json`) daha dayanıklı çıktı.
 *
 * MAGENTA ANAHTAR. Flux saydam arka plan üretemiyor. Logo düz macenta
 * üstünde isteniyor ve burada anahtarlanıyor: macentaya yakın pikseller
 * saydamlaşıyor, kenardaki mor saçak da geri çekiliyor. Bu, yeşil perdenin
 * aynısı — sadece yeşil, logonun kendi renginde çıkabileceği için macenta.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'assets-lab', 'logos');
const API = process.env.INVOKE_URL || 'http://127.0.0.1:9090';

const argv = process.argv.slice(2);
const argS = (k, d) => (argv.indexOf(k) >= 0 ? argv[argv.indexOf(k) + 1] : d);
const UNIT = argS('--unit', null);
const LORA_W = argv.indexOf('--lora') >= 0 ? +argS('--lora', 0.6) : 0;

/** Arka plan anahtar rengi. Logoda asla kullanılmayacak bir ton. */
const KEY_RGB = [255, 0, 255];

/**
 * İstenen logolar.
 *
 * Prompt'lar SAHNE değil MARKA tarif ediyor: "oyun görüntüsü" istemek
 * ekran görüntüsü gibi bir şey veriyor, oysa gereken şey kapak yazısı.
 * Her ikisinde de aynı iskelet var — kalın harf, beyaz kontur, koyu gölge,
 * düz zemin — değişen sadece renk ailesi ve tek bir sembol. İki kardeş
 * birimin logosu da bu yüzden aynı aileden çıkıyor.
 */
const LOGOS = {
  'run-3d': {
    file: 'gate-crashers',
    prompt:
      'mobile game logo wordmark, the words "GATE CRASHERS" in two stacked lines, ' +
      'bold chunky rounded 3D beveled letters, glossy candy finish, thick white ' +
      'outline and dark forest green drop shadow, vivid grass green to sunny ' +
      'golden yellow gradient on the letters, a smashed wooden gate with ' +
      'splintered broken planks behind the wordmark, a row of tiny blocky runner ' +
      'silhouettes charging through the gap along the bottom edge, clean flat ' +
      'vector illustration, sharp edges, centered composition, isolated on a ' +
      'solid flat magenta background, no scenery, no photo, casual hyper-casual ' +
      'mobile game branding, high contrast, crisp',
  },
  /**
   * Match-3 çifti tek logoyu paylaşıyor: aynı oyunun iki çizicisi.
   *
   * PERDE BURADA YEŞİL, MACENTA DEĞİL. Anahtarlama ölçütü "macentalık"
   * (kırmızı ve mavi yüksek, yeşil düşük) ve bu logonun kendi harfleri
   * pembe — yani macenta perdede logonun yarısı silinirdi. Yeşil perde
   * tam tersini ölçüyor ve pembe, altın, beyazın hepsi güvende kalıyor.
   * Prompt bu yüzden "yeşil öge yok" diyor.
   */
  'match-3d': {
    file: 'order-up',
    key: 'green',
    prompt:
      'mobile game logo wordmark, the words "ORDER UP" in two stacked lines, ' +
      'bold chunky rounded 3D beveled letters, glossy candy finish, thick white ' +
      'outline and deep raspberry drop shadow, hot pink to golden yellow gradient ' +
      'on the letters, a pink frosted donut and a cupcake with a cherry tucked ' +
      'behind the wordmark, colourful sprinkles scattered around, no green ' +
      'elements, clean flat vector illustration, sharp edges, centered ' +
      'composition, isolated on a solid flat pure green background, no scenery, ' +
      'no photo, casual hyper-casual mobile game branding, high contrast, crisp',
  },
  'strike-3d': {
    file: 'blade-rush',
    prompt:
      'mobile game logo wordmark, the words "BLADE RUSH" in two stacked lines, ' +
      'bold chunky rounded 3D beveled letters, glossy finish, thick white outline ' +
      'and deep navy drop shadow, golden yellow to turquoise gradient on the ' +
      'letters, two crossed pirate cutlasses behind the wordmark, a small palm ' +
      'leaf accent, clean flat vector illustration, sharp edges, centered ' +
      'composition, isolated on a solid flat magenta background, no scenery, ' +
      'no photo, casual hyper-casual mobile game branding, high contrast, crisp',
  },
};

const SEEDS = [101, 202, 303, 404];

async function api(path, opts) {
  const res = await fetch(API + path, opts);
  if (!res.ok) throw new Error(path + ' -> ' + res.status + ' ' + (await res.text()).slice(0, 300));
  return res;
}

/** Modelin kimlik alanı: anahtar + hash + ad + taban + tip. */
function ident(m) {
  return { key: m.key, hash: m.hash, name: m.name, base: m.base, type: m.type };
}

async function models() {
  const j = await (await api('/api/v2/models/')).json();
  const pick = (type, base) => j.models.find((m) => m.type === type && (!base || m.base === base));
  const main = pick('main', 'flux2');
  const vae = pick('vae', 'flux2');
  const enc = pick('qwen3_encoder');
  const lora = j.models.find((m) => m.type === 'lora' && m.base === 'flux2');
  if (!main || !vae || !enc) {
    throw new Error('FLUX.2 modelleri eksik: main/vae/qwen3_encoder üçü de gerekli.');
  }
  return { main, vae, enc, lora };
}

/**
 * Graf: model yükle -> (LoRA) -> metni kodla -> gürültüyü çöz -> VAE ile aç.
 *
 * `flux2_denoise` düğümü genişlik/yükseklik ve tohumu kendi alıyor; ayrı bir
 * gürültü düğümü gerekmiyor. Tohum toplu iş verisinden geliyor, yani tek
 * kuyruk kaydı dört varyant üretiyor.
 */
function graph(m, prompt, w, h) {
  const g = {
    id: 'logo',
    nodes: {
      loader: {
        id: 'loader',
        type: 'flux2_klein_model_loader',
        model: ident(m.main),
        vae_model: ident(m.vae),
        qwen3_encoder_model: ident(m.enc),
      },
      text: { id: 'text', type: 'flux2_klein_text_encoder', prompt },
      den: {
        id: 'den',
        type: 'flux2_denoise',
        width: w,
        height: h,
        num_steps: 9,
        guidance: 4,
        cfg_scale: 1,
        seed: SEEDS[0],
      },
      dec: { id: 'dec', type: 'flux2_vae_decode', is_intermediate: false },
    },
    edges: [
      e('loader', 'qwen3_encoder', 'text', 'qwen3_encoder'),
      e('loader', 'max_seq_len', 'text', 'max_seq_len'),
      e('loader', 'transformer', 'den', 'transformer'),
      e('text', 'conditioning', 'den', 'positive_text_conditioning'),
      e('den', 'latents', 'dec', 'latents'),
      // VAE İKİ YERE BAĞLANIYOR. `flux2_denoise` de VAE istiyor (görüntü
      // boyutunu latent boyutuna çevirmek için); bağlamayınca kuyruk
      // "missing connections for field vae" diye düşüyor.
      e('loader', 'vae', 'den', 'vae'),
      e('loader', 'vae', 'dec', 'vae'),
    ],
  };
  if (LORA_W > 0 && m.lora) {
    g.nodes.lora = {
      id: 'lora',
      type: 'flux2_klein_lora_loader',
      lora: ident(m.lora),
      weight: LORA_W,
    };
    // LoRA araya giriyor: yükleyici -> lora -> (metin, denoise)
    g.edges = [
      e('loader', 'transformer', 'lora', 'transformer'),
      e('loader', 'qwen3_encoder', 'lora', 'qwen3_encoder'),
      e('lora', 'qwen3_encoder', 'text', 'qwen3_encoder'),
      e('loader', 'max_seq_len', 'text', 'max_seq_len'),
      e('lora', 'transformer', 'den', 'transformer'),
      e('text', 'conditioning', 'den', 'positive_text_conditioning'),
      e('den', 'latents', 'dec', 'latents'),
      e('loader', 'vae', 'den', 'vae'),
      e('loader', 'vae', 'dec', 'vae'),
    ];
  }
  return g;
}

function e(fromNode, fromField, toNode, toField) {
  return { source: { node_id: fromNode, field: fromField }, destination: { node_id: toNode, field: toField } };
}

async function enqueue(g) {
  const body = {
    prepend: false,
    batch: {
      graph: g,
      runs: 1,
      // Dört tohum tek kayıtta: aynı prompt, dört varyant.
      data: [[{ node_path: 'den', field_name: 'seed', items: SEEDS }]],
    },
  };
  const j = await (
    await api('/api/v1/queue/default/enqueue_batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  ).json();
  return j.batch.batch_id;
}

async function waitFor(batchId, label) {
  let last = -1;
  for (let i = 0; i < 900; i++) {
    const s = await (await api('/api/v1/queue/default/b/' + batchId + '/status')).json();
    const done = s.completed + s.failed + s.canceled;
    if (done !== last) {
      process.stdout.write('\r  ' + label + '  ' + done + '/' + s.total + ' tamam' + (s.failed ? '  ' + s.failed + ' hata' : '') + '   ');
      last = done;
    }
    if (done >= s.total) {
      process.stdout.write('\n');
      return s;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('zaman aşımı: ' + label);
}

/**
 * Bu toplu işten çıkan görsel adları, tohum sırasıyla.
 *
 * Görsel listesi uçları toplu iş kimliğini taşımıyor; ilişki KUYRUK
 * KAYDINDA duruyor. Her tamamlanmış kaydın `session.results` sözlüğünde
 * çıkış düğümünün (dec) sonucu var ve görsel adı orada.
 */
async function imagesOf(batchId) {
  const j = await (await api('/api/v1/queue/default/list_all')).json();
  const items = (Array.isArray(j) ? j : j.items || [])
    .filter((it) => it.batch_id === batchId && it.status === 'completed')
    .sort((a, b) => a.item_id - b.item_id);
  // Invoke düğüm kimliklerini kendi UUID'leriyle yeniden yazıyor, yani
  // sonucu 'dec' anahtarıyla aramak boş dönüyor. Doğru ölçüt ÇIKTI TİPİ:
  // sözlükteki tek `image_output` bizim çözücümüzün sonucu.
  const out = [];
  for (const it of items) {
    const r = (it.session && it.session.results) || {};
    for (const k in r) {
      if (r[k] && r[k].type === 'image_output' && r[k].image) out.push(r[k].image.image_name);
    }
  }
  return out;
}

async function download(name, dest) {
  const res = await api('/api/v1/images/i/' + name + '/full');
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  const m = await models();
  console.log('\n  InvokeAI  ' + API);
  console.log('  model     ' + m.main.name + (LORA_W > 0 && m.lora ? '  + LoRA ' + m.lora.name + ' @' + LORA_W : ''));
  console.log('  encoder   ' + m.enc.name + '\n');

  const units = UNIT ? [UNIT] : Object.keys(LOGOS);
  for (const u of units) {
    const cfg = LOGOS[u];
    if (!cfg) {
      console.error('bilinmeyen birim: ' + u);
      process.exit(1);
    }
    const batchId = await enqueue(graph(m, cfg.prompt, 1024, 1024));
    await waitFor(batchId, cfg.file);
    const imgs = await imagesOf(batchId);
    if (!imgs.length) throw new Error('bu toplu isten goruntu cikmadi: ' + batchId);
    for (let i = 0; i < imgs.length; i++) {
      const dest = join(OUT, cfg.file + '-' + (i + 1) + '.png');
      await download(imgs[i], dest);
      console.log('  -> ' + dest);
    }
  }
  console.log('\n  Anahtarlama icin: node build/logo-key.mjs\n');
}

export { KEY_RGB, OUT };

main().catch((err) => {
  console.error('\n  HATA: ' + err.message + '\n');
  process.exit(1);
});
