/**
 * Telefon test sunucusu — dist/ klasörünü LAN'a açar ve kök dizinde
 * dokunmatik dostu bir menü üretir.
 *
 *   node build/serve.mjs            -> 0.0.0.0:8080
 *   node build/serve.mjs --port 9000
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const argv = process.argv.slice(2);
const PORT = argv.indexOf('--port') >= 0 ? +argv[argv.indexOf('--port') + 1] : 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.webp': 'image/webp',
  '.png': 'image/png',
};

function lanIps() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}

function kb(n) {
  return (n / 1024).toFixed(1) + ' KB';
}

function menu() {
  const playables = existsSync(DIST)
    ? readdirSync(DIST).filter((d) => statSync(join(DIST, d)).isDirectory())
    : [];
  const cards = playables
    .map((p) => {
      const f = join(DIST, p, 'preview', 'index.html');
      const size = existsSync(f) ? kb(statSync(f).size) : '—';
      return `<a class="card" href="/${p}/preview/index.html">
          <div class="name">${p}</div>
          <div class="meta">${size} · preview build</div>
        </a>`;
    })
    .join('\n');

  return `<!DOCTYPE html><html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Playable Ads Lab — cihaz testi</title>
<style>
:root{color-scheme:dark}
body{margin:0;padding:24px 18px;background:#0f1230;color:#eef;
  font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
h1{font-size:20px;margin:0 0 4px}
p{color:#a9b0dd;margin:0 0 22px;font-size:14px}
.card{display:block;background:#1b1f52;border:1px solid #2e3474;border-radius:14px;
  padding:18px;margin-bottom:14px;text-decoration:none;color:#fff}
.card:active{background:#252a68}
.name{font-weight:800;font-size:18px}
.meta{color:#98a0d8;font-size:13px;margin-top:4px}
.tip{margin-top:26px;padding:14px;border-radius:12px;background:#161a40;
  color:#9aa2d4;font-size:13px}
b{color:#5fe0a0}
</style></head><body>
<h1>Playable Ads Lab</h1>
<p>Cihaz testi. Sol üstteki kutuda <b>FPS</b> ve <b>ilk kare süresi</b> yazıyor.</p>
${cards}
<div class="tip">
Ölçerken: sayfayı aç, <b>2 saniye bekle</b> (açılış jank'i sayılmıyor), sonra
birkaç merge yap ve <b>min FPS</b> değerine bak. Telefonu yatay çevirip de dene.
</div>
</body></html>`;
}

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(menu());
    return;
  }
  // Klasör isteğinde index.html: `dist/site/` çıktısındaki adresler
  // `/u/gate-crashers/` biçiminde ve gerçek statik host'ların hepsi bunu
  // böyle çözüyor. Yerel sunucu da aynı davranmalı, yoksa siteyi
  // yayınlamadan önce deneyemiyoruz.
  let file = join(DIST, url);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('404');
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(readFileSync(file));
}).listen(PORT, '0.0.0.0', () => {
  console.log('\n  Telefondan aç:');
  for (const ip of lanIps()) console.log('    http://' + ip + ':' + PORT);
  console.log('\n  (Aynı Wi-Fi ağında olmalısın. Windows Firewall sorarsa izin ver.)\n');
});
