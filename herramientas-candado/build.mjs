// Construye la app con candado: cifra el contenido y arma dist/
// Uso: node build.mjs <ACCESS_API> <BUY_URL> <CONTENT_KEY_B64>
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto as crypto } from 'node:crypto';

const [ACCESS_API, BUY_URL, KEY_B64] = process.argv.slice(2);
if (!ACCESS_API || !BUY_URL || !KEY_B64) { console.error('faltan argumentos'); process.exit(1); }

const SRC = 'src', OUT = 'dist', APP = '../app';
// Google Play: el archivo assetlinks.json se crea en el Paso 6 con la huella de la llave de firma.
// Si existe, se revisa aquí, antes de tocar dist/: si está mal escrito, la herramienta se detiene sin cambiar nada.
const ASSETLINKS = path.join(APP, '.well-known', 'assetlinks.json');
const HAS_ASSETLINKS = fs.existsSync(ASSETLINKS);
if (HAS_ASSETLINKS) {
  try { JSON.parse(fs.readFileSync(ASSETLINKS, 'utf8')); }
  catch (e) { console.error('assetlinks.json está mal escrito: ' + e.message); process.exit(1); }
}
let html = fs.readFileSync(path.join(SRC, 'index.src.html'), 'utf8');

const a = html.indexOf('<!--VAULT-START-->'), b = html.indexOf('<!--VAULT-END-->');
if (a < 0 || b < 0) throw new Error('sin marcas VAULT');
const secretHtml = html.slice(a + '<!--VAULT-START-->'.length, b);
html = html.slice(0, a) + '<div id="vault-slot"></div>' + html.slice(b + '<!--VAULT-END-->'.length);
const js0 = html.indexOf('function startApp(){');
const js1 = html.indexOf("try { if ('serviceWorker'", js0);
if (js0 < 0 || js1 < 0) throw new Error('sin startApp');
const secretJs = html.slice(js0, js1);
html = html.slice(0, js0) + html.slice(js1);
const secret = JSON.stringify({ html: secretHtml, js: secretJs });

const keyRaw = Uint8Array.from(Buffer.from(KEY_B64, 'base64'));
if (keyRaw.length !== 32) throw new Error('la llave debe ser de 32 bytes');
const key = await crypto.subtle.importKey('raw', keyRaw, 'AES-GCM', false, ['encrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secret)));
const blob = Buffer.concat([Buffer.from(iv), Buffer.from(enc)]).toString('base64');

const css = fs.readFileSync(path.join(SRC, 'lock.css'), 'utf8');
const lockHtml = fs.readFileSync(path.join(SRC, 'lock.html'), 'utf8').replace('__VAULT__', blob);
const js = fs.readFileSync(path.join(SRC, 'lock.js'), 'utf8')
  .replace('__ACCESS_API__', ACCESS_API.replace(/\/$/, ''))
  .replace('__BUY_URL__', BUY_URL);

html = html.replace('<!--LOCK-CSS-->', css)
           .replace('<!--LOCK-HTML-->', lockHtml)
           .replace('<!--LOCK-SCRIPT-->', '<script>\n' + js + '\n</script>');
for (const m of ['VAULT', 'LOCK-', '__ACCESS_API__', '__BUY_URL__', '__VAULT__'])
  if (html.includes(m)) throw new Error('quedó un marcador: ' + m);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(APP, 'img'), path.join(OUT, 'img'), { recursive: true });
for (const f of ['manifest.json', 'icon.svg', 'portada.jpg', 'portada-movil.jpg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'terminos.html', 'privacidad.html', 'compartir.jpg']) fs.copyFileSync(path.join(APP, f), path.join(OUT, f));
fs.writeFileSync(path.join(OUT, 'index.html'), html);
// Google Play (TWA): si existe app/.well-known/assetlinks.json (se revisó al inicio), se copia a /.well-known/.
if (HAS_ASSETLINKS) {
  fs.mkdirSync(path.join(OUT, '.well-known'), { recursive: true });
  fs.copyFileSync(ASSETLINKS, path.join(OUT, '.well-known', 'assetlinks.json'));
  // Netlify (al arrastrar el .zip) no publica carpetas que empiezan con punto: se copia también en la raíz
  // y una regla en _redirects lo sirve en /.well-known/assetlinks.json (arreglo hecho en vivo con la v158).
  fs.copyFileSync(ASSETLINKS, path.join(OUT, 'assetlinks.json'));
  console.log('assetlinks.json copiado a dist/.well-known/ y a dist/ (raíz)');
}
const sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = 'medellin-lock-${Date.now()}';`);
if (!sw.includes('medellin-lock-')) throw new Error('sw sin VERSION');
fs.writeFileSync(path.join(OUT, 'sw.js'), sw);
fs.writeFileSync(path.join(OUT, '_headers'), '/sw.js\n  Cache-Control: no-cache\n/\n  Cache-Control: no-cache\n/index.html\n  Cache-Control: no-cache\n');
fs.writeFileSync(path.join(OUT, '_redirects'), '/welcome  https://apps.mokeadigital.com/medellin  302\n/welcome/  https://apps.mokeadigital.com/medellin  302\n'
  + (HAS_ASSETLINKS ? '/.well-known/assetlinks.json  /assetlinks.json  200\n' : ''));
console.log('ok', (html.length / 1024).toFixed(0) + ' KB', 'secreto cifrado:', (secret.length / 1024).toFixed(0) + ' KB');
