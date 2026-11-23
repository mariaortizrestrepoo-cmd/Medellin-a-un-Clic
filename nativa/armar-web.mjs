// Arma www/ = lo que va DENTRO de la app de Google Play y de la App Store.
// Parte de app/ (la misma app de siempre) y le quita lo que la hace sentir página web:
//   - sin candado (la app se paga en la tienda), sin "instalar la app", sin service worker ni manifiesto web
//   - letras guardadas dentro (no se bajan de internet)
//   - agrega nativa.css y nativa.js (comportamiento de app: atrás, gestos, transiciones, vibración, etc.)
// app/ NO se modifica. Uso:  node armar-web.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(AQUI, '..', 'app'), WWW = path.join(AQUI, 'www');
const NO_VAN = new Set(['sw.js', 'manifest.json', '.well-known', 'compartir.jpg', 'compartir2.jpg', 'icon.svg', 'favicon-48.png']);

fs.rmSync(WWW, { recursive: true, force: true });
fs.cpSync(APP, WWW, { recursive: true, filter: f => !NO_VAN.has(path.basename(f)) });
fs.cpSync(path.join(AQUI, 'fuentes'), path.join(WWW, 'fuentes'), { recursive: true });
fs.copyFileSync(path.join(AQUI, 'nativa.css'), path.join(WWW, 'nativa.css'));
fs.copyFileSync(path.join(AQUI, 'nativa.js'), path.join(WWW, 'nativa.js'));

let h = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
const cambios = [];
function cambiar(nombre, re, por, veces = 1) {
  const n = (h.match(re) || []).length;
  if (n !== veces) throw new Error(`"${nombre}": se esperaban ${veces}, hay ${n}`);
  h = h.replace(re, por); cambios.push(nombre);
}
// 1) Letras: fuera Google Fonts, adentro las guardadas
cambiar('letras de internet', /<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '', (h.match(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/g) || []).length || 1);
cambiar('letras dentro', /<\/head>/, '<link rel="stylesheet" href="fuentes/fuentes.css">\n<link rel="stylesheet" href="nativa.css">\n</head>');
// 2) Nada de página web instalable
cambiar('manifiesto web', /<link rel="manifest"[^>]*>\s*/g, '');
cambiar('metas de página web en iPhone', /<meta name="apple-mobile-web-app-[^>]*>\s*/g, '', (h.match(/<meta name="apple-mobile-web-app-[^>]*>/g) || []).length);
cambiar('íconos de pestaña', /<link rel="(icon|apple-touch-icon)"[^>]*>\s*/g, '', (h.match(/<link rel="(icon|apple-touch-icon)"[^>]*>/g) || []).length);
cambiar('service worker', /try \{ if \('serviceWorker' in navigator[^\n]*\n/, '');
// 3) Sin zoom con los dedos (como una app)
cambiar('sin zoom', /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/, '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">');
// 4) Marca "nativa" lo antes posible (antes de pintar) y el comportamiento de app al final
cambiar('marca nativa', /<head>/, '<head>\n<script>document.documentElement.classList.add("nativa");</script>');
cambiar('comportamiento de app', /<\/body>/, '<script src="nativa.js"></script>\n</body>');
fs.writeFileSync(path.join(WWW, 'index.html'), h);

// Política y términos dentro de la app: sin íconos web
for (const f of ['privacidad.html', 'terminos.html']) {
  const p = path.join(WWW, f); if (!fs.existsSync(p)) continue;
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/<link rel="(icon|apple-touch-icon)"[^>]*>\s*/g, ''));
}
let n = 0; const contar = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? contar(path.join(d, e.name)) : n++); contar(WWW);
console.log('www/ listo:', n, 'archivos ·', cambios.join(' · '));
