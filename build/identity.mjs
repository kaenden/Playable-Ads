/**
 * Vitrinin künyesi: kim yaptı, nasıl ulaşılır.
 *
 * Metin `showcase/identity.json` içinde duruyor, şablonun içinde değil. Sebep:
 * aynı isim ve aynı iletişim satırı HEM tek dosya artifact'ında HEM sitede
 * görünüyor. İki yerde ayrı ayrı güncellenmesi gereken bir isim er ya da geç
 * ayrışır — sayfadaki boyut sayılarını da bu yüzden dist'ten okuyoruz.
 *
 * Boş bırakılan alan basılmıyor; yarım bir "LinkedIn" düğmesi olmuyor.
 * İsim boşsa davranış iki çıktıda BİLEREK farklı:
 *
 *   artifact -> görünür bir "eksik" rozetiyle çıkıyor. Çalışma kopyası bu;
 *               eksik olduğu gözden kaçmasın diye sayfanın en üstünde duruyor.
 *   site     -> DERLENMİYOR. Yayına giden kopyanın tek zorunlu alanı isim:
 *               kimin yaptığı yazmayan bir portfolyo başvuruda işe yaramıyor.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadIdentity(root) {
  const raw = JSON.parse(readFileSync(join(root, 'showcase', 'identity.json'), 'utf8'));
  const id = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_')) continue;
    id[k] = typeof v === 'string' ? v.trim() : v;
  }
  return id;
}

function esc(t) {
  return String(t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Bir bağlantının insan tarafını gösteren etiket: adres değil, adı. */
function chip(href, label) {
  return '<a href="' + esc(href) + '"' +
    (href.startsWith('http') ? ' target="_blank" rel="noopener"' : '') +
    '>' + esc(label) + '</a>';
}

/** Hiç bağlantı yoksa boş bir <nav> bırakmıyoruz. */
function nav(id, withRepo) {
  const l = links(id, withRepo);
  return l ? '<nav class="lk" aria-label="Contact">\n      ' + l + '\n    </nav>' : '';
}

function links(id, withRepo) {
  const out = [];
  if (id.email) out.push(chip('mailto:' + id.email, id.email));
  if (id.github) out.push(chip(id.github, 'GitHub'));
  if (id.linkedin) out.push(chip(id.linkedin, 'LinkedIn'));
  if (id.cv) out.push(chip(id.cv, 'CV'));
  if (withRepo && id.repo) out.push(chip(id.repo, 'Source of this page'));
  return out.join('\n      ');
}

/**
 * @param {object} id      loadIdentity() çıktısı
 * @param {boolean} strict Site derlemesi mi? Öyleyse isimsiz sayfa hata.
 */
export function identityVars(id, strict) {
  if (strict && !id.name) {
    console.error(
      '\n  showcase/identity.json icinde "name" bos.\n' +
      '  Yayina giden sayfa isimsiz olmamali; doldurup tekrar calistir.\n'
    );
    process.exit(1);
  }

  const who = id.name
    ? '<span class="nm">' + esc(id.name) + '</span>'
    : '<span class="todo">showcase/identity.json &rarr; name</span>';

  const sub = [id.role, id.location].filter(Boolean).map(esc).join(' &middot; ');

  const topbar =
    '<header class="top">\n' +
    '  <div class="wrap topbar">\n' +
    '    <div class="who">\n' +
    '      ' + who + '\n' +
    (sub ? '      <span class="rl">' + sub + '</span>\n' : '') +
    '    </div>\n' +
    '    ' + nav(id, false) + '\n' +
    '  </div>\n' +
    '</header>';

  const contact =
    '<section class="contact">\n' +
    '  <div class="wrap">\n' +
    '    <p class="eyebrow">Contact</p>\n' +
    '    <div class="row">\n' +
    '      <div class="say">\n' +
    '        <h2>' + (id.name ? esc(id.name) : 'Add a name in showcase/identity.json') + '</h2>\n' +
    (id.pitch ? '        <p>' + esc(id.pitch) + '</p>\n' : '') +
    '      </div>\n' +
    '      ' + nav(id, true) + '\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</section>';

  return { '%%TOPBAR%%': topbar, '%%CONTACT%%': contact };
}
